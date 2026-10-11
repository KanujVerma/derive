import {createInterface} from 'node:readline';
import {createFixedBenchmarkAdapter} from '../facts-first-v2/edge-adapter.ts';
import type {FixtureDataset} from '../facts-first-v2/protocol.ts';
import dataset from '../facts-first-v3/cases.json' with {type:'json'};
import {createLedgerTransport,createFencedFetch} from './ledger-transport.ts';

// Exact already-reviewed V3 run. This program cannot renew or enable it.
const RUN='f5435302-b39d-429f-bde9-a0e73fd6de47';
const PROJECT='snojlbqovlawewwqbviz';
const action=process.argv[2];
if(action!=='status'&&action!=='run_next')throw Error('Use status or run_next');
const write=(value:unknown)=>process.stdout.write(JSON.stringify(value)+'\n');
const transport=createLedgerTransport(RUN,PROJECT,write);
const input=createInterface({input:process.stdin,terminal:false});
input.on('line',line=>transport.receive(line));input.on('close',()=>transport.close());
// A failed or timed-out management response leaves any consumed claim unresolved.
// There is no provider retry, refund, role impersonation, or ledger reset.
const timeout=setTimeout(()=>transport.close(),120000);
try{
 const adapter=createFixedBenchmarkAdapter(RUN,dataset as FixtureDataset,{
  rpc:transport.rpc,now:()=>Date.now(),fetchImpl:createFencedFetch(transport.signal,fetch),
  readKey:provider=>process.env[provider==='jev'?'JEV_API_KEY':'GEMINI_API_KEY']??null,
 });
 const result=await adapter(action);write({kind:'runner_result',version:'derive-cloud-ledger/v1',result});
}catch{write({kind:'runner_error',version:'derive-cloud-ledger/v1',error:'operation_not_confirmed'});process.exitCode=1;}
finally{clearTimeout(timeout);input.close();}
