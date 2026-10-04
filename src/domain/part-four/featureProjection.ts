import {ScientificManifestSchema,ScientificFeaturesEnvelopeSchema,type ScientificManifest,type ClaimFeature,type ClaimField} from '../../contracts/ScientificClaim.ts';
import {NormalizationResultSchema,type NormalizationResult,type PartTwoFact} from '../../contracts/PartTwo.ts';
import {personalContextV2Schema} from '../../contracts/PersonalContextV2Schema.ts';
import type {PersonalContextV2} from '../../contracts/PersonalContextV2.ts';
import type {DecisionBindingV2} from '../../contracts/PersonalResultV2.ts';
import type {PersonalEvaluationInput} from '../part-three/evaluate.ts';
import {purposeFacts} from '../part-three/projection.ts';
import {scientificManifestHash} from './scientificDecision.ts';
import {canonicalJson} from '../part-two/hash.ts';
const targets:Record<string,readonly string[]>={'G01-01':['dryness'],'G01-02':['dryness'],'G02-01':['oiliness'],'G02-02':['breakouts'],'G03-01':['fine_lines','dark_spots'],'G03-02':['fine_lines']};
const endpoints:Record<string,string>={'G01-01:dryness':'hydration','G01-02:dryness':'barrier-related-measurements','G02-01:oiliness':'sebum-excretion-4-week-study','G02-02:breakouts':'acne-medication-adjunct','G03-01:fine_lines':'fine-lines-wrinkles','G03-01:dark_spots':'hyperpigmented-spots','G03-02:fine_lines':'photoaging-prevention'};
/** Called only with the handler's authorized normalization, context and binding.
 * This projects observed values, never study-equivalence tokens. Ingredient
 * education, names, free text, membership and order cannot supply scientific
 * bridge, population, medication indication, chemical form or final pH. */
export function projectScientificFeatures(input:{manifest:ScientificManifest;binding:DecisionBindingV2;partTwo:NormalizationResult;context:PersonalContextV2;requestedUse:PersonalEvaluationInput['requestedUse'];now:string}) {
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
   // Catalog UUIDs remain literal; historical descriptive IDs do not match them.
   if(b.subject.kind==='declaration'){for(const field of ['productId','variantId','formulaVersionId'] as const)if(field in features&&b.subject[field])features[field]=known([b.subject[field]!],facts.filter(f=>f.subject.kind==='bound_declaration_entry'||f.subject.kind==='bound_label_assertion'));}
   rows.push({claimId:claim.id,goal,features});
  }
 }
 return ScientificFeaturesEnvelopeSchema.parse({ownerId:c.ownerId,partTwoBindingKey:p.bindingKey,partTwoRevision:p.resultRevision,sourceDigest:b.sourceDigest,contextRevision:c.revision,manifestHash:m.contentHash,claims:rows});
}
