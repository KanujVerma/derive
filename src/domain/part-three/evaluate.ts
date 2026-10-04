import {AHA_SUN_PLAN_CLAIM_ID} from '../part-four/reviewedAha.ts';
import { ScientificDecisionPacketSchema, type ScientificDecisionPacket } from '../../contracts/ScientificClaim.ts';
import type { PersonalContextV2, ApplicationSite, UseForm, PurposeId } from '../../contracts/PersonalContextV2.ts';
import type { ContextProductReference } from '../../contracts/PersonalContext.ts';
import { DecisionBindingV2Schema, PersonalResultV2Schema, type DecisionBindingV2,type PersonalResultV2,type FindingV2,type MaterialGap,type EligibleQuestion } from '../../contracts/PersonalResultV2.ts';
import { NormalizationResultSchema, type NormalizationResult, type PartTwoFact } from '../../contracts/PartTwo.ts';
import { lookupName } from '../part-two/dictionary.ts';
import { purposeFacts } from './projection.ts';
import { selectedPartThreeRelease, type PartThreeReleaseSelection } from './release.ts';
export interface HistoryResult { requestedScopes:Array<{kind:'catalog';productId:string}|{kind:'manual';recordId:string;name?:string}>;atRevision:number;activeRevisionIds:string[];completeness:'complete'|'incomplete'|'unavailable';reason:'complete'|'cap'|'deadline'|'repeated_cursor'|'page_error'|'revision_changed' }
export interface PersonalEvaluationInput {releaseSelection?:PartThreeReleaseSelection;scientificDecision?:ScientificDecisionPacket;binding:DecisionBindingV2;partTwo:NormalizationResult;context:PersonalContextV2;history:HistoryResult;now:string;resultId:string;resultRevision:number;name:string;requestedUse:{purpose:PurposeId|null;site:ApplicationSite|null;useForm:UseForm|null};selectedManualReportIds:string[];candidateRoutineItemId:string|null;questionSuppression:{exposedQuestionId:string|null;skip:boolean;answered:boolean}}
function referenceRelation(ref:ContextProductReference,binding:DecisionBindingV2):'exact_version'|'product_family'|null {
 const s=binding.subject;if(s.kind!=='declaration'||ref.kind!=='catalog'||!s.productId||ref.productId!==s.productId)return null;
 return s.variantId!==null&&s.formulaVersionId!==null&&ref.variantId===s.variantId&&ref.formulaVersionId===s.formulaVersionId?'exact_version':'product_family';
}
function matchesAvoidedReference(ref:ContextProductReference,binding:DecisionBindingV2):boolean {
 const s=binding.subject;if(s.kind!=='declaration'||ref.kind!=='catalog'||!s.productId||ref.productId!==s.productId)return false;
 return (!ref.variantId||ref.variantId===s.variantId)&&(!ref.formulaVersionId||ref.formulaVersionId===s.formulaVersionId);
}
const known=<T>(a:{state:string;value?:T}|undefined):T|null=>a?.state==='known'?a.value??null:null;
export function evaluatePersonalResult(input:PersonalEvaluationInput):PersonalResultV2 {
 const {semantic:release,dictionary,releaseHash}=selectedPartThreeRelease(input.releaseSelection);
 const b=DecisionBindingV2Schema.parse(input.binding),p=NormalizationResultSchema.parse(input.partTwo),c=input.context,clock=Date.parse(input.now);
 if(!Number.isFinite(clock)||c.ownerId!==b.ownerId||c.revision!==b.contextRevision||p.authenticatedOwnerId!==b.ownerId||p.generation!==b.partOneGeneration||p.evidenceRevision!==b.partOneRevision||p.bindingKey!==b.partTwoBindingKey||p.resultRevision!==b.partTwoRevision)throw Error('Part 3 authority mismatch');
 const revisionSet=(rows:Array<{id:string;ownerId:string}>)=>[...new Set(rows.map(x=>{if(x.ownerId!==b.ownerId)throw Error('Foreign context revision');return x.id;}))].sort();
 const sameRefs=(actual:string[],expected:string[])=>JSON.stringify([...actual].sort())===JSON.stringify(expected);
 if(b.profileRevision!==(c.profile?.id??null)||b.routineRevision!==(c.routine?.id??null)||b.historyRevision!==c.historyRevision||!sameRefs(b.assessmentRevisions,revisionSet(c.assessments))||!sameRefs(b.preferenceRevisions,revisionSet(c.preferences))||!sameRefs(b.noteRevisions,revisionSet(c.notes))||b.releases.releaseHash!==releaseHash)throw Error('Context binding mismatch');
 if(JSON.stringify(b.encounterInputs)!==JSON.stringify({candidateRoutineItemId:input.candidateRoutineItemId,selectedManualReportIds:input.selectedManualReportIds,use:input.requestedUse}))throw Error('Encounter input mismatch');
 const source=p.state==='ready'?p.output.reading:null,product=p.state==='ready'&&p.output.kind==='bound'?p.output.productFacts:null;
 if(['rule','evidence','question','template','policy','locale'].some(key=>b.releases[key as 'rule']!==release[key as 'rule'])||source&&(b.releases.dictionary!==dictionary.version||source.versions.dictionary!==dictionary.version||source.dependencyManifest.dictionaryHash!==dictionary.contentHash))throw Error('Selected dictionary or semantic release binding mismatch');
 const scientificPacket=input.scientificDecision?ScientificDecisionPacketSchema.parse(input.scientificDecision):null;
 const displayedScience=scientificPacket?.assessments.filter(row=>['supported','reference'].includes(row.assessment.state))??[];
 if(displayedScience.some(row=>!row.assessment.validUntil||Date.parse(row.assessment.validUntil)<=clock))throw Error('Displayed scientific evidence expired before evaluation');
 const deadline=new Date(Math.min(Date.parse(p.expiresAt),clock+60000,...displayedScience.map(row=>Date.parse(row.assessment.validUntil!)))).toISOString();
 const findings:FindingV2[]=[],gaps:MaterialGap[]=[],ruleResults:PersonalResultV2['ruleResults']=[];let findingSequence=0;
 const declaration=b.subject.kind==='declaration'?b.subject:null;
 const scope=declaration?.packageScope??'source_reading';
 const baseSubject:FindingV2['subject']=declaration?{kind:'declaration',itemId:declaration.itemId,declarationId:declaration.declarationId}:{kind:'source_reading',observationId:b.subject.kind==='source_reading'?b.subject.observationId:'unavailable'};
 const gap=(reason:MaterialGap['reason'],state:MaterialGap['state'],recoverableBy:MaterialGap['recoverableBy'],prop='personal-candidacy')=>{const id=prop==='personal-candidacy'?`gap:${reason}`:`gap:${reason}:${prop}`;if(!gaps.some(x=>x.id===id))gaps.push({id,affectedPropositionIds:[prop],state,reason,recoverableBy});return id;};
 function add(kind:FindingV2['kind'],rule:string,consequence:FindingV2['consequence'],detail:FindingV2['arguments']['detail'],options:{facts?:PartTwoFact[];reports?:string[];name?:string;relation?:FindingV2['arguments']['relation'];subject?:FindingV2['subject'];support?:FindingV2['supportState'];scope?:FindingV2['arguments']['scope'];reportTrace?:FindingV2['arguments']['reportTrace']}={}){
  if(findings.length>=100){gap('relevant_history','unavailable','none');const tier={decisive:0,concern:1,value:2,optional:3,information:4};let weakest=-1;for(let i=0;i<findings.length;i++)if(tier[findings[i].consequence]>tier[consequence]&&(weakest<0||tier[findings[i].consequence]>tier[findings[weakest].consequence]))weakest=i;if(weakest<0)return null;findings.splice(weakest,1);}
  const facts=options.facts??[],reports=[...new Set(options.reports??[])],id=`finding:${rule}:${findingSequence++}`;
  findings.push({id,kind,subject:options.subject??baseSubject,allowedPropositionId:`proposition:${rule}`,ruleId:rule,ruleVersion:release.rule,applicability:'eligible',consequence,supportState:options.support??'supported',mandatoryVisibility:['decisive','concern','value'].includes(consequence),factRefs:facts.map(f=>f.factId),reportRefs:reports,evidenceCardRefs:[releaseHash],requiredQualifierIds:[options.scope??scope,...(options.relation?[options.relation]:[])],blockingGapIds:[],templateId:kind,templateVersion:release.template,arguments:{reportTrace:options.reportTrace??null,name:options.name??null,relation:options.relation??null,scope:options.scope??scope,detail},dependencies:{sourceIds:[...new Set(facts.flatMap(f=>f.sourceDependencies))],sourceFields:facts.flatMap(f=>f.spans.map(s=>`${s.observationId}:${f.kind}:${s.entryId??s.sectionId}`)),contextRevisionIds:reports,factIds:facts.map(f=>f.factId),occurrenceIds:[...new Set(facts.filter(f=>f.kind!=='product_label_assertion').map(f=>f.occurrenceId))],releaseIds:[releaseHash],validUntil:deadline}});return id;
 }
 const identities=(product??source)?.facts.filter((f):f is Extract<PartTwoFact,{kind:'resolved_ingredient_identity'}>=>f.kind==='resolved_ingredient_identity')??[];
 const matching=(ingredientId:string)=>identities.filter(f=>f.value.ingredientId===ingredientId).map(f=>({f,o:(product??source)!.occurrences.find(o=>o.occurrenceId===f.occurrenceId)!})).filter(x=>x.o);
 const candidateCurrent=input.candidateRoutineItemId?c.routine?.data.items.find(i=>i.id===input.candidateRoutineItemId):null;
 for(const pref of c.preferences){if(pref.ownerId!==b.ownerId||!b.preferenceRevisions.includes(pref.id))throw Error('Foreign preference');const v=pref.data;
  if(v.kind==='avoid_ingredient'&&v.target.kind==='ingredient'){
   if(v.target.identity.kind==='unresolved'){gap('avoidance_unresolved','missing','evidence');add('evidence_limit','unresolved-avoidance','information','unresolved',{reports:[pref.id],name:v.target.identity.originalTerm});continue;}
   const preferredIngredientId=v.target.identity.ingredientId;if(!dictionary.identities.some(i=>i.ingredientId===preferredIngredientId&&i.status==='active')){gap('avoidance_unresolved','unavailable','reviewer');add('evidence_limit','unresolved-avoidance','information','unresolved',{reports:[pref.id]});continue;}
   const matches=matching(v.target.identity.ingredientId);
   if(v.strength==='decisive'&&(!product||matches.some(({f,o})=>f.subject.kind!=='bound_declaration_entry'||o.modality!=='unconditional'||o.transcription!=='clear')||(!matches.length&&(product.claimLimits.declarationCompleteness!=='accepted'||product.occurrences.some(o=>o.mapping.state!=='resolved')))))gap('avoidance_unresolved','missing','evidence');
   for(const {f,o} of matches){const definite=product&&product.evidenceState!=='conflict'&&product.evidenceState!=='blocked'&&f.subject.kind==='bound_declaration_entry'&&o.modality==='unconditional'&&o.transcription==='clear';add(definite?'avoidance':'evidence_limit','exact-avoidance',definite&&v.strength==='decisive'?'decisive':definite?'optional':'information',definite?'preference':'conditional',{facts:[f],reports:[pref.id],name:o.observedName});}
  }else if(v.kind==='avoid_product'&&v.target.kind==='product'){
   const ref=v.target.reference;
   if(matchesAvoidedReference(ref,b)||candidateCurrent?.reference.kind==='manual'&&JSON.stringify(candidateCurrent.reference)===JSON.stringify(ref))add('avoidance','avoid-retry',v.strength==='decisive'?'decisive':'optional','preference',{reports:[pref.id,...(candidateCurrent&&c.routine?[c.routine.id]:[])],scope:'report'});
   else if (v.strength === 'decisive' && ref.kind === 'catalog' && declaration?.productId === ref.productId
    && (!ref.variantId || !declaration.variantId || ref.variantId === declaration.variantId)
    && (!ref.formulaVersionId || !declaration.formulaVersionId || ref.formulaVersionId === declaration.formulaVersionId)
    && (ref.variantId && !declaration.variantId || ref.formulaVersionId && !declaration.formulaVersionId)) {
    gap('avoidance_unresolved','missing','evidence');add('evidence_limit','unresolved-product-avoidance','information','unresolved',{reports:[pref.id],relation:'product_family',scope:'report'});
   }
  }
 }
 const profile=c.profile?.data;
 if(profile?.sensitivities.status==='reported')for(const term of profile.sensitivities.values){const aliases=dictionary.aliases.filter(a=>a.status==='active'&&a.lookupKey===lookupName(term).key),ids=[...new Set(aliases.map(a=>a.ingredientId))];if(ids.length!==1)continue;
  for(const {f,o} of matching(ids[0])){const definite=product&&product.evidenceState!=='conflict'&&product.evidenceState!=='blocked'&&f.subject.kind==='bound_declaration_entry'&&o.modality==='unconditional'&&o.transcription==='clear';add(definite?'sensitivity':'evidence_limit','reported-sensitivity',definite?'concern':'information',definite?'reaction':'conditional',{facts:[f],reports:c.profile?[c.profile.id]:[],name:term});}
 }
 const activeIds=new Set(input.history.activeRevisionIds);
 for(const report of c.experiences){if(report.ownerId!==b.ownerId)throw Error('Foreign report');if(!activeIds.has(report.id))continue;let relation:FindingV2['arguments']['relation']=referenceRelation(report.data.reference,b),role:'candidate'|'comparator'='candidate';
  if(!relation&&candidateCurrent?.reference.kind==='catalog'&&report.data.reference.kind==='catalog'&&candidateCurrent.reference.productId===report.data.reference.productId)relation='product_family';
  if(!relation&&report.data.reference.kind==='manual'&&(input.selectedManualReportIds.includes(report.data.id)||candidateCurrent?.reference.kind==='manual'&&JSON.stringify(candidateCurrent.reference)===JSON.stringify(report.data.reference)))relation='selected_manual';
  const comparisonItem=b.comparatorId?c.routine?.data.items.find(i=>i.id===b.comparatorId):null;if(!relation&&comparisonItem&&(report.data.reference.kind==='manual'&&comparisonItem.reference.kind==='manual'&&JSON.stringify(report.data.reference)===JSON.stringify(comparisonItem.reference)||report.data.reference.kind==='catalog'&&comparisonItem.reference.kind==='catalog'&&report.data.reference.productId===comparisonItem.reference.productId)){relation=report.data.reference.kind==='manual'?'selected_manual':'product_family';role='comparator';}if(!relation)continue;
  add('experience','experience-recall',report.data.kind==='reacted'&&role==='candidate'?'concern':'information',report.data.kind==='reacted'?'reaction':report.data.kind==='ineffective'?'ineffective':report.data.kind,{reports:[report.id,...(role==='comparator'&&c.routine?[c.routine.id]:[])],relation,scope:'report',reportTrace:{recordId:report.data.id,reference:report.data.reference,role,period:report.data.occurred,useContext:report.data.useContext},subject:{kind:'report',recordId:report.data.id,relation}});
 }
 if(input.history.atRevision!==c.revision||input.history.completeness!=='complete')gap('relevant_history','unavailable','none');
 const purpose=purposeFacts(p,b,clock,input.releaseSelection),goal=known(profile?.primaryGoal);
 const requested=input.requestedUse;
 const comparator=b.comparatorId?c.routine?.data.items.find(i=>i.id===b.comparatorId):null;
 function assessmentFor(item:NonNullable<typeof comparator>){return c.assessments.filter(a=>a.ownerId===b.ownerId&&b.assessmentRevisions.includes(a.id)&&JSON.stringify(a.data.reference)===JSON.stringify(item.reference)&&known(a.data.useContext.reportedPurpose?.answer)===known(item.reportedPurpose?.answer)&&known(a.data.useContext.applicationSite?.answer)===known(item.applicationSite?.answer)&&known(a.data.useContext.useForm?.answer)===known(item.useForm?.answer)&&[known(item.reportedPurpose?.answer),goal].includes(known(a.data.goalOrPurpose))&&known(a.data.goalOrPurpose)!==null).sort((a,b)=>b.revision-a.revision)[0];}
 const materialUseKnown=(item:NonNullable<typeof comparator>)=>known(item.reportedPurpose?.answer)!==null&&known(item.applicationSite?.answer)!==null&&known(item.useForm?.answer)!==null;
 const sameUse=(item:NonNullable<typeof comparator>,f:typeof purpose[number])=>known(item.reportedPurpose?.answer)===f.purposeId&&known(item.applicationSite?.answer)===f.site&&known(item.useForm?.answer)===f.useForm;
 const admitted=purpose.find(f=>requested.site===f.site&&requested.useForm===f.useForm&&(requested.purpose===f.purposeId||requested.purpose===null&&goal==='dryness'&&f.purposeId==='moisturizing'));
 if(b.intent==='check_current'&&candidateCurrent&&(candidateCurrent.state==='current'||candidateCurrent.state==='occasional')){
  const assessment=assessmentFor(candidateCurrent),relation=referenceRelation(candidateCurrent.reference,b)??(candidateCurrent.reference.kind==='manual'?'selected_manual':'product_family');
  if(assessment&&relation&&materialUseKnown(candidateCurrent)&&requested.purpose===known(candidateCurrent.reportedPurpose?.answer)&&requested.site===known(candidateCurrent.applicationSite?.answer)&&requested.useForm===known(candidateCurrent.useForm?.answer)&&assessment.data.perceivedHelp==='helps'&&(known(assessment.data.goalOrPurpose)===goal||known(assessment.data.goalOrPurpose)===requested.purpose)&&goal==='maintain')add('current_help','current-help','value','helps',{reports:[c.routine!.id,assessment.id,...(c.profile?[c.profile.id]:[])],scope:'report',subject:{kind:'report',recordId:assessment.data.id,relation},relation});
 }
 if(comparator&&declaration&&c.routine){
  const assessment=assessmentFor(comparator),f=purpose.find(f=>sameUse(comparator,f)&&(requested.purpose===null||requested.purpose===f.purposeId)&&(requested.site===null||requested.site===f.site)&&(requested.useForm===null||requested.useForm===f.useForm));const self=referenceRelation(comparator.reference,b)==='exact_version'||candidateCurrent?.id===comparator.id;
  if(self)add('comparison','pair-self','information','self',{reports:[c.routine.id],scope:'comparison',subject:{kind:'comparison',candidateItemId:declaration.itemId,comparatorId:comparator.id}});
  else if(f&&(comparator.state==='current'||comparator.state==='occasional')){
   if(b.intent==='replace'){add('comparison','pair-replacement','optional','replacement',{facts:product!.facts.filter(x=>x.factId===f.partTwoFactId),reports:[c.routine.id,...(assessment?[assessment.id]:[])],scope:'comparison',subject:{kind:'comparison',candidateItemId:declaration.itemId,comparatorId:comparator.id}});
    if(admitted)add('purpose_value','purpose-value','value','replacement',{facts:product!.facts.filter(x=>x.factId===admitted.partTwoFactId),reports:[c.routine.id,...(c.profile?[c.profile.id]:[])]});
   }else if(b.intent==='add'&&assessment?.data.perceivedHelp==='helps'){
    const decisive=c.preferences.find(v=>v.data.kind==='no_extra_step'&&v.data.strength==='decisive');add('comparison','already-helpful',decisive||goal==='simplify'?'decisive':'optional','already_helpful',{facts:product!.facts.filter(x=>x.factId===f.partTwoFactId),reports:[c.routine.id,assessment.id,...(c.profile?[c.profile.id]:[]),...(decisive?[decisive.id]:[])],scope:'comparison',subject:{kind:'comparison',candidateItemId:declaration.itemId,comparatorId:comparator.id}});
   }
  }else add('comparison','different-use','information','different_use',{reports:[c.routine.id],scope:'comparison',subject:{kind:'comparison',candidateItemId:declaration.itemId,comparatorId:comparator.id}});
 }
 if(admitted?.purposeId==='moisturizing'&&goal==='dryness'&&b.intent==='add')add('purpose_value','purpose-value','value','helps',{facts:product!.facts.filter(x=>x.factId===admitted.partTwoFactId),reports:c.profile?[c.profile.id]:[]});
 if(input.scientificDecision){
  const science=scientificPacket!;
  if(b.releases.partFour?.scientificManifestHash!==science.manifestHash)throw Error('Scientific manifest binding mismatch');
  for(const {goal,assessment:a} of science.assessments){
   if(a.state!=='supported'||!a.reason||!a.validUntil||Date.parse(a.validUntil)<=clock||!declaration)continue;
   const routine=a.family==='G04'||a.family==='G05',id=`scientific:${a.claimId}:${goal??'routine'}`,consequence=routine?(a.family==='G04'||a.claimId===AHA_SUN_PLAN_CLAIM_ID?'concern':'information'):'value';
   findings.push({id,kind:routine?'routine_evidence':'goal_evidence',subject:baseSubject,allowedPropositionId:a.claimId,ruleId:a.family,ruleVersion:'G01-G05/local-candidate-v1',applicability:'eligible',consequence,supportState:'supported',mandatoryVisibility:true,factRefs:a.factIds,reportRefs:a.contextRevisionIds,evidenceCardRefs:[a.claimHash,science.manifestHash],requiredQualifierIds:[],blockingGapIds:[],templateId:routine?'routine_evidence':'goal_evidence',templateVersion:release.template,scientificEvidence:{claimId:a.claimId,claimHash:a.claimHash,manifestHash:science.manifestHash,reason:a.reason,action:a.action,qualifications:a.reasons},arguments:{reportTrace:null,name:null,relation:null,scope,detail:routine?'label_caution':'benefit'},dependencies:{sourceIds:a.sourceIds,sourceFields:[],contextRevisionIds:a.contextRevisionIds,factIds:a.factIds,occurrenceIds:[],releaseIds:[science.manifestHash,a.claimHash],validUntil:new Date(Math.min(Date.parse(deadline),Date.parse(a.validUntil))).toISOString()}});
  }
  for(const goal of science.unresolvedGoals)gap('goal_evidence','unavailable','reviewer',`goal:${goal}`);
  if(science.unresolvedGoals.length)gap('goal_evidence','unavailable','reviewer');
 }
 if(!declaration)gap('identity_or_use','missing','evidence');
 if(product?.evidenceState==='conflict')gap('formula_association','conflict','evidence');
 if(!findings.some(f=>f.consequence==='value')&&!findings.some(f=>f.consequence==='decisive'||f.consequence==='concern'))gap(purpose.length?'purpose_or_site':'purpose_coverage','missing',purpose.length?'user':'reviewer');
 let question:EligibleQuestion|null=null;
 if(!findings.some(f=>f.consequence==='decisive')&&!input.questionSuppression.exposedQuestionId&&!input.questionSuppression.skip&&!input.questionSuppression.answered&&comparator&&(comparator.state==='current'||comparator.state==='occasional')&&c.routine&&purpose.some(f=>sameUse(comparator,f)&&(requested.purpose===null||requested.purpose===f.purposeId)&&(requested.site===null||requested.site===f.site)&&(requested.useForm===null||requested.useForm===f.useForm))&&assessmentFor(comparator)?.data.perceivedHelp==='helps'&&b.intent==='unanswered')question={id:'question:replace-or-add',version:release.question,missingInput:'intent',ruleIds:['pair-comparison'],affectedPropositionIds:['personal-candidacy'],branches:[{answer:'replace',outcome:'replacement'},{answer:'add',outcome:'extra_step'},{answer:'unsure',outcome:'unknown'}],sensitivity:'ordinary',relevanceReason:'replacement_or_extra',writeScope:'encounter',suppressionKey:'encounter:intent',priority:[2,2,1,1,0]};
 const decisive=findings.filter(f=>f.consequence==='decisive'),concerns=findings.filter(f=>f.consequence==='concern'),values=findings.filter(f=>f.consequence==='value');
 const material=gaps.filter(g=>g.affectedPropositionIds.includes('personal-candidacy'));
 const judgment=decisive.length?'skip':concerns.length?'check_first':values.length&&!material.length?'worth_considering':material.some(g=>g.reason==='avoidance_unresolved')?'check_first':'not_enough_info';
 const primary=decisive[0]??concerns[0]??(judgment==='worth_considering'?values[0]:findings.find(f=>f.kind==='evidence_limit'))??null;
 for(const ruleId of release.rules){const fs=findings.filter(f=>f.ruleId===ruleId||ruleId==='pair-comparison'&&['pair-self','pair-replacement','already-helpful','different-use'].includes(f.ruleId)||ruleId==='exact-avoidance'&&f.ruleId==='avoid-retry');ruleResults.push({ruleId,state:fs.length?'eligible':gaps.length?'insufficient':'inapplicable',reason:fs.length?'supported_basis':gaps.length?'material_inputs_missing':'no_applicable_input'});}
 const result:PersonalResultV2={schemaVersion:'personal-result/v2',resultId:input.resultId,resultRevision:input.resultRevision,generation:b.generation,state:Date.parse(p.expiresAt)<=clock?'expired':p.state==='ready'?'ready':p.state==='pending'?'pending':'unavailable',binding:b,evaluatedAt:input.now,validUntil:deadline,summary:p.state==='ready'&&Date.parse(p.expiresAt)>clock?{judgment,displayVariant:judgment==='worth_considering'&&primary?.kind==='current_help'?'worth_keeping':'default',namedDecision:{itemId:declaration?.itemId??null,name:input.name,intent:b.intent},primaryFindingId:primary?.id??null,affirmativePremiseIds:values.map(f=>f.id),overridingFindingIds:[...decisive,...concerns].map(f=>f.id),consideredConstraintIds:findings.filter(f=>['avoidance','sensitivity'].includes(f.kind)).map(f=>f.id),materialGapIds:material.map(g=>g.id),scope:primary?.arguments.scope??scope}:null,findings:Date.parse(p.expiresAt)>clock?findings:[],materialGaps:Date.parse(p.expiresAt)>clock?gaps:[],question:Date.parse(p.expiresAt)>clock?question:null,refinementStatus:'off',refinementTrace:null,selectedTradeoffId:Date.parse(p.expiresAt)>clock?findings.find(f=>f.consequence==='optional')?.id??null:null,ruleResults};
 return PersonalResultV2Schema.parse(result);
}
