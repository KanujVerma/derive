import {canonicalJson} from '../../../src/domain/part-two/hash.ts';
import {PERSONALIZED_JEV_MODEL} from '../../../src/domain/personalized-sheet/jevDecisionProtocol.ts';
import {PERSONALIZED_GEMINI_MODEL} from '../../../src/domain/personalized-sheet/geminiProvider.ts';
import {prepareFixturePhase,type FixtureDataset,type BenchmarkPhase,type PhaseCheckpoint} from './protocol.ts';

export interface Claim {
 kind:'claimed';runId:string;datasetHash:string;caseId:string;phase:BenchmarkPhase;
 requestHash:string;lease:string;expiresAt:string;checkpoints:readonly PhaseCheckpoint[];reservedMicrousd:number;
}
export interface ExecutionPorts {
 /** Server-only keys, already installed by the owner. Never returned or stored. */
 readKey(provider:'jev'|'gemini'):string|null;
 freeGeminiConfirmed:boolean;
 now():number;
 fetchImpl:typeof fetch;
 claim(request:{runId:string;datasetHash:string;caseId:string;phase:BenchmarkPhase;requestHash:string}):Promise<Claim|{kind:'stopped'|'rate_wait'|'unresolved_attempt'|'already_consumed'|'prerequisite_unavailable'|'free_tier_unconfirmed'|'budget_exhausted'}>;
 finish(claim:Claim,outcome:{state:'completed'|'failed';output:Record<string,unknown>;actualCostMicrousd:number|null}):Promise<{kind:'settled'|'already_settled'|'cost_mismatch_stopped'}>;
}
async function readJson(response:Response):Promise<unknown>{
 const reader=response.body?.getReader();if(!reader)throw Error('empty_response');
 let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const value=await reader.read();if(value.done)break;size+=value.value.length;if(size>65536){await reader.cancel();throw Error('response_budget');}chunks.push(value.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function geminiBody(raw:unknown){
 if(!raw||typeof raw!=='object')throw Error('invalid_response');
 const r=raw as Record<string,any>;
 if(r.modelVersion!==PERSONALIZED_GEMINI_MODEL||!Array.isArray(r.candidates)||r.candidates.length!==1||r.candidates[0]?.finishReason!=='STOP')throw Error('invalid_response');
 const feedback=r.promptFeedback;
 if(feedback!==undefined&&(!feedback||typeof feedback!=='object'||Array.isArray(feedback)))throw Error('invalid_response');
 const blocked=(ratings:unknown)=>ratings!==undefined&&(!Array.isArray(ratings)||ratings.some(row=>!row||typeof row!=='object'||Array.isArray(row)||('blocked' in row&&row.blocked!==false)));
 if(feedback?.blockReason!==undefined&&feedback.blockReason!=='BLOCK_REASON_UNSPECIFIED'||blocked(feedback?.safetyRatings)||blocked(r.candidates[0].safetyRatings))throw Error('provider_safety_block');
 const parts=r.candidates[0].content?.parts;
 if(!Array.isArray(parts))throw Error('invalid_response');
 const visible=parts.filter((p:Record<string,unknown>)=>p?.thought!==true);
 if(visible.length!==1||typeof visible[0]?.text!=='string')throw Error('invalid_response');
 const u=r.usageMetadata;
 if(!u||![u.promptTokenCount,u.candidatesTokenCount,u.thoughtsTokenCount===undefined?0:u.thoughtsTokenCount].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=65536))throw Error('invalid_usage');
 const total=u.promptTokenCount+u.candidatesTokenCount+(u.thoughtsTokenCount===undefined?0:u.thoughtsTokenCount);
 if(!Number.isSafeInteger(total)||total>65536||u.totalTokenCount!==undefined&&u.totalTokenCount!==total
  ||u.cachedContentTokenCount!==undefined&&(!Number.isSafeInteger(u.cachedContentTokenCount)||u.cachedContentTokenCount<0||u.cachedContentTokenCount>u.promptTokenCount)
  ||u.toolUsePromptTokenCount!==undefined&&u.toolUsePromptTokenCount!==0)throw Error('invalid_usage');
 return {value:JSON.parse(visible[0].text),usage:{inputTokens:u.promptTokenCount,outputTokens:u.candidatesTokenCount+(u.thoughtsTokenCount===undefined?0:u.thoughtsTokenCount)}};
}
/** One claim, at most one HTTP dispatch and one finish. A failed or uncertain
 * finish is surfaced to the caller; this function never retries or releases it.
 * Server configuration must confirm free Gemini before any phase starts. */
export async function executeFixturePhase(args:{runId:string;dataset:FixtureDataset;caseId:string;phase:BenchmarkPhase;checkpoints:readonly PhaseCheckpoint[]},ports:ExecutionPorts){
 args=structuredClone(args);
 const prepared=prepareFixturePhase(args.dataset,args.caseId,args.phase,args.checkpoints);
 if(!ports.freeGeminiConfirmed)throw Error('free_tier_unconfirmed');
 const key=ports.readKey(prepared.provider),otherKey=prepared.phase==='decision'?ports.readKey('gemini'):null;
 if(!key?.trim()||prepared.phase==='decision'&&!otherKey?.trim())throw Error('missing_provider_configuration');
 const body=JSON.stringify(prepared.request);if(new TextEncoder().encode(body).length>32768)throw Error('request_budget');
 const claim=await ports.claim({runId:args.runId,datasetHash:prepared.datasetHash,caseId:args.caseId,phase:args.phase,requestHash:prepared.requestHash});
 if(claim.kind!=='claimed')return claim;
 if(claim.runId!==args.runId||claim.datasetHash!==prepared.datasetHash||claim.caseId!==args.caseId||claim.phase!==args.phase||claim.requestHash!==prepared.requestHash
  ||canonicalJson(claim.checkpoints)!==canonicalJson(args.checkpoints)||!claim.lease||claim.reservedMicrousd!==(prepared.provider==='jev'?3000:0))throw Error('claim_binding_mismatch');
 const started=ports.now(),remaining=Date.parse(claim.expiresAt)-started;
 // A consumed claim with an invalid deadline remains unresolved. No request is
 // sent and no unsupported proof of non-dispatch is invented for a refund.
 if(!Number.isFinite(remaining)||remaining<=0)throw Error('claim_expired');
 let state:'completed'|'failed'='failed',checkpoint:PhaseCheckpoint|null=null,error:string|null=null,status:number|null=null,usage:{inputTokens:number;outputTokens:number}|null=null,cost:number|null=null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(45000,remaining));
 try{
  const response=await ports.fetchImpl(prepared.provider==='jev'?'https://api.typesafe.ai/v1/systemone':`https://generativelanguage.googleapis.com/v1beta/models/${PERSONALIZED_GEMINI_MODEL}:generateContent`,{
   method:'POST',redirect:'error',headers:prepared.provider==='jev'?{'content-type':'application/json',authorization:`Bearer ${key}`}:{'content-type':'application/json','x-goog-api-key':key},body,signal:controller.signal});
  status=response.status;
  if(!response.ok){await response.body?.cancel();throw Error(status===429?'rate_limited':'provider_http_error');}
  const raw=await readJson(response);
  if(prepared.provider==='gemini'){
   const decoded=geminiBody(raw);usage=decoded.usage;cost=0;
   const limit=prepared.phase==='copy'?3072:4096;
   if(usage.outputTokens>limit)throw Error('output_budget');
   checkpoint=prepared.parseResponse(decoded.value);
  }else{
   checkpoint=prepared.parseResponse(raw);
   if(checkpoint.phase!=='decision')throw Error('invalid_phase');
   usage=checkpoint.value.usage;cost=Math.ceil(usage.inputTokens*42/1000);
  }
  state='completed';
 }catch(e){const message=e instanceof Error?e.message:'';error=['empty_response','response_budget','request_budget','rate_limited','provider_http_error','output_budget','invalid_usage','provider_safety_block','incomplete_copy_audit','invalid_copy_audit','invalid_copy_audit_reference','unreferenced_copy_audit','copy_audit_citation_mismatch','inconsistent_copy_audit','invalid_bundle_review','unbound_bundle_review_branches','invalid_bundle_copy','invalid_bundle_copy_reference','duplicate_bundle_insight'].includes(message)?message:'unusable_or_unknown_response';}
 finally{clearTimeout(timer);}
 const elapsed=ports.now()-started;
 const output={checkpoint:state==='completed'?checkpoint:null,requestedModel:prepared.provider==='jev'?PERSONALIZED_JEV_MODEL:PERSONALIZED_GEMINI_MODEL,status,usage,error,latencyMs:Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed):null};
 const finish=await ports.finish(claim,{state,output,actualCostMicrousd:cost});
 if(finish.kind!=='settled')return {kind:'phase_outcome_unconfirmed' as const,caseId:prepared.caseId,phase:prepared.phase,settlement:finish.kind};
 return {kind:'phase_recorded' as const,caseId:prepared.caseId,phase:prepared.phase,state,settlement:finish.kind};
}
