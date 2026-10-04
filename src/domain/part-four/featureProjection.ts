import {ScientificManifestSchema,ScientificFeaturesEnvelopeSchema,type ScientificManifest,type ClaimFeature,type ClaimField} from '../../contracts/ScientificClaim.ts';
import {NormalizationResultSchema,type NormalizationResult,type PartTwoFact} from '../../contracts/PartTwo.ts';
import {personalContextV2Schema} from '../../contracts/PersonalContextV2Schema.ts';
import type {PersonalContextV2,ReportedUseContextV2,ReportedDate} from '../../contracts/PersonalContextV2.ts';
import type {DecisionBindingV2} from '../../contracts/PersonalResultV2.ts';
import type {PersonalEvaluationInput} from '../part-three/evaluate.ts';
import {purposeFacts} from '../part-three/projection.ts';
import {scientificManifestHash} from './scientificDecision.ts';
import {canonicalJson} from '../part-two/hash.ts';
import {admitRoutineFormulaEvidence} from './routineFormula.ts';
import type {IngredientKnowledgeRelease} from './knowledge.ts';
import {AHA_SUN_PLAN_CLAIM_ID} from './reviewedAha.ts';

/** Exact reviewed literals only. This does not classify free text, infer an
 * exfoliant from acid presence, or promote a manual name into a label fact. */
function literalPurposeFacts(p:NormalizationResult,literals:readonly string[],clock:number):PartTwoFact[] {
 if(p.state!=='ready'||p.output.kind!=='bound'||p.output.productFacts.binding.kind!=='declaration'||Date.parse(p.expiresAt)<=clock)return [];
 const s=p.output.productFacts;
 if(['blocked','conflict'].includes(s.evidenceState))return [];
 return s.labelAssertions.flatMap(a=>{
  if(a.assertionKind!=='purpose'||!literals.includes(a.text)||a.transcription!=='clear'||a.conditional!==null||!a.fieldPermission.permitted||Date.parse(a.fieldPermission.expiresAt)<=clock||a.fieldPermission.policyEpoch!==s.dependencyManifest.policyEpoch)return [];
  const source=s.dependencyManifest.sourceRefs.find(r=>r.observationId===a.span.observationId&&r.sourceRevision===a.span.sourceRevision&&r.policyId===a.fieldPermission.policyId&&r.policyVersion===a.fieldPermission.policyVersion&&r.permitted&&Date.parse(r.expiresAt)>clock);
  const fact=s.facts.find(f=>f.kind==='product_label_assertion'&&f.subject.assertionId===a.assertionId&&f.value.assertionKind==='purpose'&&f.value.text===a.text&&f.sourceDependencies.includes(a.span.observationId)&&Date.parse(f.validUntil)>clock);
  return source&&fact?[fact]:[];
 });
}
function dateRange(d:ReportedDate):[string,string]|null {
 if(d.state!=='known')return null;
 const {value,precision}=d.value;
 if(precision==='day')return [value,value];
 if(precision==='year')return [value+'-01-01',value+'-12-31'];
 const end=new Date(value+'-01T00:00:00.000Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 return [value+'-01',end.toISOString().slice(0,10)];
}
/** Partial date precision is retained. Unknown dates are not invented; an
 * entirely future start or already-ended period contradicts a current plan. */
function currentPlanDates(use:ReportedUseContextV2,clock:number):boolean {
 const today=new Date(clock).toISOString().slice(0,10),start=dateRange(use.startedOn),stop=dateRange(use.stoppedOn);
 return (!start||start[0]<=today)&&(!stop||stop[1]>today);
}
const targets:Record<string,readonly string[]>={'G01-03-reviewed-barrier-reference-v1':['dryness'],'G03-03-reviewed-photoaging-reference-v1':['fine_lines','dark_spots'],'G01-01':['dryness'],'G01-02':['dryness'],'G02-01':['oiliness'],'G02-02':['breakouts'],'G03-01':['fine_lines','dark_spots'],'G03-02':['fine_lines']};
const endpoints:Record<string,string>={'G01-03-reviewed-barrier-reference-v1:dryness':'barrier-related-measurements','G03-03-reviewed-photoaging-reference-v1:fine_lines':'fine-lines-wrinkles','G03-03-reviewed-photoaging-reference-v1:dark_spots':'hyperpigmented-spots','G01-01:dryness':'hydration','G01-02:dryness':'barrier-related-measurements','G02-01:oiliness':'sebum-excretion-4-week-study','G02-02:breakouts':'acne-medication-adjunct','G03-01:fine_lines':'fine-lines-wrinkles','G03-01:dark_spots':'hyperpigmented-spots','G03-02:fine_lines':'photoaging-prevention'};
/** Called only with the handler's authorized normalization, context and binding.
 * This projects observed values, never study-equivalence tokens. Ingredient
 * education, names, free text, membership and order cannot supply scientific
 * bridge, population, medication indication, chemical form or final pH. */
export function projectScientificFeatures(input:{manifest:ScientificManifest;binding:DecisionBindingV2;partTwo:NormalizationResult;context:PersonalContextV2;requestedUse:PersonalEvaluationInput['requestedUse'];routineFormulaEvidence?:readonly unknown[];knowledge?:IngredientKnowledgeRelease;now:string}) {
 const m=ScientificManifestSchema.parse(input.manifest),p=NormalizationResultSchema.parse(input.partTwo),c=personalContextV2Schema.parse(input.context),b=input.binding,clock=Date.parse(input.now);
 if(!Number.isFinite(clock)||p.state!=='ready'||Date.parse(p.expiresAt)<=clock)throw Error('Scientific normalization unavailable or expired');
 if(m.contentHash!==scientificManifestHash(m)||b.ownerId!==c.ownerId||p.authenticatedOwnerId!==c.ownerId||b.contextRevision!==c.revision||b.profileRevision!==(c.profile?.id??null)||b.routineRevision!==(c.routine?.id??null)||canonicalJson(b.encounterInputs.use)!==canonicalJson(input.requestedUse)||b.partTwoBindingKey!==p.bindingKey||b.partTwoRevision!==p.resultRevision||b.sourceDigest!==p.output.reading.dependencyManifest.dependencyDigest)throw Error('Scientific projection binding mismatch');
 if(['conflict','blocked'].includes(p.output.reading.evidenceState)||p.output.kind==='bound'&&['conflict','blocked'].includes(p.output.productFacts.evidenceState))throw Error('Scientific formula authority conflict');
 const snapshot=p.output.kind==='bound'?p.output.productFacts:p.output.reading;
 const facts=snapshot.facts.filter(f=>Date.parse(f.validUntil)>clock),until=p.expiresAt;
 const known=(values:string[],fs:PartTwoFact[]=[],contexts:string[]=[]):ClaimFeature=>({state:values.length?'known':'unknown',values:values.length?[...new Set(values)]:null,factIds:fs.map(f=>f.factId),contextRevisionIds:contexts,sourceIds:[...new Set(fs.flatMap(f=>f.sourceDependencies))],validUntil:new Date(Math.min(Date.parse(until),...fs.map(f=>Date.parse(f.validUntil)))).toISOString()});
 const unknown=():ClaimFeature=>({state:'unknown',values:null,factIds:[],contextRevisionIds:[],sourceIds:[],validUntil:until});
 const goals=[...new Set([...(c.profile?.data.primaryGoal.state==='known'?[c.profile.data.primaryGoal.value]:[]),...(c.profile?.data.secondaryGoals??[])])];
 const purpose=purposeFacts(p,b,clock);
 const current=input.binding.encounterInputs.candidateRoutineItemId?c.routine?.data.items.find(i=>i.id===input.binding.encounterInputs.candidateRoutineItemId):null;
 const currentExact=current?.reference.kind==='catalog'&&b.subject.kind==='declaration'&&current.reference.productId===b.subject.productId&&current.reference.variantId===b.subject.variantId&&current.reference.formulaVersionId!==null&&current.reference.formulaVersionId===b.subject.formulaVersionId;
 const rows=[];
 for(const claim of m.claims){
  const relevant=targets[claim.id]?.filter(g=>goals.includes(g as typeof goals[number]))??(claim.family==='G04'||claim.family==='G05'?[null]:[]);
  for(const goal of relevant){
   const features:Partial<Record<ClaimField,ClaimFeature>>=Object.fromEntries(claim.applicability.map(predicate=>[predicate.field,unknown()]));
   const ingredient=claim.applicability.find(a=>a.field==='ingredientId');
   const identities=facts.filter(f=>f.kind==='resolved_ingredient_identity'&&ingredient?.expected.includes(f.value.ingredientId)&&snapshot.occurrences.some(o=>o.occurrenceId===f.occurrenceId&&o.modality==='unconditional'&&o.transcription==='clear'));
   if(ingredient&&identities.length)features.ingredientId=known(identities.flatMap(f=>f.kind==='resolved_ingredient_identity'?[f.value.ingredientId]:[]),identities);
   const ids=new Set(identities.flatMap(f=>f.kind==='resolved_ingredient_identity'?[f.occurrenceId]:[]));
   const amounts=facts.filter(f=>f.kind==='declared_quantity'&&ids.has(f.occurrenceId)&&f.value.status==='validated'&&f.value.subject==='ingredient'&&f.value.operator==='exact'&&f.value.unit==='%'&&f.value.value!==null);
   if(amounts.length){if('amountPercent' in features)features.amountPercent=known(amounts.flatMap(f=>f.kind==='declared_quantity'&&f.value.value?[f.value.value]:[]),amounts);if('amountSubject' in features)features.amountSubject=known(['named-active-ingredient-percent'],amounts);}
   // Basis equivalence to a paper remains an independent review, even with a
   // printed w/w value. Group/blend/range percentages never become this amount.
   if('site' in features&&input.requestedUse.site)features.site=known([input.requestedUse.site],[],[b.encounterId]);
   if('useForm' in features&&input.requestedUse.useForm){const form=input.requestedUse.useForm==='leave_on'?'leave-on':input.requestedUse.useForm==='rinse_off'?'rinse-off':'other';features.useForm=known([form],[],[b.encounterId]);}
   const labelPurposeFacts=facts.filter(f=>purpose.some(v=>v.partTwoFactId===f.factId));
   if('useForm' in features&&purpose.length){const values=purpose.map(v=>v.useForm==='leave_on'?v.purposeId==='moisturizing'?'leave-on-moisturizer':'leave-on':'rinse-off');features.useForm=known(values,labelPurposeFacts);if(input.requestedUse.useForm&&purpose.some(v=>v.useForm!==input.requestedUse.useForm))features.useForm.state='contradiction';}
   if(currentExact&&current&&c.routine){if('duration' in features&&current.duration)features.duration=known([`${current.duration.count}-${current.duration.unit}`],[],[c.routine.id]);if('frequency' in features&&current.frequency.kind==='exact')features.frequency=known([current.frequency.unit==='day'&&current.frequency.count===2?'twice-daily':`${current.frequency.count}-per-${current.frequency.unit}`],[],[c.routine.id]);}
   if('endpoint' in features&&goal&&endpoints[`${claim.id}:${goal}`]&&c.profile)features.endpoint=known([endpoints[`${claim.id}:${goal}`]],[],[c.profile.id]);
   if(claim.id===AHA_SUN_PLAN_CLAIM_ID){
    const label=literalPurposeFacts(p,['AHA exfoliant','Alpha hydroxy acid exfoliant'],clock);
    if(label.length)features.purpose=known(['cosmetic-AHA-exfoliant-verified'],label);
    // Reuse authenticated-worker admission rather than accepting names,
    // membership, client-provided grants or unbound formula arrays.
    const admission=admitRoutineFormulaEvidence(c,input.routineFormulaEvidence??[],{now:input.now,knowledge:input.knowledge});
    const sun=admission.qualified.find(q=>{
     const item=c.routine?.data.items.find(i=>i.id===q.routineItemId);
     return item?.state==='current'&&currentPlanDates(item,clock)&&item.reportedPurpose?.answer.state==='known'&&item.reportedPurpose.answer.value==='sun_protection'&&item.applicationSite?.answer.state==='known'&&item.applicationSite.answer.value==='face'&&item.useForm?.answer.state==='known'&&item.useForm.answer.value==='leave_on'&&['am','both'].includes(item.timing)&&(item.frequency.kind==='exact'&&item.frequency.unit==='day'&&item.frequency.count>=1||item.frequency.kind==='qualitative'&&item.frequency.value==='daily')&&literalPurposeFacts(q.partTwo,['Sunscreen'],clock).length>0;
    });
    // `not_established` describes this bounded evidence lookup. It does not
    // claim that the person has no sunscreen or is exposed to sunlight.
    features.routineSunProtection=known([sun?'reported_plan_established':'not_established'],[],[c.routine?.id??b.encounterId]);
    if(sun)features.routineSunProtection.validUntil=new Date(Math.min(Date.parse(until),Date.parse(sun.validUntil),...literalPurposeFacts(sun.partTwo,['Sunscreen'],clock).map(f=>Date.parse(f.validUntil)))).toISOString();
   }
   // Catalog UUIDs remain literal; historical descriptive IDs do not match them.
   if(b.subject.kind==='declaration'){for(const field of ['productId','variantId','formulaVersionId'] as const)if(field in features&&b.subject[field])features[field]=known([b.subject[field]!],facts.filter(f=>f.subject.kind==='bound_declaration_entry'||f.subject.kind==='bound_label_assertion'));}
   rows.push({claimId:claim.id,goal,features});
  }
 }
 return ScientificFeaturesEnvelopeSchema.parse({ownerId:c.ownerId,partTwoBindingKey:p.bindingKey,partTwoRevision:p.resultRevision,sourceDigest:b.sourceDigest,contextRevision:c.revision,manifestHash:m.contentHash,claims:rows});
}
