import {Buffer} from 'node:buffer';
import {randomUUID} from 'node:crypto';

const FUNCTIONS={
 derive_benchmark_v3_snapshot:['p_run','p_dataset_hash'],
 derive_benchmark_v3_claim:['p_run','p_dataset_hash','p_case','p_phase','p_request_hash'],
 derive_benchmark_v3_finish:['p_run','p_lease','p_request_hash','p_state','p_output','p_actual_cost_microusd'],
} as const;
type RpcName=keyof typeof FUNCTIONS;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=/^[a-f0-9]{64}$/;
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);

/** Fixed management-connector statements. No key, JWT impersonation, arbitrary
 * SQL, or credential transport. JSON is encoded as UTF-8 hex, never SQL text. */
export function ledgerQuery(name:string,args:Record<string,unknown>,runId:string):string{
 if(!Object.hasOwn(FUNCTIONS,name)||!uuid.test(runId))throw Error('unsupported_ledger_operation');
 const expected=FUNCTIONS[name as RpcName];
 if(Object.keys(args).sort().join(',')!==[...expected].sort().join(',')||args.p_run!==runId)throw Error('unbound_ledger_operation');
 if(name!=='derive_benchmark_v3_finish'&&(typeof args.p_dataset_hash!=='string'||!hash.test(args.p_dataset_hash)))throw Error('invalid_dataset_hash');
 if(name==='derive_benchmark_v3_claim'&&(typeof args.p_case!=='string'||args.p_case.length<1||args.p_case.length>100||!['copy','decision','review'].includes(String(args.p_phase))))throw Error('invalid_phase_claim');
 if(name!=='derive_benchmark_v3_snapshot'&&(typeof args.p_request_hash!=='string'||!hash.test(args.p_request_hash)))throw Error('invalid_request_hash');
 if(name==='derive_benchmark_v3_finish'&&(
  typeof args.p_lease!=='string'||!uuid.test(args.p_lease)||!['completed','failed'].includes(String(args.p_state))||!object(args.p_output)||
  !(args.p_actual_cost_microusd===null||typeof args.p_actual_cost_microusd==='number'&&Number.isSafeInteger(args.p_actual_cost_microusd)&&args.p_actual_cost_microusd>=0&&args.p_actual_cost_microusd<=100000)
 ))throw Error('invalid_settlement');
 const serialized=JSON.stringify(args);if(Buffer.byteLength(serialized)>1048576)throw Error('ledger_payload_budget');
 const fields=name==='derive_benchmark_v3_snapshot'?"(j->>'p_run')::uuid,j->>'p_dataset_hash'":
 name==='derive_benchmark_v3_claim'?"(j->>'p_run')::uuid,j->>'p_dataset_hash',j->>'p_case',j->>'p_phase',j->>'p_request_hash'":
 "(j->>'p_run')::uuid,(j->>'p_lease')::uuid,j->>'p_request_hash',j->>'p_state',j->'p_output',(j->>'p_actual_cost_microusd')::bigint";
 return `with input as (select convert_from(decode('${Buffer.from(serialized).toString('hex')}','hex'),'UTF8')::jsonb j) select public.${name}(${fields}) as result from input;`;
}
export interface LedgerFrame {kind:'ledger_request';version:'derive-cloud-ledger/v1';session:string;id:number;projectId:string;name:string;args:Record<string,unknown>;query:string}
export function createLedgerTransport(runId:string,projectId:string,emit:(frame:LedgerFrame)=>void){
 const session=randomUUID(),controller=new AbortController();
 let sequence=0,closed=false,pending:{id:number;resolve:(v:unknown)=>void;reject:(e:Error)=>void}|null=null;
 const close=()=>{closed=true;controller.abort();pending?.reject(Error('ledger_transport_closed'));pending=null;};
 return {
  session,signal:controller.signal,
  rpc(name:string,args:Record<string,unknown>):Promise<unknown>{
   if(closed)return Promise.reject(Error('ledger_transport_closed'));
   if(pending)return Promise.reject(Error('concurrent_ledger_operation'));
   let query:string;try{query=ledgerQuery(name,args,runId);}catch(e){return Promise.reject(e);}
   const id=++sequence;
   return new Promise((resolve,reject)=>{pending={id,resolve,reject};try{emit({kind:'ledger_request',version:'derive-cloud-ledger/v1',session,id,projectId,name,args,query});}catch{close();}});
  },
  receive(line:string){
   if(closed)return;
   let value:unknown;
   try{if(Buffer.byteLength(line)>1048576)throw Error();value=JSON.parse(line);}catch{close();return;}
   if(!object(value)||!pending||value.session!==session||value.id!==pending.id||
    !(['id,result,session','error,id,session'].includes(Object.keys(value).sort().join(',')))||('error' in value&&value.error!==true)){close();return;}
   const current=pending;pending=null;
   if('error' in value){close();current.reject(Error('ledger_rpc_failed'));return;}
   current.resolve(value.result);
  },close,
 };
}

/** A consumed claim cannot dispatch after its management channel has closed.
 * In-flight aborts remain unknown until the existing ledger settles them. */
export function createFencedFetch(channelSignal:AbortSignal,delegate:typeof fetch):typeof fetch{
 return async(input,init)=>{
  if(channelSignal.aborted)throw Error('ledger_transport_closed');
  const signal=AbortSignal.any(init?.signal?[channelSignal,init.signal]:[channelSignal]);
  signal.throwIfAborted();
  return delegate(input,{...init,signal});
 };
}
