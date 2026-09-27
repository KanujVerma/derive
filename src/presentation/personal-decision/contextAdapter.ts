import type { EvaluationInput } from '../../domain/personal-decision/evaluate.ts';
import type { PersonalContextSnapshot, PersonalContextRevision, PersonalExperienceInput, PersonalRoutineItem, ReportedFrequency } from '../../contracts/PersonalContext.ts';
import type { DecisionKnowledge, DecisionBinding } from '../../contracts/PersonalDecision.ts';
import { projectTrustedSnapshot } from './truthAdapter.ts';
import type { TrustedSnapshotEnvelope } from './truthAdapter.ts';
export interface TrustedRoutineFact { itemId:string; productId:string; variantId:string|null; formulaVersionId:string|null; category:DecisionKnowledge<string>; ingredients:DecisionKnowledge<string[]>; sources:Array<{id:string;revision:string}> }
const answer=(value:string):'yes'|'no'|'unknown'|'withheld'=>value==='yes'||value==='no'||value==='withheld'?value:'unknown';
export function evaluationFrequency(f:ReportedFrequency):'daily'|'few_times_weekly'|'weekly'|'occasional'|'unknown' {
 if(f.kind!=='qualitative')return 'unknown';
 switch(f.value){case 'daily':return 'daily';case 'few_times_week':return 'few_times_weekly';case 'weekly':return 'weekly';case 'less_often':case 'as_needed':return 'occasional';case 'most_days':return 'unknown';}
}
export function contextBinding(ownerId:string, envelope:TrustedSnapshotEnvelope,context:PersonalContextSnapshot):DecisionBinding {
 if(context.ownerId!==ownerId)throw new Error('Context owner mismatch');
 const p=projectTrustedSnapshot(envelope), identity=p.identity.state==='known'?p.identity.value:null;
 return {ownerId,productSnapshotId:p.snapshotId,productSnapshotRevision:p.snapshotRevision,sourceBoundaryRevision:p.sourceBoundaryRevision,productId:identity?.productId??null,variantId:identity?.variantId??null,formulaVersionId:p.formula.state==='known'?p.formula.value.formulaVersionId:null,profileRevision:context.profile?.id??null,routineRevision:context.routine?.id??null,historyRevision:context.historyRevision};
}
/** Storage reports remain reports. Verified routine facts are independently server-loaded. */
export function evaluationInput(ownerId:string,envelope:TrustedSnapshotEnvelope,context:PersonalContextSnapshot,events:PersonalContextRevision<PersonalExperienceInput>[],facts:TrustedRoutineFact[],evaluatedAt:string,packetId:string):EvaluationInput {
 const binding=contextBinding(ownerId,envelope,context),profile=context.profile?.data;
 for(const row of [context.profile,context.routine,...events])if(row&&row.ownerId!==ownerId)throw new Error('Context owner mismatch');
 const eventRows=events.filter(e=>e.data.reference.kind==='catalog').flatMap(e=>{const r=e.data.reference;if(r.kind!=='catalog')return [];const outcome=e.data.kind==='reacted'?'reaction':e.data.kind==='ineffective'?'ineffective':e.data.kind==='tolerated'?'tolerated':'no_report';return [{id:e.id,productId:r.productId,variantId:r.variantId,formulaVersionId:r.formulaVersionId,outcome} as const];});
 const normalizeItem=(item:PersonalRoutineItem)=>{
  const r=item.reference; const fact=r.kind==='catalog'?facts.find(f=>f.itemId===item.id&&f.productId===r.productId&&f.variantId===r.variantId&&f.formulaVersionId===r.formulaVersionId):undefined;
  return {id:item.id,productId:r.kind==='catalog'?r.productId:null,variantId:r.kind==='catalog'?r.variantId:null,formulaVersionId:r.kind==='catalog'?r.formulaVersionId:null,category:fact?.category??{state:'unknown' as const,reason:'Routine category unverified'},ingredients:fact?.ingredients??{state:'unknown' as const,reason:'Routine formula unverified'},state:item.state,timing:item.timing,frequency:evaluationFrequency(item.frequency)};
 };
 return {packetId,binding,product:projectTrustedSnapshot(envelope),evaluatedAt,intent:profile?.intent??'unanswered',profile:profile?{ownerId,revision:binding.profileRevision!,primaryGoal:profile.primaryGoal,secondaryGoals:[...profile.secondaryGoals],skinBehavior:profile.skinBehavior,reactivity:profile.reactivity,sensitivities:{state:profile.sensitivities.status==='none_known'||profile.sensitivities.status==='reported'||profile.sensitivities.status==='withheld'?profile.sensitivities.status:'unknown',values:[...profile.sensitivities.values]},treatments:{state:profile.treatments.status==='none'||profile.treatments.status==='reported'||profile.treatments.status==='withheld'?profile.treatments.status:'unknown',values:[...profile.treatments.values]},pregnancy:answer(profile.reproductive.pregnancy),nursing:answer(profile.reproductive.nursing),tryingToConceive:answer(profile.reproductive.tryingToConceive)}:null,routine:context.routine?{ownerId,revision:binding.routineRevision!,completeness:context.routine.data.completeness,sources:facts.flatMap(f=>f.sources),items:context.routine.data.items.map(normalizeItem)}:null,history:binding.historyRevision?{ownerId,revision:binding.historyRevision,events:eventRows}:null};
}
