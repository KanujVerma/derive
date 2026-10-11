import {assertProcessingJson,logicalProcessingHash,logicalFactsFirstHash,type ProcessingPhase} from './processingContract.ts';
import {validateDecisionCheckpoint,type DecisionCheckpoint} from './factsFirstContract.ts';
import {basisHash,validateProposal,type InsightInput,type InsightProposal} from './insightPacket.ts';
import {digest} from './evidenceAdmission.ts';
import type {SafeModelInput} from './orchestrator.ts';

export interface GenerationCheckpoint {proposal:InsightProposal;resolvedModel:string}
export interface ReviewCheckpoint {
  proposalHash:string;inputHash:string;resolvedModel:string;
  supported:boolean;contradicted:boolean;personalContextMatched:boolean;
}
export interface ProcessingCall {
  callId:string;phase:ProcessingPhase;state:'reserved'|'dispatched_unknown'|'settled'|'released';
  outcome:null|'completed'|'provider_failed'|'invalid_response'|'outcome_unknown'|'not_dispatched';
  requestHash:string;proposalHash:string|null;model:string;
}
export interface CanonicalProcessingOperation {
  pipelineVersion?:'legacy/v1'|'facts-first/v1';decision?:DecisionCheckpoint|null;publishedPacketHash?:string|null;
  operationId:string;evaluationId:string;operationHash:string;basisHash:string;
  expiresAt:string;executionEpoch:number;input:InsightInput;
  generation:GenerationCheckpoint|null;review:ReviewCheckpoint|null;phases:ProcessingCall[];
}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function exact(value:unknown,keys:string[]):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_processing_read');
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((k,i)=>k!==expected[i]))throw Error('invalid_processing_read');
  return value as Record<string,unknown>;
}

/** A minimized projection is data, not a grant to transmit it. Callers must
 * obtain exact processing authority independently before any provider request. */
export function personalizedProcessingProjection(input:InsightInput):SafeModelInput {
  return structuredClone({purpose:'personalized_product_decision',dataMode:input.dataMode,
    productContext:input.productContext,personalFacts:input.personalFacts.map(f=>({id:f.id,text:f.text})),
    evidence:input.evidence.map(e=>({id:e.claim.id,kind:e.claim.kind,quote:e.claim.quote.text,
      scope:e.claim.scope,applicability:e.claim.applicability})),allowedActions:input.allowedActions,
    mandatoryCautionIds:input.mandatoryCautionIds,
    questions:input.allowedQuestions.map(q=>({id:q.id,prompt:q.prompt,options:q.options}))});
}

/** Parse only the result of the authenticated service RPC. This validates and
 * adopts its canonical E1 receipt, rather than retaining a newly created E2's
 * lease or rewriting stored content. It never authorizes network transmission. */
export async function parseCanonicalProcessingOperation(raw:unknown,expected:{
  ownerId:string;resultId:string;resultRevision:number;input:InsightInput;now:string;
  requiredPipeline?:'legacy/v1'|'facts-first/v1';
}):Promise<CanonicalProcessingOperation> {
  assertProcessingJson(raw);
  const versioned=!!raw&&typeof raw==='object'&&Object.hasOwn(raw,'pipelineVersion');
  const r=exact(raw,['kind','operationId','evaluationId','operationHash','basisHash','input','generation','review','phases','expiresAt','executionEpoch',
    ...(versioned?['pipelineVersion','decision','publishedPacketHash']:[])]);
  const pipeline=versioned?r.pipelineVersion:'legacy/v1';
  if(!['legacy/v1','facts-first/v1'].includes(String(pipeline))||expected.requiredPipeline&&pipeline!==expected.requiredPipeline)
    throw Error('processing_pipeline_changed');
  const logicalHash=pipeline==='facts-first/v1'?logicalFactsFirstHash:logicalProcessingHash;
  if(versioned&&r.publishedPacketHash!==null&&!hash(r.publishedPacketHash))throw Error('invalid_publication_receipt');
  if(r.kind!=='operation'||!uuid(r.operationId)||!uuid(r.evaluationId)||!hash(r.operationHash)||!hash(r.basisHash)
    ||!date(r.expiresAt)||typeof r.executionEpoch!=='number'||!Number.isSafeInteger(r.executionEpoch)||r.executionEpoch<0
    ||!date(expected.now)||!Array.isArray(r.phases)||r.phases.length>(pipeline==='facts-first/v1'?3:2))throw Error('invalid_processing_read');
  const input=structuredClone(r.input) as InsightInput;
  if(input?.basis?.ownerId!==expected.ownerId||expected.input.basis.ownerId!==expected.ownerId
    ||logicalHash(expected.resultId,expected.resultRevision,input)!==r.operationHash
    ||logicalHash(expected.resultId,expected.resultRevision,expected.input)!==r.operationHash
    ||await basisHash(input)!==r.basisHash||Date.parse(input.now)>Date.parse(expected.now)
    ||Date.parse(input.validUntil)<=Date.parse(expected.now)
    ||Date.parse(input.validUntil)>Date.parse(expected.input.validUntil)
    ||Date.parse(r.expiresAt)>Date.parse(input.validUntil))throw Error('processing_canonical_basis_changed');
  const phases:ProcessingCall[]=r.phases.map(value=>{
    const c=exact(value,['callId','phase','state','outcome','requestHash','proposalHash','model']);
    if(!uuid(c.callId)||!(pipeline==='facts-first/v1'?['decision','generation','copy_review']:['generation','copy_review']).includes(String(c.phase))
      ||!['reserved','dispatched_unknown','settled','released'].includes(String(c.state))
      ||c.outcome!==null&&!['completed','provider_failed','invalid_response','outcome_unknown','not_dispatched'].includes(String(c.outcome))
      ||!hash(c.requestHash)||typeof c.model!=='string'||!c.model.trim()||c.model.length>200
      ||(c.phase!=='copy_review'?c.proposalHash!==null:!hash(c.proposalHash)))throw Error('invalid_processing_phase');
    if((c.state==='reserved'||c.state==='dispatched_unknown')&&c.outcome!==null
      ||c.state==='released'&&c.outcome!=='not_dispatched'
      ||c.state==='settled'&&(c.outcome===null||c.outcome==='not_dispatched'))throw Error('invalid_processing_phase');
    return structuredClone(c) as unknown as ProcessingCall;
  });
  if(new Set(phases.map(c=>c.phase)).size!==phases.length||new Set(phases.map(c=>c.callId)).size!==phases.length)throw Error('duplicate_processing_phase');
  let decision:DecisionCheckpoint|null=null;
  if(pipeline==='facts-first/v1'&&r.decision!==null){
    const call=phases.find(c=>c.phase==='decision');
    if(!call||call.state!=='settled'||call.outcome!=='completed')throw Error('unconfirmed_decision');
    decision=await validateDecisionCheckpoint(input,r.decision,call.model);
  }else if(versioned&&pipeline==='legacy/v1'&&r.decision!==null)throw Error('unexpected_decision_checkpoint');
  if(pipeline==='facts-first/v1'&&!decision&&phases.some(c=>c.phase!=='decision'))throw Error('decision_not_settled');
  let generation:GenerationCheckpoint|null=null,review:ReviewCheckpoint|null=null;
  if(r.generation!==null){
    const g=exact(r.generation,['proposal','resolvedModel']),call=phases.find(c=>c.phase==='generation');
    if(!call||call.state!=='settled'||call.outcome!=='completed'||g.resolvedModel!==call.model)throw Error('unconfirmed_generation');
    generation={proposal:structuredClone(validateProposal(input,g.proposal as InsightProposal)),resolvedModel:call.model};
    if(pipeline==='facts-first/v1'&&generation.proposal.action!==decision?.action)throw Error('writer_changed_decision');
  }
  if(r.review!==null){
    const v=exact(r.review,['proposalHash','inputHash','resolvedModel','supported','contradicted','personalContextMatched']);
    const call=phases.find(c=>c.phase==='copy_review');
    if(!generation||!call||call.state!=='settled'||call.outcome!=='completed'||v.resolvedModel!==call.model
      ||v.proposalHash!==call.proposalHash||v.proposalHash!==await digest(generation.proposal)
      ||v.inputHash!==await digest(personalizedProcessingProjection(input))
      ||['supported','contradicted','personalContextMatched'].some(k=>typeof v[k]!=='boolean'))throw Error('unconfirmed_review');
    review=structuredClone(v) as unknown as ReviewCheckpoint;
  }
  if(pipeline==='facts-first/v1'&&r.publishedPacketHash!==null&&(!decision||!generation||!review))throw Error('unconfirmed_publication');
  return {operationId:r.operationId,evaluationId:r.evaluationId,operationHash:r.operationHash,basisHash:r.basisHash,
    expiresAt:r.expiresAt,executionEpoch:r.executionEpoch,input,generation,review,phases,
    ...(versioned?{pipelineVersion:pipeline as 'legacy/v1'|'facts-first/v1',decision,publishedPacketHash:r.publishedPacketHash as string|null}:{})};
}

export function processingPhaseState(operation:CanonicalProcessingOperation,phase:ProcessingPhase):
  'missing'|'unstarted'|'completed'|'unknown'|'failed' {
  const call=operation.phases.find(c=>c.phase===phase);
  if(!call)return 'missing';
  if(call.state==='dispatched_unknown'||call.outcome==='outcome_unknown')return 'unknown';
  if(call.state==='reserved'||call.state==='released')return 'unstarted';
  if(call.state==='settled'&&call.outcome==='completed'&&(phase==='decision'?operation.decision:phase==='generation'?operation.generation:operation.review))return 'completed';
  return 'failed';
}
