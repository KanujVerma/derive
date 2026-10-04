import {isReviewedUsefulnessManifest} from './reviewedHostedUsefulness.ts';
import {REVIEWED_USEFULNESS_MANIFEST} from './reviewedUsefulness.ts';
import { PartFourPacketSchema, type PartFourPacket } from '../../contracts/PartFour.ts';
import type { PersonalResultV2 } from '../../contracts/PersonalResultV2.ts';
import { analyzeFormula } from './formula.ts';
import { buildFoundationInsights, type FoundationInput } from './foundations.ts';
import { PART_FOUR_RELEASE, partFourBindingRelease } from './release.ts';
import { APPROVED_INGREDIENT_KNOWLEDGE, APPROVED_37_INGREDIENT_KNOWLEDGE } from './knowledge.ts';
import { ISOLATED_423_EDUCATION } from './knowledge423.ts';
import { canonicalJson } from '../part-two/hash.ts';
import { createRetainedEvidence } from './retainedEvidence.ts';
import { RoutineFormulaEvidenceSchema } from '../../contracts/RoutineFormula.ts';
/** Optional source adapters are deliberately absent until permission-qualified.
 * This produces a foundation packet, never a claim of full Part 4 capability. */
export function assembleFoundation(input:FoundationInput,result:PersonalResultV2):PartFourPacket|null {
 const raw=result.binding.releases.partFour;
 if(input.composition==='reviewed_usefulness'&&(!isReviewedUsefulnessManifest(input.scientificManifest?.contentHash)||raw?.scientificManifestHash!==input.scientificManifest?.contentHash))return null;
 const selected=raw?{releaseId:raw.releaseId,releaseHash:raw.releaseHash,knowledgeVersion:raw.knowledgeVersion,knowledgeHash:raw.knowledgeHash}:undefined;
 const matches=(selection?:'approved47'|'approved423')=>{const {scientificManifestHash:_,...expected}=partFourBindingRelease(selection,raw?.scientificManifestHash,input.composition);return canonicalJson(selected)===canonicalJson(expected);};
 const knowledge=matches('approved423')?ISOLATED_423_EDUCATION:matches('approved47')?APPROVED_INGREDIENT_KNOWLEDGE:matches()?APPROVED_37_INGREDIENT_KNOWLEDGE:null;
 if(!knowledge)return null;
 const formula=analyzeFormula(input.partTwo,{knowledge,now:result.evaluatedAt,expectedBinding:{bindingKey:result.binding.partTwoBindingKey,resultRevision:result.binding.partTwoRevision,dependencyDigest:result.binding.sourceDigest}});
 if(!formula)return null;
 const {insights,comparison}=buildFoundationInsights({...input,knowledge,now:result.evaluatedAt});
 const science=input.scientificDecision;
 if(science){for(const row of science.assessments){const a=row.assessment;if(a.state==='mismatch')continue;insights.push({id:`science:${a.claimId}:${row.goal??'routine'}`,ruleId:a.family,state:a.state==='supported'?'supported':a.state==='reference'?'limited':a.state==='contradiction'?'conflict':'unknown',title:row.goal?`${row.goal.replaceAll('_',' ')} evidence`:'Routine and use evidence',explanation:a.reason?[a.reason,...a.reasons].join(' '):a.state==='contradiction'?'Evidence relevant to this goal or routine use disagrees. Resolve that conflict before deciding.':a.state==='unknown'?'The required amount, formula or use details are not established for this evidence. Known ingredient functions remain available.':'Checked evidence applicable to this goal or routine use is unavailable.',action:a.action,contextRevisionIds:a.contextRevisionIds,factIds:a.factIds,occurrenceIds:[],sourceIds:a.sourceIds});}}
 const p=input.context.profile?.data;
 const goals=[...(p?.primaryGoal.state==='known'?[p.primaryGoal.value]:[]),...(p?.secondaryGoals??[])];
 const needsBenefitEvidence=science?science.unresolvedGoals.length>0:goals.some(g=>!['simplify','maintain'].includes(g))&&!result.findings.some(f=>f.kind==='current_help'&&f.supportState==='supported');
 const positive=result.summary?.judgment==='worth_considering';
 const reportConflict=input.composition==='reviewed_usefulness'&&insights.some(i=>i.ruleId==='F04'&&i.state==='conflict');
 const conflict=reportConflict||formula.evidenceState==='conflict'||!!science?.assessments.some(row=>row.assessment.state==='contradiction');
 const decisionState=conflict?'conflict':positive&&needsBenefitEvidence?'pending':result.summary&&result.summary.judgment!=='not_enough_info'?'supported':'pending';
 const scientificAction=result.findings.find(f=>f.id===result.summary?.primaryFindingId)?.scientificEvidence?.action;
 const overridingConcern=conflict||result.findings.some(f=>['decisive','concern'].includes(f.consequence));
 if(overridingConcern)for(const insight of insights)if(insight.ruleId==='F04'||insight.ruleId==='F09'||insight.id==='foundation:F01:ingredient_relevance')insight.action=null;
 const feelAction=!overridingConcern?insights.find(i=>i.id==='foundation:F09:reported_feel'&&i.action)?.action:null;
 const reportedAction=!overridingConcern?insights.find(i=>i.ruleId==='F04'&&i.action)?.action:null;
 const relevanceAction=!overridingConcern?insights.find(i=>i.id==='foundation:F01:ingredient_relevance')?.action:null;
 const action=decisionState==='supported'&&scientificAction?scientificAction:decisionState==='conflict'?(reportConflict?'Review the current product reports and their dates before deciding.':'Review the conflicting formula evidence before deciding.'):decisionState==='pending'?(feelAction??reportedAction??relevanceAction??'Review the missing deciding evidence before changing this step. Current helpfulness is not assumed.'):result.summary?.judgment==='skip'?'Choose a suitable option that respects the confirmed concern.':result.summary?.judgment==='check_first'?'Review the reported concern before trying this product.':result.summary?.displayVariant==='worth_keeping'?'Keep this step if your reported benefit and use are still current.':input.intent==='replace'?'Review this replacement against the current step before changing your routine.':'Review the supported reason before adding this step.';
 return PartFourPacketSchema.parse({version:'part-four-foundations/v1',releaseId:PART_FOUR_RELEASE.id,formula,insights,comparison,routineEvidence:(input.routineFormulaEvidence??input.routineFormulas?.map(item=>item.evidence)??[]).map(item=>RoutineFormulaEvidenceSchema.parse(item)),...(science?{scientificDecision:science}:{}),retainedEvidence:createRetainedEvidence(science&&input.scientificManifest?{science:{manifest:input.scientificManifest,packet:science}}:{},{now:result.evaluatedAt}),reviews:{state:'unavailable',explanation:'Selected-source reports are unavailable until a checked, eligible product-specific brief is admitted. No review consensus is inferred.',sourceIds:[]},value:{state:'unavailable',explanation:'Current product and unit prices are unavailable until eligible comparable offers are admitted. No cheaper winner is inferred.',sourceIds:[]},requiredEvidence:['G01','G02','G03','G04','G05'],decisionState,action,contextRevision:input.context.revision});
}
