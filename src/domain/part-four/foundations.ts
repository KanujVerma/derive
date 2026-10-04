import { APPROVED_37_INGREDIENT_KNOWLEDGE, type IngredientKnowledgeRelease } from './knowledge.ts';
import type { PersonalContextV2, PersonalRoutineItemV2, ProductAssessment, ReportedDate } from '../../contracts/PersonalContextV2.ts';
import type { ContextGoal, ContextProductReference } from '../../contracts/PersonalContext.ts';
import { NormalizationResultSchema, type NormalizationResult, type PartTwoFact } from '../../contracts/PartTwo.ts';
import { PartFourInsightSchema, PartFourComparisonSchema, type PartFourInsight, type PartFourComparison } from '../../contracts/PartFour.ts';
import { PART_THREE_RELEASE } from '../part-three/release.ts';
import { activeRoutineItem, exactCatalogReference, knownAnswer, sameReportedUse, selectCurrentComparator, routineItemLabel, type RequestedUse } from './comparison.ts';
import { admitRoutineFormulaEvidence, type QualifiedRoutineFormula, type RoutineFormulaItemState } from './routineFormula.ts';
export type { QualifiedRoutineFormula } from './routineFormula.ts';
export interface FoundationInput {
 scientificDecision?:import('../../contracts/ScientificClaim.ts').ScientificDecisionPacket;
 scientificManifest?:import('../../contracts/ScientificClaim.ts').ScientificManifest;
 context:PersonalContextV2; partTwo:NormalizationResult; requestedUse:RequestedUse;
 intent:'add'|'replace'|'check_current'|'unanswered'|'unsure'|'withheld'; candidateRoutineItemId:string|null; selectedComparatorId:string|null;
 /** Pass evaluation time at the authority boundary. Omitted time evaluates only
  * the immutable normalization snapshot, not present-day authorization. */
 knowledge?:IngredientKnowledgeRelease; now?:string; candidateReference?:ContextProductReference|null; routineFormulas?:QualifiedRoutineFormula[]; routineFormulaEvidence?:readonly unknown[]; routineLabels?:Readonly<Record<string,string>>;
}
export interface FoundationResult { insights:PartFourInsight[]; comparison:PartFourComparison; routineFormulaStates:RoutineFormulaItemState[] }
const goalsWithNoEfficacy = new Set<ContextGoal>(['breakouts','dark_spots','oiliness','texture','redness','fine_lines']);
const readable = (id:string) => id.replaceAll('_',' ');
const reportDate=(date:ReportedDate)=>date.state==='known'?`${date.value.value} (${date.value.precision} precision)`:date.state;
function reportRelation(a:ContextProductReference,b:ContextProductReference):'exact_version'|'product_family'|'selected_manual'|null {
 if(exactCatalogReference(a,b))return 'exact_version';
 if(a.kind==='catalog'&&b.kind==='catalog'&&a.productId===b.productId)return 'product_family';
 if(a.kind==='manual'&&b.kind==='manual'&&a.name===b.name&&a.brand===b.brand)return 'selected_manual';
 return null;
}
function assessmentUse(a:ProductAssessment,item:PersonalRoutineItemV2,use:RequestedUse):boolean {
 return sameReportedUse(item,use)&&knownAnswer(a.useContext.reportedPurpose?.answer)===use.purpose&&knownAnswer(a.useContext.applicationSite?.answer)===use.site&&knownAnswer(a.useContext.useForm?.answer)===use.useForm;
}
export function buildFoundationInsights(input:FoundationInput):FoundationResult {
 const p=NormalizationResultSchema.parse(input.partTwo), c=input.context;
 if(c.ownerId!==p.authenticatedOwnerId)throw Error('Part Four context owner mismatch');
 for(const row of [c.profile,c.routine,...c.assessments,...c.preferences,...c.experiences].filter(x=>x!==null))if(row.ownerId!==c.ownerId||row.revision>c.revision)throw Error('Foreign or future Part Four context revision');
 const now=Date.parse(input.now??(p.state==='ready'?p.output.reading.createdAt:''));
 if(!Number.isFinite(now))throw Error('Part Four evaluation time is required');
 const product=p.state==='ready'&&p.output.kind==='bound'&&Date.parse(p.expiresAt)>now&& !['conflict','blocked'].includes(p.output.productFacts.evidenceState)?p.output.productFacts:null;
 const profile=c.profile?.data, profileRefs=c.profile?[c.profile.id]:[], routineRefs=c.routine?[c.routine.id]:[];
 const primary=knownAnswer(profile?.primaryGoal), goals=[...new Set([...(primary?[primary]:[]),...(profile?.secondaryGoals??[])])];
 const active=c.routine?.data.items.filter(activeRoutineItem)??[], compatible=active.filter(item=>sameReportedUse(item,input.requestedUse));
 const comparison=selectCurrentComparator({routine:c.routine?.data??null,requestedUse:input.requestedUse,candidateRoutineItemId:input.candidateRoutineItemId,selectedComparatorId:input.selectedComparatorId,candidateReference:input.candidateReference,routineLabels:input.routineLabels});
 const label=(item:PersonalRoutineItemV2)=>routineItemLabel(item,active,input.routineLabels);
 const insights:PartFourInsight[]=[];
 function add(ruleId:PartFourInsight['ruleId'],state:PartFourInsight['state'],title:string,explanation:string,options:{context?:string[];facts?:PartTwoFact[];action?:string;occurrences?:string[];sources?:string[];key?:string}={}) {
  if(insights.length>=100)throw Error('Part Four foundation insight limit exceeded');
  const facts=options.facts??[];
  insights.push({id:`foundation:${ruleId}:${options.key??insights.filter(i=>i.ruleId===ruleId).length}`,ruleId,state,title,explanation,action:options.action??null,contextRevisionIds:[...new Set(options.context??[])],factIds:facts.map(f=>f.factId),occurrenceIds:[...new Set([...(options.occurrences??[]),...facts.flatMap(f=>f.kind==='product_label_assertion'?[]:[f.occurrenceId])])],sourceIds:[...new Set([...(options.sources??[]),...facts.flatMap(f=>f.sourceDependencies)])]});
 }
 const purposes=product?.labelAssertions.flatMap(assertion=>{
  const mapping=PART_THREE_RELEASE.purposes.find(m=>m.literal===assertion.text), fact=product.facts.find(f=>f.kind==='product_label_assertion'&&f.subject.assertionId===assertion.assertionId&&f.value.assertionKind==='purpose'&&f.value.text===assertion.text);
  const source=product.dependencyManifest.sourceRefs.find(s=>s.observationId===assertion.span.observationId&&s.sourceRevision===assertion.span.sourceRevision);
  if(!mapping||!fact||!source||assertion.assertionKind!=='purpose'||assertion.transcription!=='clear'||assertion.conditional!==null||Date.parse(assertion.fieldPermission.expiresAt)<=now||Date.parse(source.expiresAt)<=now||Date.parse(fact.validUntil)<=now)return [];
  return [{mapping,fact}];
 })??[];
 const admitted=purposes.find(({mapping:m})=>m.purposeId===input.requestedUse.purpose&&m.site===input.requestedUse.site&&m.useForm===input.requestedUse.useForm);
 if(goals.includes('dryness')){
  if(admitted?.mapping.purposeId==='moisturizing')add('F01','supported','Moisturizing purpose relevance',`The label describes moisturizing use, relevant to your ${primary==='dryness'?'primary':'secondary'} dryness goal${profile?.skinBehavior==='dry_tight'?'; you reported dry or tight skin':''}. It does not establish how much this product will improve dryness.`,{context:profileRefs,facts:[admitted.fact]});
  else add('F01',purposes.length?'inapplicable':'unknown','Dryness purpose relevance not established','The label does not establish moisturizing use at the requested site and use form. Ingredient names alone cannot fill that gap.',{context:profileRefs});
 }else add('F01','inapplicable','Dryness goal not reported','No dryness goal was reported for this moisturizing-purpose relation.',{context:profileRefs});
 for(const goal of goals)if(goalsWithNoEfficacy.has(goal))add('F02','unknown',`${primary===goal?'Primary':'Secondary'} goal: ${readable(goal)}`,`Effect on ${readable(goal)} is not established by this check. Ingredient functions do not establish how this product will affect that goal. Your applicable personal reports are shown separately.`,{context:profileRefs,key:goal});
 if(!goals.some(g=>goalsWithNoEfficacy.has(g)))add('F02',goals.length?'limited':'unknown','Goal coverage','Your reported goals are considered here. More evidence is needed to establish product benefits beyond its label purpose and your personal reports.',{context:profileRefs});
 const noExtra=c.preferences.filter(r=>r.data.kind==='no_extra_step'&&r.data.status==='confirmed'&&r.data.target.kind==='routine');
 const distinctSameUse=compatible.filter(item=>item.id!==input.candidateRoutineItemId&&!(input.candidateReference&&exactCatalogReference(item.reference,input.candidateReference)));
 if(input.intent==='add'&&(goals.includes('simplify')||noExtra.length)&&admitted&&distinctSameUse.length)add('F03','supported','Another reported same-use step',`Adding this candidate would add a step with the same reported purpose, site and use form as ${distinctSameUse.map(label).join(', ')}. This supports your simplification preference; it does not establish that the product is unnecessary or would not help.`,{context:[...profileRefs,...routineRefs,...noExtra.map(r=>r.id)],facts:[admitted.fact],action:'Consider replacing a named step rather than adding another same-use step.'});
 else add('F03','inapplicable','Simplification relation','An extra same-use step is not established for this intention and the available routine.',{context:[...profileRefs,...routineRefs]});
 const targetIds=new Set([input.candidateRoutineItemId,comparison.routineItemId].filter((id):id is string=>id!==null));
 let reported=0;
 const superseded=new Set(c.assessments.flatMap(a=>[a.supersedesRevisionId,a.data.supersedesRevisionId]).filter(Boolean));
 for(const item of active.filter(i=>targetIds.has(i.id))){
  const assessment=c.assessments.filter(a=>!superseded.has(a.id)&&reportRelation(a.data.reference,item.reference)!==null&&assessmentUse(a.data,item,input.requestedUse)&&knownAnswer(a.data.goalOrPurpose)!==null&&[input.requestedUse.purpose,...goals].includes(knownAnswer(a.data.goalOrPurpose))).sort((a,b)=>Date.parse(b.data.assessedAt)-Date.parse(a.data.assessedAt)||b.revision-a.revision)[0];
  if(!assessment)continue;
  reported++; const help=assessment.data.perceivedHelp, satisfaction=assessment.data.satisfaction, texture=knownAnswer(assessment.data.textureExperience);
  const relation=reportRelation(assessment.data.reference,item.reference);
  const period=assessment.data.reportingPeriod,use=assessment.data.useContext;
  const uncertainOrPast=period.start.state!=='known'||period.end.state!=='known'||period.end.value.precision!=='day'||period.end.value.value!==new Date(now).toISOString().slice(0,10)||use.timing==='unknown'||use.frequency.kind==='unknown'||use.startedOn.state!=='known'||use.startedOn.value.precision!=='day'||Date.parse(use.startedOn.value.value)>now||use.stoppedOn.state!=='unanswered'||Date.parse(assessment.data.assessedAt)>now;
  const state=c.historyTruncated||relation==='product_family'||uncertainOrPast?(['helps','mixed','not_helping'].includes(help)?'limited':'unknown'):help==='helps'?'supported':['mixed','not_helping'].includes(help)?'limited':'unknown';
  const frequency=use.frequency.kind==='exact'?`${use.frequency.count}/${use.frequency.unit}`:use.frequency.kind==='unknown'?'unknown':use.frequency.value;
  add('F04',state,'Your product report',`You reported${relation==='product_family'?' at the product family level (a different or unspecified variant or formula)':''} that ${label(item)} ${help==='helps'?'helps':help==='not_helping'?'is not helping':help==='mixed'?'has mixed helpfulness':'has unknown helpfulness'} for ${readable(knownAnswer(assessment.data.goalOrPurpose)!)}; satisfaction is ${satisfaction}${texture?`; you reported texture as ${readable(texture)}`:''}. Reporting period: ${reportDate(period.start)} to ${reportDate(period.end)}. Reported use: ${use.timing}, frequency ${frequency}, started ${reportDate(use.startedOn)}, stopped ${reportDate(use.stoppedOn)}, duration ${use.duration?`${use.duration.count} ${use.duration.unit}`:'unknown'} (assessed ${assessment.data.assessedAt}).${uncertainOrPast?' This report does not establish current helpfulness for the present use.':''} Helpfulness and satisfaction are separate reports, not clinical efficacy or an ingredient culprit.${c.historyTruncated?' Applicable history is incomplete.':''}`,{context:[...profileRefs,...routineRefs,assessment.id],key:item.id});
 }
 if(!reported)add('F04','unknown','Current helpfulness unknown','Routine membership alone does not show helpfulness, satisfaction or tolerance. No applicable product-and-use assessment is available.',{context:routineRefs});
 const behavior=profile?.skinBehavior,reactivity=profile?.reactivity, behaviorKnown=behavior&& !['unsure','unanswered','withheld'].includes(behavior), reactivityKnown=reactivity&&!['unsure','unanswered','withheld'].includes(reactivity);
 const currentCandidate=active.find(item=>item.id===input.candidateRoutineItemId), candidateReference=input.candidateReference??currentCandidate?.reference;
 const supersededExperiences=new Set(c.experiences.map(e=>e.supersedesRevisionId).filter(Boolean));
 const experiences=c.experiences.filter(e=>!supersededExperiences.has(e.id)&&candidateReference&&reportRelation(e.data.reference,candidateReference)!==null&&e.data.useContext&&knownAnswer(e.data.useContext.reportedPurpose?.answer)===input.requestedUse.purpose&&input.requestedUse.purpose!==null&&knownAnswer(e.data.useContext.applicationSite?.answer)===input.requestedUse.site&&input.requestedUse.site!==null&&knownAnswer(e.data.useContext.useForm?.answer)===input.requestedUse.useForm&&input.requestedUse.useForm!==null);
 const response=experiences.length?experiences.map(e=>`You reported ${readable(e.data.kind)}${candidateReference&&reportRelation(e.data.reference,candidateReference)==='product_family'?' at the product family level (a different or unspecified variant or formula)':''} for this use; this does not prove future response or ingredient causation.`).join(' '):'Personal response to this candidate remains unknown without applicable reports.';
 add('F05',behaviorKnown||reactivityKnown||experiences.length?'limited':'unknown','Reported skin context',`${behaviorKnown?`You reported ${readable(behavior!)} skin behavior. `:''}${reactivityKnown?`You reported ${readable(reactivity!)}. `:''}${response} These reports and ingredient functions do not predict irritation or allergy from this product.`,{context:[...profileRefs,...(currentCandidate?routineRefs:[]),...experiences.map(e=>e.id)]});
 const routine=c.routine?.data, complete=!!routine&&routine.completeness==='complete'&&active.every(i=>knownAnswer(i.reportedPurpose?.answer)!==null&&knownAnswer(i.applicationSite?.answer)!==null&&knownAnswer(i.useForm?.answer)!==null);
 const details=active.map(i=>`${label(i)}: ${knownAnswer(i.reportedPurpose?.answer)??'unknown purpose'}, ${knownAnswer(i.applicationSite?.answer)??'unknown site'}, ${readable(knownAnswer(i.useForm?.answer)??'unknown form')}, timing ${i.timing}, frequency ${i.frequency.kind==='unknown'?'unknown':i.frequency.kind==='exact'?`${i.frequency.count}/${i.frequency.unit}`:i.frequency.value}`).join('; ');
 add('F06',complete?'supported':routine?'limited':'unknown','Whole current routine role map',`${details||'No active routine items reported.'} Same-use steps: ${compatible.map(label).join(', ')||'none established'}. Routine completeness: ${routine?.completeness??'unknown'}. This is a reported-use map; it does not establish absence of duplicates, conflicts or clinical interactions.`,{context:routineRefs});
 // Independently revalidate worker admission against the current routine/use
 // and clock. A bare exact_formula marker never grants formula authority.
 const supplied=input.routineFormulas??[];
 const routineAdmission=admitRoutineFormulaEvidence(c,input.routineFormulaEvidence??supplied.filter(q=>q.evidence&&q.routineItemId===q.evidence.request.routineItemId&&exactCatalogReference(q.reference,q.evidence.request.reference)).map(q=>q.evidence),{now:new Date(now).toISOString(),knowledge:input.knowledge??APPROVED_37_INGREDIENT_KNOWLEDGE});
 let presence=0;
 for(const qualified of routineAdmission.qualified){
  const item=active.find(i=>i.id===qualified.routineItemId);
  if(!item||item.id===input.candidateRoutineItemId||!!input.candidateReference&&exactCatalogReference(item.reference,input.candidateReference)||qualified.qualification!=='exact_formula'||!exactCatalogReference(item.reference,qualified.reference)||!product)continue;
  const normalized=NormalizationResultSchema.parse(qualified.partTwo);
  if(normalized.authenticatedOwnerId!==c.ownerId||normalized.state!=='ready'||normalized.output.kind!=='bound'||Date.parse(normalized.expiresAt)<=now)continue;
  const other=normalized.output.productFacts;
  if(['blocked','conflict'].includes(other.evidenceState))continue;
  const exact=(facts:typeof other)=>facts.facts.filter((f):f is Extract<PartTwoFact,{kind:'resolved_ingredient_identity'}>=>f.kind==='resolved_ingredient_identity'&&f.subject.kind==='bound_declaration_entry'&&Date.parse(f.validUntil)>now&&facts.occurrences.some(o=>o.occurrenceId===f.occurrenceId&&o.modality==='unconditional'&&o.transcription==='clear'));
  const candidateFacts=exact(product), otherFacts=exact(other);
  for(const fact of candidateFacts){const matches=otherFacts.filter(f=>f.value.ingredientId===fact.value.ingredientId);if(!matches.length)continue;
   presence++; const occurrence=product.occurrences.find(o=>o.occurrenceId===fact.occurrenceId)!;
   const session=input.candidateRoutineItemId?active.find(i=>i.id===input.candidateRoutineItemId)?.timing:undefined;
   const sessionCopy=session&&session!=='unknown'&&item.timing!=='unknown'?(session==='both'||item.timing==='both'||session===item.timing?'Reported timing shares a session.':'Reported timing uses separate sessions.'):'Session overlap is unknown.';
   add('F07','supported','Exact declared ingredient co-presence',`${occurrence.observedName} is declared unconditionally in the candidate and ${label(item)}. ${sessionCopy} This does not establish total dose, irritation or an interaction.`,{context:routineRefs,facts:[fact,...matches],key:`${item.id}:${fact.occurrenceId}`});
  }
 }
 if(!presence)add('F07','unknown','Whole-routine co-presence not established','No exact eligible formula pair establishes declared ingredient co-presence. Missing formulas or a partial routine cannot establish no overlap or no conflict.',{context:routineRefs});
 const quantityFacts=product?.facts.filter((f):f is Extract<PartTwoFact,{kind:'declared_quantity'}>=>f.kind==='declared_quantity'&&Date.parse(f.validUntil)>now)??[];
 if(quantityFacts.length)for(const fact of quantityFacts)add('F08','limited','Printed quantity and limits',`Printed quantity: ${fact.value.span.raw}; subject ${fact.value.subject}, operator ${fact.value.operator}, unit ${fact.value.unit}, basis ${fact.value.basis}. Known ingredient functions remain readable. Effectiveness at this amount is not established; blend or group amounts do not establish each ingredient's concentration.`,{facts:[fact],key:fact.factId});
 else add('F08','limited','Amount-dependent evidence limit','No applicable printed quantity is available. Known ingredient functions remain readable; ingredient order does not establish percentage, effective dose or safety. Dose-dependent claims require separately admitted applicability evidence.');
 const texturePreference=knownAnswer(profile?.texturePreference);
 add('F09','unknown','Texture and value tradeoff unavailable',`${texturePreference?`You reported a ${readable(texturePreference)} texture preference. `:''}Feel and price comparison are unavailable because no matched sensory evidence or current offers were supplied. Ingredient functions alone do not show personal feel.`,{context:[...profileRefs,...routineRefs]});
 add('F10','unknown','Review themes unavailable','No matched review evidence is available. Review themes and counts cannot be shown yet.');
 return {insights:insights.map(i=>PartFourInsightSchema.parse(i)),comparison:PartFourComparisonSchema.parse(comparison),routineFormulaStates:routineAdmission.items};
}
