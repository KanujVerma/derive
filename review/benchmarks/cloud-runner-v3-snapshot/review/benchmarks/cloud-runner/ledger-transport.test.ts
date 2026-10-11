import test from 'node:test';
import assert from 'node:assert/strict';
import {createLedgerTransport,createFencedFetch,ledgerQuery,type LedgerFrame} from './ledger-transport.ts';
const run='f5435302-b39d-429f-bde9-a0e73fd6de47',hash='a'.repeat(64),project='snojlbqovlawewwqbviz';
const args={p_run:run,p_dataset_hash:hash};
test('snapshot produces one bounded static management query',()=>{const q=ledgerQuery('derive_benchmark_v3_snapshot',args,run);assert.match(q,/select public.derive_benchmark_v3_snapshot/);assert.ok(!q.includes('set role'));assert.ok(!q.includes('jwt'));});
test('unregistered calls, extra fields and wrong runs are rejected',()=>{for(const [name,value] of [['pg_sleep',args],['derive_benchmark_v3_snapshot',{...args,extra:1}],['derive_benchmark_v3_snapshot',{...args,p_run:'other'}]] as const)assert.throws(()=>ledgerQuery(name,value,run));});
test('SQL-looking model output is encoded as data',()=>{const text="'); drop table public.products; --";const value={p_run:run,p_lease:run,p_request_hash:hash,p_state:'completed',p_output:{text},p_actual_cost_microusd:0};const q=ledgerQuery('derive_benchmark_v3_finish',value,run);assert.ok(!q.includes(text));const encoded=q.match(/decode\('([a-f0-9]+)'/)![1];assert.deepEqual(JSON.parse(Buffer.from(encoded,'hex').toString()),value);});
test('invalid costs, leases and hashes fail before emitting SQL',()=>{for(const change of [{p_actual_cost_microusd:-1},{p_actual_cost_microusd:100001},{p_lease:'bad'},{p_request_hash:'bad'}])assert.throws(()=>ledgerQuery('derive_benchmark_v3_finish',{p_run:run,p_lease:run,p_request_hash:hash,p_state:'failed',p_output:{},p_actual_cost_microusd:null,...change},run));});
test('one matching response resolves the pending call',async()=>{const frames:LedgerFrame[]=[];const t=createLedgerTransport(run,project,f=>frames.push(f));const p=t.rpc('derive_benchmark_v3_snapshot',args);assert.equal(frames.length,1);t.receive(JSON.stringify({session:t.session,id:frames[0].id,result:{kind:'stopped'}}));assert.deepEqual(await p,{kind:'stopped'});t.close();});
test('concurrent call is rejected without disturbing the first',async()=>{let frame:LedgerFrame;const t=createLedgerTransport(run,project,f=>frame=f);const p=t.rpc('derive_benchmark_v3_snapshot',args);await assert.rejects(t.rpc('derive_benchmark_v3_snapshot',args),/concurrent/);t.receive(JSON.stringify({session:t.session,id:frame!.id,result:{kind:'stopped'}}));await p;});
test('wrong, malformed and extra-field responses close transport without retry',async()=>{for(const response of ['{}','not json',JSON.stringify({id:1,result:{},extra:true}),JSON.stringify({id:2,result:{}})]){let emits=0;const t=createLedgerTransport(run,project,()=>{emits++;});const p=t.rpc('derive_benchmark_v3_snapshot',args);t.receive(response);await assert.rejects(p,/closed/);await assert.rejects(t.rpc('derive_benchmark_v3_snapshot',args),/closed/);assert.equal(emits,1);}});
test('RPC errors and closed stdin remain unconfirmed, never successful',async()=>{const t=createLedgerTransport(run,project,()=>{});const p=t.rpc('derive_benchmark_v3_snapshot',args);t.receive(JSON.stringify({session:t.session,id:1,error:true}));await assert.rejects(p,/rpc_failed/);const u=createLedgerTransport(run,project,()=>{});const q=u.rpc('derive_benchmark_v3_snapshot',args);u.close();await assert.rejects(q,/closed/);});

test('a prior process response cannot be replayed against a new transport',async()=>{
 const first=createLedgerTransport(run,project,()=>{});
 const second=createLedgerTransport(run,project,()=>{});assert.notEqual(first.session,second.session);
 const p=second.rpc('derive_benchmark_v3_snapshot',args);
 second.receive(JSON.stringify({session:first.session,id:1,result:{kind:'ready'}}));
 await assert.rejects(p,/closed/);
});

test('claim response followed by channel closure cannot dispatch a provider',async()=>{
 let calls=0;const t=createLedgerTransport(run,project,()=>{});
 const fetcher=createFencedFetch(t.signal,async()=>{calls++;return new Response('{}');});
 const pending=t.rpc('derive_benchmark_v3_claim',{...args,p_case:'fixture',p_phase:'copy',p_request_hash:hash});
 const result=pending.then(()=>fetcher('https://synthetic.invalid'));
 t.receive(JSON.stringify({session:t.session,id:1,result:{kind:'claimed'}}));t.close();
 await assert.rejects(result,/closed/);assert.equal(calls,0);
});
test('channel closure aborts the in-flight provider signal',async()=>{
 const t=createLedgerTransport(run,project,()=>{});let seen:AbortSignal|null=null;
 const fetcher=createFencedFetch(t.signal,async(_input,init)=>{seen=init!.signal!;return new Promise((_resolve,reject)=>seen!.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));});
 const pending=fetcher('https://synthetic.invalid');t.close();await assert.rejects(pending,/aborted/);assert.equal((seen as AbortSignal|null)?.aborted,true);
});
