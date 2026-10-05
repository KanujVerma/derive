#!/usr/bin/env node
// Real authenticated RPC/DB integration with synthetic in-memory source transport.
// Requires a fresh task-isolated local stack. No network provider is contacted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { consumeOnce } from './part-one-worker.mjs';
import { normalizeDatabaseDates } from '../supabase/functions/_shared/part-one-runtime.ts';
import { ScanResultSchema } from '../src/contracts/PartOne.ts';
const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!endpoint||!anon||!service)throw new Error('Explicit isolated local stack environment required');
const target=new URL(endpoint);
if(target.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash)
  throw new Error('Hosted or ambiguous stack URL refused');
if(process.env.PART_ONE_DB_CONTAINER!=='supabase_db_derive-part-one-task6')throw new Error('Exact task-isolated database container required');
if(process.env.DOCKER_HOST!=='unix:///Users/kanuj/.colima/default/docker.sock'||!process.env.PART_ONE_DOCKER_CONFIG)
  throw new Error('Explicit task-private Docker client and engine required');
const docker=process.env.PART_ONE_DOCKER_BIN||'/opt/homebrew/bin/docker';
async function sql(query){
  return new Promise((resolve,reject)=>{
    const child=spawn(docker,['--config',process.env.PART_ONE_DOCKER_CONFIG,'exec','-i',process.env.PART_ONE_DB_CONTAINER,
      'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
    let out='';child.stdout.on('data',b=>{out+=b;});child.stderr.resume();
    child.on('error',()=>reject(new Error('Isolated database test transport unavailable')));
    child.on('close',code=>code===0?resolve(out.trim()):reject(new Error('Synthetic isolated SQL failed; no payload logged')));
    child.stdin.end(query);
  });
}
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const admin=createClient(endpoint,service,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[0,1].map(()=>createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}}));
const users=[],jobIds=new Set(),recordIds=new Set();let checks=0,fetches=0,savedPolicy,savedBudget;
function check(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
async function worker(action,payload){
  const{data,error}=await admin.rpc('part_one_worker',{p_action:action,p_payload:payload});
  if(error)throw new Error(`Synthetic local ledger ${action} failed (${error.code}); payload omitted`);
  if(action==='claim'&&data?.job)jobIds.add(data.job.id);
  if(action==='admit'&&data?.recordId)recordIds.add(data.recordId);
  return normalizeDatabaseDates(data);
}
async function operation(client,action,payload){
  const{data,error}=await client.rpc('part_one_operation',{p_action:action,p_payload:payload});
  if(error)throw new Error(`Synthetic owner ${action} failed (${error.code}); payload omitted`);
  return normalizeDatabaseDates(data);
}
const fixture=randomUUID(),policyId=randomUUID();
function code(){const body='9'+String(Math.floor(Math.random()*10**10)).padStart(10,'0');let total=0;
  for(let i=10,w=3;i>=0;i--,w=w===3?1:3)total+=Number(body[i])*w;return body+String((10-total%10)%10);}
function scan(raw,key){const request={schemaVersion:1,requestId:randomUUID(),clientScanId:randomUUID(),idempotencyKey:`${fixture}-${key}`,generation:0,
  code:{raw,symbology:'upca',namespace:'gtin',retailerId:null},requestedMarket:'US',categoryHint:null};
  return{request,idempotencyKey:request.idempotencyKey,canonicalKey:'gtin:untrusted',reasonCodes:[]};}
const variant={brand:'Synthetic',line:'Daily',form:'lotion',scent:'none',shade:'clear',spf:'not applicable',strength:'standard',size:'100',unit:'ml',packCount:1,packagingLevel:'each'};
const expiresAt=new Date(Date.now()+86400000).toISOString();
const sourcePolicy={policyId,provider:'open_facts',version:'synthetic-worker-1',permissionEvidence:'Synthetic local fixture transport only',reviewedAt:new Date().toISOString(),expiresAt,revokedAt:null,
  operations:{lookup:true,process:true,retain:true,sharedDisplay:true,privateDisplay:false,ocr:false,cropThumbnail:false,rehost:false,hotlink:false,export:false},
  retainedFields:['identity','ingredients'],attribution:'Synthetic local worker fixture',purgeObligations:[]};
let returnedCode;
const lookupPorts={policies:[sourcePolicy],configs:{open_facts:{endpoint:'https://synthetic.invalid/',allowedHosts:['synthetic.invalid'],userAgent:'Derive authorized synthetic fixture'}},
  extractDeclaration:()=>({category:'cosmetic',complete:true,uncertaintyReasons:[]}),
  transport:{pinsResolvedAddresses:true,resolve:async()=>['93.184.216.34'],fetch:async(url,options)=>{
    assert.equal(new URL(url).hostname,'synthetic.invalid');assert.deepEqual(options.resolvedAddresses,['93.184.216.34']);fetches++;
    return new Response(JSON.stringify({status:1,product:{code:returnedCode,product_name:'Synthetic Daily Lotion',brands:'Synthetic',variant,countries_tags:['US'],ingredients_text:'Water, 1,2-Hexanediol, Glycerin'}}),{headers:{'content-type':'application/json'}});
  }}};
try{
  check(await sql("select count(*) from private.part_one_jobs where state in ('queued','running','deferred_budget','retry_wait');"),'0','fresh isolated job ledger required');
  savedPolicy=JSON.parse(await sql("select row_to_json(p) from private.part_one_policies p where id='open_facts';"));
  const budget=await sql("select row_to_json(b) from private.part_one_budgets b where provider='open_facts';");savedBudget=budget?JSON.parse(budget):null;
  await sql("begin;update private.part_one_policies set version='synthetic-worker-1',lookup_allowed=true,retain_allowed=true,display_allowed=true,export_allowed=false,expires_at=("+literal(expiresAt)+"#>>'{}')::timestamptz,permission_evidence='Synthetic isolated fixture only' where id='open_facts';commit;");
  await sql("insert into private.part_one_budgets(provider,call_limit,concurrency_limit,window_seconds) values('open_facts',20,2,60) on conflict(provider) do update set call_limit=20,concurrency_limit=2,window_seconds=60,reset_at=null;");
  for(const client of clients){const{data,error}=await client.auth.signInAnonymously();if(error||!data.user)throw new Error('Isolated synthetic auth unavailable');users.push(data.user.id);}
  await worker('heartbeat',{consumerVersion:'synthetic-worker-smoke'});
  const raw=code();returnedCode=raw;
  const a=await operation(clients[0],'scans/create',scan(raw,'late-a'));let b;
  check(a.identity,'pending','foreground queue pending');
  await consumeOnce({lookupPorts,rpc:async(action,payload)=>{
    const result=await worker(action,payload);
    if(action==='claim'&&result.job){check(result.job.id,a.jobId,'consumer owns requested synthetic job');check(result.job.input.canonicalKey,`gtin:${raw.padStart(14,'0')}`,'DB recomputes canonical key');
      b=await operation(clients[1],'scans/create',scan(raw,'late-b'));check(b.jobId,a.jobId,'late owner joins running job');}
    return result;
  }});
  const completedA=ScanResultSchema.parse(await operation(clients[0],'scans/read',{scanId:a.scanId}));
  const completedB=ScanResultSchema.parse(await operation(clients[1],'scans/read',{scanId:b.scanId}));
  check(completedA.declarationState,'accepted','admitted full synthetic DEC accepted');check(completedB.declarationState,'accepted','late owner receives whole publication');
  check(completedA.snapshotId,completedB.snapshotId,'public snapshot shared');check(completedB.work,'complete','late join terminal state');
  check(completedA.display.sections[0].text,'Water, 1,2-Hexanediol, Glycerin','source chemical punctuation survives actual DB');
  const save=await operation(clients[0],'saves/create',{idempotencyKey:`${fixture}-save`,scanId:a.scanId,expectedGeneration:0,expectedResultRevision:completedA.resultRevision,
    selectedSnapshotId:completedA.snapshotId,selectedDeclarationId:completedA.declarationId});
  check(save.snapshotAtSaveId,completedA.snapshotId,'actual DB save pins publication');
  check((await operation(clients[0],'saves/read',{id:save.saveId})).result.display.sections[0].text,completedA.display.sections[0].text,'owner save reopens immutable source');
  const foreign=await clients[1].rpc('part_one_operation',{p_action:'saves/read',p_payload:{id:save.saveId}});check(foreign.error?.code,'42501','foreign save access denied');
  check((await operation(clients[0],'saves/create',{idempotencyKey:`${fixture}-stale`,scanId:a.scanId,expectedGeneration:0,expectedResultRevision:a.resultRevision,
    selectedSnapshotId:completedA.snapshotId,selectedDeclarationId:completedA.declarationId})).conflict,true,'stale-result save CAS rejects');
  const cached=ScanResultSchema.parse(await operation(clients[0],'scans/create',scan(raw,'catalog')));
  check(cached.declarationState,'accepted','foreground catalog hit uses actual worker admissions');check(cached.jobId,null,'accepted catalog schedules no repeated lookup');check(fetches,1,'one source request serves late owner and catalog');
  // Crash after first immutable admission: restart uses provider/composition
  // checkpoints and exact ID replay, then commits the remaining records once.
  const crashRaw=code();returnedCode=crashRaw;
  const crashScan=await operation(clients[0],'scans/create',scan(crashRaw,'crash'));let lost=false;
  await assert.rejects(consumeOnce({lookupPorts,rpc:async(action,payload)=>{
    const result=await worker(action,payload);
    if(action==='admit'&&!lost){lost=true;throw new Error('synthetic crash after durable admission');}return result;
  }}),/synthetic crash/);checks++;
  check(fetches,2,'crash made one provider request');
  await sql(`update private.part_one_jobs set lease_expires_at=now()-interval '1 second' where id='${crashScan.jobId}';`);
  await consumeOnce({lookupPorts,rpc:worker});
  const recovered=ScanResultSchema.parse(await operation(clients[0],'scans/read',{scanId:crashScan.scanId}));
  check(recovered.declarationState,'accepted','crash recovery replays admission and publishes');check(fetches,2,'recovery does not repeat provider request');
  check(await sql(`select count(*) from private.part_one_records where canonical_key='gtin:${crashRaw.padStart(14,'0')}';`),'3','exact immutable IDs deduplicate observation/declaration/snapshot');
  // A genuine parsed miss after a documented redirect must settle each actual
  // reservation and reach normal fallback/terminal publication, not poison work.
  const redirectRaw=code();returnedCode=redirectRaw;
  const redirectScan=await operation(clients[0],'scans/create',scan(redirectRaw,'redirect-negative'));
  let redirectRequests=0;
  await consumeOnce({rpc:worker,lookupPorts:{...lookupPorts,transport:{...lookupPorts.transport,fetch:async(url)=>{
    fetches++;redirectRequests++;
    if(redirectRequests===1)return new Response(null,{status:302,headers:{location:'/synthetic-genuine-miss'}});
    check(new URL(url).pathname,'/synthetic-genuine-miss','redirect target request is explicit');
    return new Response(JSON.stringify({status:0}),{headers:{'content-type':'application/json'}});
  }}}});
  const redirectResult=ScanResultSchema.parse(await operation(clients[0],'scans/read',{scanId:redirectScan.scanId}));
  check(redirectResult.work,'complete','redirected genuine miss reaches terminal state');
  check(redirectResult.declarationState,'none','redirected miss cannot create ingredients');
  check(await sql(`select count(*) from private.part_one_reservations where job_id='${redirectScan.jobId}' and state='settled';`),'2','both actual redirect requests settle');
  check(await sql(`select count(*) from private.part_one_reservations where job_id='${redirectScan.jobId}' and state='dispatched_unknown';`),'0','parsed redirected negative has no unknown reservation');
  check(await sql(`select (checkpoints->'lookup.open_facts.1.redirect.1'->>'parsedNegative')::boolean from private.part_one_jobs where id='${redirectScan.jobId}';`),'t','redirect hop negative proof passes actual SQL guard');
  check(fetches,4,'redirected parsed miss uses exactly two source requests');
  // Thrown transport leaves a charged unknown reservation; a new lease never
  // interprets it as a miss or retries the optical/provider operation.
  const unknownRaw=code();returnedCode=unknownRaw;
  const unknown=await operation(clients[0],'scans/create',scan(unknownRaw,'unknown'));
  await consumeOnce({rpc:worker,lookupPorts:{...lookupPorts,transport:{...lookupPorts.transport,fetch:async()=>{fetches++;throw new Error('synthetic ambiguous socket loss');}}}});
  check(await sql(`select count(*) from private.part_one_reservations where job_id='${unknown.jobId}' and state='dispatched_unknown';`),'1','unknown provider outcome remains charged');
  await sql(`update private.part_one_jobs set next_eligible_at=now()-interval '1 second' where id='${unknown.jobId}';`);
  await consumeOnce({rpc:worker,lookupPorts});check(fetches,5,'unknown recovery never redispatches');
  const unknownResult=await operation(clients[0],'scans/read',{scanId:unknown.scanId});check(unknownResult.reasonCodes.includes('unknown_provider_outcome'),true,'unknown recovery honest typed reason');
  // Provider Retry-After applies to the shared provider budget across jobs,
  // not merely this job's nextEligibleAt or nested in-memory reply.
  const limitedRaw=code();returnedCode=limitedRaw;
  const limited=await operation(clients[0],'scans/create',scan(limitedRaw,'provider-reset'));
  await consumeOnce({rpc:worker,lookupPorts:{...lookupPorts,transport:{...lookupPorts.transport,fetch:async()=>{
    fetches++;return new Response('{}',{status:429,headers:{'content-type':'application/json','retry-after':'180'}});
  }}}});
  check(await sql("select reset_at>=now()+interval '170 seconds' from private.part_one_budgets where provider='open_facts';"),'t','provider180s reset survives actual global ledger settlement');
  check(await sql(`select retry_after>=now()+interval '170 seconds' from private.part_one_reservations where job_id='${limited.jobId}';`),'t','reservation retains provider reset time');
  check((await operation(clients[0],'scans/read',{scanId:limited.scanId})).work,'retry_wait','429 remains retry state');
  check(fetches,6,'429 uses exactly one in-memory request');
  console.log(`Part 1 real local worker/RPC integration: ${checks} checks passed; ${fetches} in-memory fixture requests; zero live provider calls.`);
}finally{
  for(const user of users){const{error}=await admin.auth.admin.deleteUser(user);if(error)console.error('Synthetic user cleanup failed; reset isolated database before reuse.');}
  try{
    const jobs=[...jobIds].map(id=>`'${id}'`).join(','),records=[...recordIds].map(id=>`'${id}'`).join(',');
    if(jobs)await sql(`delete from private.part_one_reservations where job_id in (${jobs});delete from private.part_one_jobs where id in (${jobs});`);
    if(records)await sql(`delete from private.part_one_records where id in (${records});`);
    if(savedPolicy)await sql(`with original as(select * from jsonb_populate_record(null::private.part_one_policies,${literal(savedPolicy)})) update private.part_one_policies p set version=o.version,lookup_allowed=o.lookup_allowed,retain_allowed=o.retain_allowed,display_allowed=o.display_allowed,export_allowed=o.export_allowed,expires_at=o.expires_at,permission_evidence=o.permission_evidence from original o where p.id=o.id;`);
    if(savedBudget)await sql(`with original as(select * from jsonb_populate_record(null::private.part_one_budgets,${literal(savedBudget)})) update private.part_one_budgets b set call_limit=o.call_limit,concurrency_limit=o.concurrency_limit,window_seconds=o.window_seconds,reset_at=o.reset_at from original o where b.provider=o.provider;`);
    else if(savedPolicy)await sql("delete from private.part_one_budgets where provider='open_facts';");
  }catch{console.error('Synthetic fixture cleanup failed; reset isolated database before reuse.');process.exitCode=1;}
}
