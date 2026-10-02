#!/usr/bin/env node
// Real local Auth + SQL + deployed Edge; synthetic original evidence only.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { LOCAL_DICTIONARY_RELEASE, PART_TWO_VERSIONS, PART_TWO_RELEASE_ID } from '../supabase/functions/_shared/part-two-runtime.ts';
import { parseDeclarationSection } from '../src/domain/part-one/parser.ts';
import { projectExplanationWithdrawals } from '../src/domain/part-two/index.ts';
import { NormalizationResultSchema } from '../src/contracts/PartTwo.ts';
import { ScanResultSchema } from '../src/contracts/PartOne.ts';
import { normalizeDatabaseDates } from '../supabase/functions/_shared/part-one-runtime.ts';
const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!endpoint||!anon||!service)throw new Error('Isolated local environment required');
const target=new URL(endpoint);if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw new Error('Hosted/ambiguous stack refused');
const admin=createClient(endpoint,service,{auth:{persistSession:false,autoRefreshToken:false}}),clients=[0,1].map(()=>createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}}));
const users=[];let checks=0;
const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
async function rpc(client,name,action,payload){const {data,error}=await client.rpc(name,{p_action:action,p_payload:payload});if(error)throw new Error(`Synthetic ${name}/${action} failed (${error.code}, ${error.message.match(/PART_[A-Z0-9_]+/)?.[0]??'database'}); payload omitted`);return data;}
async function edge(client,path,body){const {data:{session}}=await client.auth.getSession();const response=await fetch(new URL(`/functions/v1/part-two/${path}`,target),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();return {response,result};}
// Deterministic recall/read overlap: hold the actual SQL recall fence, start
// authenticated history read, observe its advisory wait, then commit recall.
async function recallDuringPinnedRead(policy,saveId){
 if(process.env.DOCKER_HOST!=='unix:///Users/kanuj/.colima/default/docker.sock'||!process.env.PART_ONE_DOCKER_CONFIG)throw new Error('Isolated Docker required for recall race');
 const args=['--config',process.env.PART_ONE_DOCKER_CONFIG,'exec','-i','supabase_db_derive-part-two-task','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'];
 const run=(query)=>new Promise((resolve,reject)=>{const c=spawn('/opt/homebrew/bin/docker',args,{stdio:['pipe','pipe','pipe']});let out='';c.stdout.on('data',v=>out+=v);c.stderr.resume();c.once('error',reject);c.once('close',code=>code===0?resolve(out.trim()):reject(new Error('Synthetic recall SQL unavailable')));c.stdin.end(query);});
 const holder=spawn('/opt/homebrew/bin/docker',args,{stdio:['pipe','pipe','pipe']});holder.stderr.resume();
 const ended=new Promise((resolve,reject)=>{holder.once('error',reject);holder.once('close',code=>code===0?resolve():reject(new Error('Synthetic recall transaction failed')));});
 try{
  const locked=new Promise(resolve=>{let out='';holder.stdout.on('data',v=>{out+=v;if(out.includes('RECALL_LOCKED'))resolve();});});
  holder.stdin.write("begin; select pg_advisory_xact_lock(40203); select pg_advisory_xact_lock(40204); select 'RECALL_LOCKED';\n");await locked;
  const pending=edge(clients[0],'saved-details',{saveId,requestId:randomUUID()});let waiting=false;
  for(let i=0;i<60;i++){if(await run("select count(*) from pg_locks where locktype='advisory' and objid=40203 and not granted;\n")!=='0'){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}
  check(waiting,true,'authenticated saved read actually overlaps held recall transaction');
  const payload=JSON.stringify({recordId:policy,reason:'Synthetic local deterministic recall/read race'}).replaceAll("'","''");
  holder.stdin.end(`select public.part_two_worker('explanations/withdraw','${payload}'::jsonb); commit;\n`);await ended;
  return await pending;
 }catch(error){holder.stdin.end('rollback;\n');await ended.catch(()=>{});throw error;}
}
const fixture=randomUUID(),observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+3600000).toISOString();
const observation=randomUUID(),declaration=randomUUID(),snapshot=randomUUID(),item=randomUUID(),policyId=randomUUID(),sectionId=randomUUID();
const longList=process.argv.includes('--long-list');
const rawText=longList?['Glycerin','Water','Mystery Name',...Array.from({length:37},(_,i)=>`Unknown ingredient ${i+1}`)].join(', '):'Water, Glycerin, Mystery Name';
const variant={brand:'Synthetic',line:null,form:'lotion',scent:null,shade:null,spf:null,strength:null,size:null,unit:null,packCount:null,packagingLevel:null};
const predicate=Object.fromEntries(['association','noContradiction','variantMarket','completeness','rightsFreshness'].map(k=>[k,{passed:true,evidenceIds:[observation],reasons:[]}]));
const section=parseDeclarationSection({sectionId,observationId:observation,imageId:null,sourceRevision:1,rawText,sourceOffset:0,kind:'ingredients',startCovered:true,endCovered:true,lineCoverageComplete:true,entryId:()=>randomUUID()});
const d={declarationId:declaration,revision:1,itemId:item,snapshotId:snapshot,observationIds:[observation],dependencyIds:[observation],rawText,textStructureHash:createHash('sha256').update(JSON.stringify(section)).digest('hex'),sections:[section],category:'cosmetic',completenessReasons:[],transcriptionUncertainty:[],parserVersion:'synthetic-structured-v1',aliasVersion:'unmapped-1',sourceRevision:1,sourceUpdatedAt:null,observedAt,expiresAt,policyId,scope:'public',ownerId:null,packageObservationId:null,associationEvidenceIds:[observation],variant,sourceMarkets:[],packageMarket:null,conflictIds:[],supersedesId:null,formulaEquivalence:'unknown'};
const sources=[{observationId:observation,policyId,label:'Original synthetic local fixture',url:null,observedAt,sourceUpdatedAt:null,expiresAt}];
const body='0'+String(Math.floor(Math.random()*10**10)).padStart(10,'0');let sum=0;for(let i=10,w=3;i>=0;i--,w=w===3?1:3)sum+=Number(body[i])*w;const barcode=body+String((10-sum%10)%10),canonicalKey=`gtin:${barcode.padStart(14,'0')}`;
try{
 for(const client of clients){const {data,error}=await client.auth.signInAnonymously();if(error||!data.user)throw new Error('Synthetic anonymous Auth unavailable');users.push(data.user.id);}
 await rpc(admin,'part_two_worker','release/register',{releaseId:PART_TWO_RELEASE_ID,releaseHash:LOCAL_DICTIONARY_RELEASE.contentHash,versions:PART_TWO_VERSIONS,reviewEvidence:'Synthetic local fixture: original exact-name vocabulary; production adjudication pending'});
 await rpc(admin,'part_two_worker','release/select',{releaseId:PART_TWO_RELEASE_ID});
 const common={revision:1,canonicalKey:null,policyId:'derive_catalog',policyVersion:'1',scope:'public',supersedesId:null,observedAt,expiresAt};
 await rpc(admin,'part_one_worker','admit',{...common,id:observation,kind:'observation',itemId:null,dependencies:[],payload:{provider:'synthetic-part-two',fixture,rawText,sourceUpdatedAt:null}});
 await rpc(admin,'part_one_worker','admit',{...common,id:declaration,kind:'declaration',itemId:item,dependencies:[observation],payload:{...d,structuredSections:d.sections,sections:[{sectionId,kind:'ingredients',text:rawText,evidenceIds:[observation],policyId,observedAt,expiresAt}],sources,state:'accepted',predicate}});
 await rpc(admin,'part_one_worker','admit',{...common,id:snapshot,kind:'snapshot',itemId:item,dependencies:[],canonicalKey,payload:{name:'Synthetic Part 2 Lotion',brand:'Synthetic',variantText:'Synthetic fixture',image:null,declarationIds:[declaration],requestedMarket:null,sourceMarkets:[],packageMarket:null}});
 const scan=await rpc(clients[0],'part_one_operation','scans/create',{idempotencyKey:fixture,request:{schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:fixture,generation:0,code:{raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null},requestedMarket:null,categoryHint:null}});
 check(scan.declarationState,'accepted','synthetic full structured source bound through actual Part 1');
 const {data:{session:precomputeSession}}=await clients[0].auth.getSession();
 const precomputeRequest={schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:`precompute-${fixture}`,generation:0,code:{raw:barcode,symbology:'upc_a',namespace:'gtin',retailerId:null},requestedMarket:null,categoryHint:null};
 const admittedResponse=await fetch(new URL('/functions/v1/part-one/scans',target),{method:'POST',headers:{apikey:anon,authorization:`Bearer ${precomputeSession.access_token}`,'content-type':'application/json'},body:JSON.stringify(precomputeRequest)});
 check(admittedResponse.status,200,'Part 1 actual Edge admission remains available');const admitted=await admittedResponse.json();
 // Read-only joins; the admission hook owns the compute ticket, not this poll.
 await new Promise(resolve=>setTimeout(resolve,250));let precomputed;
 for(let i=0;i<20;i++){precomputed=await rpc(clients[0],'part_two_operation','resolve',{schemaVersion:1,requestId:randomUUID(),scanId:admitted.scanId,captureSessionId:null,expectedGeneration:admitted.generation,expectedEvidenceRevision:admitted.resultRevision});if(precomputed.cached)break;await new Promise(resolve=>setTimeout(resolve,100));}
 check(precomputed.state,'ready','actual Part 1 admission hook precomputes normalization');check(precomputed.cached.state,'ready','precomputed immutable snapshot exists before explicit Part 2 request');

 const request={schemaVersion:1,requestId:randomUUID(),scanId:scan.scanId,captureSessionId:null,expectedGeneration:scan.generation,expectedEvidenceRevision:scan.resultRevision};
 const ready=await edge(clients[0],'normalize',request);check(ready.response.status,200,'deployed authenticated Edge normalization');NormalizationResultSchema.parse(ready.result);check(ready.result.state,'ready','actual Edge+SQL publishes ready');check(ready.result.output.kind,'bound','public declaration yields bound output');check(ready.result.output.reading.occurrences.length,longList?40:3,'literal source occurrences preserved');check(ready.result.output.reading.occurrences[2].mapping.state,'unresolved','unknown remains visible');
 const replay=await edge(clients[0],'normalize',{...request,requestId:randomUUID()});check(replay.result.resultRevision,ready.result.resultRevision,'reopen reuses existing snapshot without revision bump');check(replay.result.output.reading.snapshotId,ready.result.output.reading.snapshotId,'immutable interpretation reuse');
 const foreign=await edge(clients[1],'normalize',request);check(foreign.response.status,403,'foreign authenticated user cannot read cache');
 const forged=await edge(clients[0],'normalize',{...request,productPresenceAllowed:true});check(forged.response.status,400,'authority flags rejected at deployed boundary');
 const save={idempotencyKey:`save-${fixture}`,scanId:scan.scanId,expectedGeneration:scan.generation,expectedResultRevision:scan.resultRevision,selectedSnapshotId:snapshot,selectedDeclarationId:declaration};
 const staleSave=await edge(clients[0],'saves',{save,bindingKey:ready.result.bindingKey,expectedPartTwoRevision:ready.result.resultRevision-1});check(staleSave.response.status,409,'stale interpretation save rejected');
 const saved=await edge(clients[0],'saves',{save,bindingKey:ready.result.bindingKey,expectedPartTwoRevision:ready.result.resultRevision});check(saved.response.status,200,'exact interpretation saves atomically');assert(saved.result.saveId);checks++;
 const pinned=await edge(clients[0],'saved-details',{saveId:saved.result.saveId,requestId:randomUUID()});check(pinned.result.result.output.reading.snapshotId,ready.result.output.reading.snapshotId,'saved interpretation pins exact immutable snapshot');
 if(process.argv.includes('--recall')) {
  const card=ready.result.output.reading.facts.find(f=>f.kind==='reference_function');assert(card,'Glycerin reference card is actually wired');checks++;
  const withdrawal=card.value.policyId;
  const projection=await recallDuringPinnedRead(withdrawal,saved.result.saveId);
  check(projection.result.withdrawn,false,'card-only recall retains authorized saved reading');
  NormalizationResultSchema.parse(projection.result.result);
  const expected=projectExplanationWithdrawals({...ready.result,requestId:projection.result.result.requestId,output:{...ready.result.output,reading:{...ready.result.output.reading,binding:{...ready.result.output.reading.binding,requestId:projection.result.result.requestId}},productFacts:{...ready.result.output.productFacts,binding:{...ready.result.output.productFacts.binding,requestId:projection.result.result.requestId}}}},{snapshotId:projection.result.result.output.reading.snapshotId,createdAt:projection.result.result.output.reading.createdAt,resultRevision:projection.result.result.resultRevision,withdrawnExplanationDependencies:[withdrawal]});
  check(projection.result.result,expected.result,'SQL persisted card-only projection exactly matches strict shared core projector');
  check(projection.result.result.output.reading.literalSections,ready.result.output.reading.literalSections,'historical source literal and exact spans unchanged');
  check(projection.result.result.output.reading.facts,ready.result.output.reading.facts.filter(f=>f.kind!=='reference_function'),'independent historical fact IDs and quantities unchanged');
  assert(projection.result.result.resultRevision>ready.result.resultRevision);checks++;
  const projectionReplay=await edge(clients[0],'saved-details',{saveId:saved.result.saveId,requestId:projection.result.result.requestId});
  check(projectionReplay.result,projection.result,'saved recall projection replays exact persisted meaning and revision');
  const current=await edge(clients[0],'normalize',request);check(current.result.state,'ready','current normalization after recall recomputes');
  check(current.result.output.reading.facts.some(f=>f.kind==='reference_function'),false,'trusted withdrawal metadata actually suppresses regenerated card');
  check(current.result.output.reading.facts.filter(f=>f.kind==='resolved_ingredient_identity').length,2,'independent identities survive recall');
  await rpc(admin,'part_two_worker','release/select',{releaseId:PART_TWO_RELEASE_ID});
  const rolled=await edge(clients[0],'normalize',request);check(rolled.result.output.reading.facts.some(f=>f.kind==='reference_function'),false,'release pointer rollback never resurrects durable known recall');
  await rpc(admin,'part_two_worker','release/select',{releaseId:PART_TWO_RELEASE_ID});
  const lease=await rpc(clients[0],'part_two_operation','resolve',request);
  await assert.rejects(()=>rpc(admin,'part_two_worker','publish',{...lease.ticket,result:ready.result}),/PART_TWO_RECALLED_EXPLANATION/);checks++;
 }
 if(process.argv.includes('--ui')){
  const {data:{session}}=await clients[0].auth.getSession();
  await writeFile(new URL('../../part-two-ui-bootstrap.json',import.meta.url),JSON.stringify({ownerId:users[0],token:session.access_token,apiKey:anon,result:ScanResultSchema.parse(normalizeDatabaseDates(scan)),apiOrigin:endpoint,observationId:observation}),{mode:0o600});
  console.log(JSON.stringify({suite:'part-two-ui-fixture',status:'ready',synthetic:true}));
  const hold=setInterval(()=>{},1000);try{await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}finally{clearInterval(hold);}
 }
 await rpc(admin,'part_one_worker','revoke',{recordId:observation,status:'retracted',reason:'Synthetic local withdrawal test'});
 const withdrawn=await edge(clients[0],'normalize',request);check(withdrawn.result.state,'blocked','live source retraction blocks cached facts');check(withdrawn.result.permittedText,null,'retracted source removes literal copies');assert(withdrawn.result.resultRevision>ready.result.resultRevision);checks++;
 const savedWithdrawn=await edge(clients[0],'saved-details',{saveId:saved.result.saveId,requestId:randomUUID()});check(savedWithdrawn.result.withdrawn,true,'saved facts do not bypass current source authorization');check(savedWithdrawn.result.result,null,'withdrawn saved payload cannot hydrate');
 console.log(JSON.stringify({suite:'part-two-real-local-edge',checks,externalNormalizationCalls:0,dictionaryHash:LOCAL_DICTIONARY_RELEASE.contentHash,status:'passed'}));
}finally{for(const id of users){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error('Synthetic owner cleanup failed');}}
