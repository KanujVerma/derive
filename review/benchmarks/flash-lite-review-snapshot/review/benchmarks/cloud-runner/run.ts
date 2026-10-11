import {createInterface} from 'node:readline';
import {createFrameWriter} from './frame-log.ts';
import {createFixedBenchmarkAdapter} from '../facts-first-v2/edge-adapter.ts';
import type {FixtureDataset} from '../facts-first-v2/protocol.ts';
import dataset from '../facts-first-v3/cases.json' with {type:'json'};
import {createLedgerTransport,createFencedFetch} from './ledger-transport.ts';

// Fresh bounded V3 Jev plus Lite copy-v7/review-v9 benchmark. This program cannot create, renew or enable it.
const RUN='8a9afbe3-c677-4829-97f0-c81c655ccebd';
const PROJECT='snojlbqovlawewwqbviz';
const action=process.argv[2];
if(action!=='status'&&action!=='run_next')throw Error('Use status or run_next');
const frameWriter=createFrameWriter(process.cwd(),line=>{process.stdout.write(line);});
const write=(value:unknown)=>frameWriter.write(value);
const transport=createLedgerTransport(RUN,PROJECT,write);
const input=createInterface({input:process.stdin,terminal:false});
input.on('line',line=>transport.receive(line));input.on('close',()=>transport.close());
// A failed or timed-out management response leaves any consumed claim unresolved.
// There is no provider retry, refund, role impersonation, or ledger reset.
// Management-tool round trips share this bounded orchestration window.
// Each provider request still has its separate <=45s deadline and <=90s lease.
const timeout=setTimeout(()=>transport.close(),600000);
try{
 const adapter=createFixedBenchmarkAdapter(RUN,dataset as FixtureDataset,{
  rpc:transport.rpc,now:()=>Date.now(),fetchImpl:createFencedFetch(transport.signal,fetch),
  readKey:provider=>process.env[provider==='jev'?'JEV_API_KEY':'GEMINI_API_KEY']??null,
 });
 const result=await adapter(action);write({kind:'runner_result',version:'derive-cloud-ledger/v1',result});
}catch{write({kind:'runner_error',version:'derive-cloud-ledger/v1',error:'operation_not_confirmed'});process.exitCode=1;}
finally{clearTimeout(timeout);input.close();}
