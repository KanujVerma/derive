import {canonicalJson,sha256} from '../../../src/domain/part-two/hash.ts';
import {REVISED_RUN_VERSION,validateDataset,type FixtureDataset,type BenchmarkPhase,type PhaseCheckpoint} from './protocol.ts';
import {executeFixturePhase,type ExecutionPorts} from './execute.ts';
export interface BenchmarkAdapterPorts {
 rpc(name:string,args:Record<string,unknown>):Promise<unknown>;
 readKey:ExecutionPorts['readKey'];now:ExecutionPorts['now'];fetchImpl:typeof fetch;
}
/** Called only from the existing JWT-verified, fixed-action benchmark endpoint.
 * No caller may supply fixtures, prompts, model IDs, run IDs or request bodies.
 * The deployed wrapper captures runId and dataset as reviewed server constants. */
export function createFixedBenchmarkAdapter(runId:string,dataset:FixtureDataset,ports:BenchmarkAdapterPorts){
 const captured=structuredClone(dataset);validateDataset(captured);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(runId))throw Error('invalid_fixed_run');
 const datasetHash=sha256(canonicalJson(captured));
 const namespace=captured.version===REVISED_RUN_VERSION?'derive_benchmark_v3':'derive_benchmark_v2';
 return async(action:'status'|'run_next')=>{
  if(action!=='status'&&action!=='run_next')throw Error('unregistered_benchmark_action');
  const raw=await ports.rpc(`${namespace}_snapshot`,{p_run:runId,p_dataset_hash:datasetHash});
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_run_snapshot');
  const snapshot=raw as Record<string,unknown>;
  if(!['not_configured','stopped','unresolved_attempt','finished','ready'].includes(String(snapshot.kind)))throw Error('invalid_run_snapshot');
  if(action==='status'||snapshot.kind!=='ready')return structuredClone(raw);
  if(snapshot.runId!==runId||snapshot.datasetHash!==datasetHash||typeof snapshot.caseId!=='string'||!['decision','copy','review'].includes(String(snapshot.phase))||!Array.isArray(snapshot.checkpoints)||snapshot.freeGeminiConfirmed!==true)throw Error('unbound_run_snapshot');
  return executeFixturePhase({runId,dataset:captured,caseId:snapshot.caseId,phase:snapshot.phase as BenchmarkPhase,checkpoints:snapshot.checkpoints as PhaseCheckpoint[]},{
   readKey:ports.readKey,freeGeminiConfirmed:true,now:ports.now,fetchImpl:ports.fetchImpl,
   claim:async request=>await ports.rpc(`${namespace}_claim`,{p_run:request.runId,p_dataset_hash:request.datasetHash,p_case:request.caseId,p_phase:request.phase,p_request_hash:request.requestHash}) as Awaited<ReturnType<ExecutionPorts['claim']>>,
   finish:async(claim,outcome)=>await ports.rpc(`${namespace}_finish`,{p_run:claim.runId,p_lease:claim.lease,p_request_hash:claim.requestHash,p_state:outcome.state,p_output:outcome.output,p_actual_cost_microusd:outcome.actualCostMicrousd}) as Awaited<ReturnType<ExecutionPorts['finish']>>,
  });
 };
}
