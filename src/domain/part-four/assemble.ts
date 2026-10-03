import { PartFourPacketSchema, type PartFourPacket } from '../../contracts/PartFour.ts';
import type { PersonalResultV2 } from '../../contracts/PersonalResultV2.ts';
import { analyzeFormula } from './formula.ts';
import { buildFoundationInsights, type FoundationInput } from './foundations.ts';
import { PART_FOUR_RELEASE } from './release.ts';
import { createRetainedEvidence } from './retainedEvidence.ts';
import { RoutineFormulaEvidenceSchema } from '../../contracts/RoutineFormula.ts';
/** Optional source adapters are deliberately absent until permission-qualified.
 * This produces a foundation packet, never a claim of full Part 4 capability. */
export function assembleFoundation(input:FoundationInput,result:PersonalResultV2):PartFourPacket|null {
 const formula=analyzeFormula(input.partTwo,{now:result.evaluatedAt,expectedBinding:{bindingKey:result.binding.partTwoBindingKey,resultRevision:result.binding.partTwoRevision,dependencyDigest:result.binding.sourceDigest}});
 if(!formula)return null;
 const {insights,comparison}=buildFoundationInsights({...input,now:result.evaluatedAt});
 const p=input.context.profile?.data;
 const goals=[...(p?.primaryGoal.state==='known'?[p.primaryGoal.value]:[]),...(p?.secondaryGoals??[])];
 const needsBenefitEvidence=goals.some(g=>!['simplify','maintain'].includes(g))&&!result.findings.some(f=>f.kind==='current_help'&&f.supportState==='supported');
 const positive=result.summary?.judgment==='worth_considering';
 const conflict=formula.evidenceState==='conflict';
 const decisionState=conflict?'conflict':positive&&needsBenefitEvidence?'pending':result.summary&&result.summary.judgment!=='not_enough_info'?'supported':'pending';
 const action=decisionState==='conflict'?'Review the conflicting formula evidence before deciding.':decisionState==='pending'?'Keep your current choice while the deciding evidence is unresolved.':result.summary?.judgment==='skip'?'Choose a suitable option that respects the confirmed concern.':result.summary?.judgment==='check_first'?'Review the reported concern before trying this product.':result.summary?.displayVariant==='worth_keeping'?'Keep this step if your reported benefit and use are still current.':input.intent==='replace'?'Review this replacement against the current step before changing your routine.':'Review the supported reason before adding this step.';
 return PartFourPacketSchema.parse({version:'part-four-foundations/v1',releaseId:PART_FOUR_RELEASE.id,formula,insights,comparison,routineEvidence:(input.routineFormulaEvidence??input.routineFormulas?.map(item=>item.evidence)??[]).map(item=>RoutineFormulaEvidenceSchema.parse(item)),retainedEvidence:createRetainedEvidence({},{now:result.evaluatedAt}),reviews:{state:'unavailable',explanation:'Selected-source reports are unavailable until a checked, eligible product-specific brief is admitted. No review consensus is inferred.',sourceIds:[]},value:{state:'unavailable',explanation:'Current product and unit prices are unavailable until eligible comparable offers are admitted. No cheaper winner is inferred.',sourceIds:[]},requiredEvidence:['G01','G02','G03','G04','G05'],decisionState,action,contextRevision:input.context.revision});
}
