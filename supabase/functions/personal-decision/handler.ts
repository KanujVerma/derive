import type { PersonalDecisionRequest, PersonalDecisionResponse,DecisionTruthRef } from '../../../src/contracts/PersonalDecisionService.ts';
import type { PersonalContextSnapshot, PersonalContextRevision, PersonalExperienceInput, PersonalExperiencePage } from '../../../src/contracts/PersonalContext.ts';
import type { PersonalDecisionPacketV1, DecisionBinding } from '../../../src/contracts/PersonalDecision.ts';
import { validatePersonalDecisionPacket } from '../../../src/contracts/PersonalDecision.ts';
import { personalDecisionPacketSchema } from '../../../src/presentation/personal-decision/parse.ts';
import { evaluatePersonalDecision } from '../../../src/domain/personal-decision/evaluate.ts';
import { evaluationInput } from '../../../src/presentation/personal-decision/contextAdapter.ts';
import type { TrustedRoutineFact } from '../../../src/presentation/personal-decision/contextAdapter.ts';
import type { TrustedSnapshotEnvelope } from '../../../src/presentation/personal-decision/truthAdapter.ts';
export class DecisionServiceError extends Error { readonly code:string;readonly status:number;constructor(code:string,status:number){super(code);this.code=code;this.status=status;} }
const OPAQUE=/^[^\x00-\x1f\x7f]{1,200}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseDecisionRequest(value:unknown):PersonalDecisionRequest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new DecisionServiceError('INVALID_PAYLOAD',400);
 const r=value as Record<string,unknown>;
 if(Object.keys(r).length!==4||Object.keys(r).some(k=>!['operation','requestId','caseId','snapshotId'].includes(k))||r.operation!=='evaluate'||![r.requestId,r.caseId].every(v=>typeof v==='string'&&UUID.test(v))||typeof r.snapshotId!=='string'||(!OPAQUE.test(r.snapshotId)||r.snapshotId.trim()!==r.snapshotId))throw new DecisionServiceError('INVALID_PAYLOAD',400);
 return {operation:'evaluate',requestId:(r.requestId as string).toLowerCase(),caseId:(r.caseId as string).toLowerCase(),snapshotId:r.snapshotId as string};
}
export interface SavedAssessment { assessmentId:string; input:{request:PersonalDecisionRequest;expectedContextRevision:number;expectedBinding:DecisionBinding;truthRef:DecisionTruthRef;evaluatedFacts:Record<string,unknown>;runtime:'authoritative'|'local_fixture'};packet:PersonalDecisionPacketV1 }
export interface DecisionDependencies {
 runtime:'authoritative'|'local_fixture'; now:()=>string;
 verifyCaseOwner:(ownerId:string,caseId:string)=>Promise<boolean>;
 readSnapshot:(ownerId:string,request:PersonalDecisionRequest)=>Promise<TrustedSnapshotEnvelope|null>;
 readContext:(ownerId:string)=>Promise<PersonalContextSnapshot>;
 readHistory:(ownerId:string,revision:number,productId:string,cursor:string|null)=>Promise<PersonalExperiencePage>;
 readRoutineFacts:(context:PersonalContextSnapshot)=>Promise<TrustedRoutineFact[]>;
 readAssessment:(ownerId:string,requestId:string)=>Promise<SavedAssessment|null>;
 persist:(ownerId:string,requestId:string,input:SavedAssessment['input'],packet:PersonalDecisionPacketV1)=>Promise<{assessmentId:string;packet:PersonalDecisionPacketV1;replayed:boolean}>;
}
export async function evaluateDecisionRequest(ownerId:string,request:PersonalDecisionRequest,deps:DecisionDependencies):Promise<PersonalDecisionResponse> {
 if(!await deps.verifyCaseOwner(ownerId,request.caseId))throw new DecisionServiceError('CASE_NOT_FOUND',404);
 const old=await deps.readAssessment(ownerId,request.requestId);
 if(old){if((['operation','requestId','caseId','snapshotId'] as const).some(key=>old.input.request[key]!==request[key]))throw new DecisionServiceError('IDEMPOTENCY_CONFLICT',409);if(!personalDecisionPacketSchema.safeParse(old.packet).success||old.input.expectedBinding.ownerId!==ownerId||validatePersonalDecisionPacket(old.packet,old.input.expectedBinding).length)throw new DecisionServiceError('ASSESSMENT_UNAVAILABLE',503);return {kind:'ready',ownerId,assessmentId:old.assessmentId,contextRevision:old.input.expectedContextRevision,expectedBinding:old.input.expectedBinding,truthRef:old.input.truthRef,packet:old.packet,replayed:true,runtime:old.input.runtime,snapshotRef:{caseId:request.caseId,snapshotId:request.snapshotId}};}
 const envelope=await deps.readSnapshot(ownerId,request);
 if(!envelope)throw new DecisionServiceError('TRUTH_SNAPSHOT_UNAVAILABLE',503);
 if(envelope.snapshot.resolutionCaseId!==request.caseId||envelope.snapshot.snapshotId!==request.snapshotId)throw new DecisionServiceError('TRUTH_SNAPSHOT_UNAVAILABLE',503);
 const context=await deps.readContext(ownerId);
 if(context.ownerId!==ownerId)throw new DecisionServiceError('CONTEXT_OWNER_MISMATCH',403);
 const evaluatedContextRevision=context.revision;
 const products=new Set<string>();if(envelope.snapshot.product?.productId)products.add(envelope.snapshot.product.productId);
 for(const item of context.routine?.data.items??[])if((item.state==='current'||item.state==='occasional')&&item.reference.kind==='catalog')products.add(item.reference.productId);
 const events=new Map<string,PersonalContextRevision<PersonalExperienceInput>>();
 for(const productId of products){let cursor:string|null=null;const seen=new Set<string>();do {const page=await deps.readHistory(ownerId,evaluatedContextRevision,productId,cursor);if(page.atRevision!==evaluatedContextRevision)throw new DecisionServiceError('STALE_CONTEXT',409);for(const event of page.items)events.set(event.id,event);cursor=page.nextCursor;if(cursor&&seen.has(cursor))throw new DecisionServiceError('HISTORY_UNAVAILABLE',503);if(cursor)seen.add(cursor);}while(cursor);}
 const routineFacts=await deps.readRoutineFacts(context);
 const evaluation=evaluationInput(ownerId,envelope,context,[...events.values()],routineFacts,deps.now(),request.requestId);
 const packet=evaluatePersonalDecision(evaluation);
 if(!personalDecisionPacketSchema.safeParse(packet).success)throw new DecisionServiceError('ASSESSMENT_UNAVAILABLE',503);
 const persistedInput:SavedAssessment['input']={request,expectedContextRevision:evaluatedContextRevision,expectedBinding:evaluation.binding,truthRef:{caseId:envelope.snapshot.resolutionCaseId,snapshotId:envelope.snapshot.snapshotId,caseRevision:envelope.snapshot.caseRevision,resolverVersion:envelope.snapshot.resolverVersion,sourceBoundaryRevision:evaluation.binding.sourceBoundaryRevision,categoryBoundaryRevision:envelope.categoryBoundaryRevision??null},evaluatedFacts:{product:evaluation.product,routine:routineFacts.map(({ingredients,...fact})=>({...fact,formulaEvidence:ingredients.state==='known'?{state:'known',sourceIds:ingredients.sourceIds}:{state:ingredients.state}}))},runtime:deps.runtime};
 const stored=await deps.persist(ownerId,request.requestId,persistedInput,packet);
 if(validatePersonalDecisionPacket(stored.packet,evaluation.binding).length)throw new DecisionServiceError('ASSESSMENT_UNAVAILABLE',503);
 return {kind:'ready',ownerId,contextRevision:evaluatedContextRevision,expectedBinding:evaluation.binding,truthRef:persistedInput.truthRef,packet:stored.packet,assessmentId:stored.assessmentId,replayed:stored.replayed,runtime:deps.runtime,snapshotRef:{caseId:request.caseId,snapshotId:request.snapshotId}};
}
