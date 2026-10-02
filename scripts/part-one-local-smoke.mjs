#!/usr/bin/env node
// Synthetic integration only. The URL guard prevents any hosted auth/data writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const endpoint=process.env.SUPABASE_URL;
const anon=process.env.SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!endpoint || !anon || !service) throw new Error('Isolated local stack environment is required');
const target=new URL(endpoint);
if (target.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.username || target.password) {
  throw new Error('This smoke test cannot run against hosted Supabase');
}
const admin=createClient(endpoint,service,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[0,1].map(()=>createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}}));
const users=[];
let checks=0;
function check(actual,expected,message) { assert.deepEqual(actual,expected,message); checks++; }
async function operation(client,action,payload) {
  const {data,error}=await client.rpc('part_one_operation',{p_action:action,p_payload:payload});
  if (error) throw new Error(`Local operation ${action} failed (${error.code}); payload omitted`);
  return data;
}
async function worker(action,payload) {
  const {data,error}=await admin.rpc('part_one_worker',{p_action:action,p_payload:payload});
  if (error) throw new Error(`Local consumer ${action} failed (${error.code}); payload omitted`);
  return data;
}
const fixtureKey=randomUUID();
const barcodeBody='0'+String(Math.floor(Math.random()*10**10)).padStart(10,'0');
let sum=0; for(let i=10,w=3;i>=0;i--,w=w===3?1:3) sum+=Number(barcodeBody[i])*w;
const barcode=barcodeBody+String((10-sum%10)%10);
const canonicalKey=`gtin:${barcode.padStart(14,'0')}`;
function scanRequest(code,key) {
  const request={schemaVersion:1,requestId:randomUUID(),idempotencyKey:key,clientScanId:randomUUID(),generation:0,
    code:{raw:code,symbology:'upca',namespace:'gtin',retailerId:null},requestedMarket:null,categoryHint:null};
  return {request,idempotencyKey:key,canonicalKey:null,reasonCodes:[]};
}
try {
  for(const client of clients) {
    const {data,error}=await client.auth.signInAnonymously();
    if (error || !data.user) throw new Error('Local anonymous auth is not enabled');
    users.push(data.user.id);
  }
  const observation=randomUUID(),declaration=randomUUID(),snapshot=randomUUID(),item=randomUUID(),policy=randomUUID();
  const observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+86400000).toISOString();
  await worker('admit',{id:observation,kind:'observation',itemId:null,revision:1,canonicalKey:null,
    policyId:'derive_catalog',policyVersion:'1',scope:'public',dependencies:[],supersedesId:null,observedAt,expiresAt,
    payload:{provider:'synthetic-local-smoke',fixtureKey,rawText:'Water, Glycerin',sourceUpdatedAt:null}});
  await worker('admit',{id:declaration,kind:'declaration',itemId:item,revision:1,canonicalKey:null,
    policyId:'derive_catalog',policyVersion:'1',scope:'public',dependencies:[observation],supersedesId:null,observedAt,expiresAt,
    payload:{state:'accepted',fixtureKey,rawText:'Water, Glycerin',predicate:{association:{passed:true},noContradiction:{passed:true},
      variantMarket:{passed:true},completeness:{passed:true},rightsFreshness:{passed:true}},
      sections:[{sectionId:randomUUID(),kind:'ingredients',text:'Water, Glycerin',evidenceIds:[observation],policyId:policy,observedAt,expiresAt}],
      sources:[{observationId:observation,policyId:policy,label:'Synthetic local fixture',url:null,observedAt,sourceUpdatedAt:null,expiresAt}]}});
  await worker('admit',{id:snapshot,kind:'snapshot',itemId:item,revision:1,canonicalKey,
    policyId:'derive_catalog',policyVersion:'1',scope:'public',dependencies:[],supersedesId:null,observedAt,expiresAt,
    payload:{name:'Synthetic Local Lotion',brand:'Fixture',fixtureKey,variantText:'Unscented 100 ml',image:null,
      declarationIds:[declaration],requestedMarket:null,sourceMarkets:[],packageMarket:null}});
  const acceptedPayload=scanRequest(barcode,`accepted-${fixtureKey}`);
  const accepted=await operation(clients[0],'scans/create',acceptedPayload);
  check(accepted.identity,'exact','catalog identity');
  check(accepted.declarationState,'accepted','whole declaration accepted');
  check(accepted.jobId,null,'accepted catalog hit needs no provider job');
  check((await operation(clients[0],'scans/create',acceptedPayload)).scanId,accepted.scanId,'scan idempotent replay');
  const savePayload={idempotencyKey:`save-${fixtureKey}`,scanId:accepted.scanId,expectedGeneration:0,
    expectedResultRevision:accepted.resultRevision,selectedSnapshotId:snapshot,selectedDeclarationId:declaration};
  const saved=await operation(clients[0],'saves/create',savePayload);
  check((await operation(clients[0],'saves/read',{id:saved.saveId})).snapshotAtSaveId,snapshot,'saved fixed snapshot survives reopen');
  check((await operation(clients[0],'saves/list',{})).saves.length,1,'owner save list persists');
  const foreign=await clients[1].rpc('part_one_operation',{p_action:'saves/read',p_payload:{id:saved.saveId}});
  check(foreign.error?.code,'42501','foreign owner forbidden');
  await worker('revoke',{recordId:observation,status:'retracted',reason:'Synthetic local fault injection'});
  const retracted=await operation(clients[0],'scans/read',{scanId:accepted.scanId});
  check(retracted.identity,'exact','retraction preserves independent identity');
  check(retracted.declarationState,'conflict','retraction decreases readiness');
  check((await operation(clients[0],'saves/create',{...savePayload,idempotencyKey:`stale-${fixtureKey}`})).conflict,true,'stale save rejected');
  await operation(clients[0],'saves/delete',{id:saved.saveId});
  const replay=await clients[0].rpc('part_one_operation',{p_action:'saves/create',p_payload:savePayload});
  check(replay.error?.message,'PART_ONE_DELETED','deleted save cannot replay');
  check((await operation(clients[0],'saves/list',{})).saves.length,0,'deleted save hidden from owner list');
  // Different canonical code; public work coalesces, owner scans stay separate.
  const pending1=scanRequest('123456789012',`pending-a-${fixtureKey}`);
  const pending2=scanRequest('123456789012',`pending-b-${fixtureKey}`);
  const [a,b]=await Promise.all([operation(clients[0],'scans/create',pending1),operation(clients[1],'scans/create',pending2)]);
  check(a.jobId,b.jobId,'concurrent public-key work deduplicated');
  assert.notEqual(a.scanId,b.scanId); checks++;
  const sub=await operation(clients[0],'subscriptions/create',{scanId:a.scanId});
  check((await operation(clients[0],'subscriptions/create',{scanId:a.scanId})).subscriptionId,sub.subscriptionId,'reopen rejoins interest');
  const capture=await operation(clients[0],'captures/create',{scanId:a.scanId,expectedGeneration:a.generation,
    expectedResultRevision:sub.resultRevision});
  const gated=await clients[0].rpc('part_one_operation',{p_action:'captures/observations',p_payload:{
    captureSessionId:capture.captureSessionId,packageObservationId:capture.packageObservationId,expectedGeneration:a.generation,
    expectedResultRevision:sub.resultRevision,expectedCaptureRevision:0,expectedDeletionEpoch:0,observations:[],assets:[],edits:[]}});
  check(gated.error?.message,'PART_ONE_PRIVATE_RETENTION_DISABLED','private durable commit remains gated');
  if (process.env.PART_ONE_EDGE_SMOKE==='1') {
    const {data:{session}}=await clients[0].auth.getSession();
    const result=await fetch(new URL(`/functions/v1/part-one/scans/${a.scanId}`,target),{
      headers:{apikey:anon,Authorization:`Bearer ${session.access_token}`}});
    check(result.status,202,'Edge authenticated GET returns pending');
    const body=await result.json(); check(body.scanId,a.scanId,'Edge current scan projection');
    check(body.display.resultRevision,body.resultRevision,'Edge projection revision consistent');
  }
  console.log(`Part 1 isolated local integration: ${checks} checks passed; synthetic fixtures only; no external provider/private photo calls.`);
} finally {
  for(const user of users) {
    const {error}=await admin.auth.admin.deleteUser(user);
    if (error) console.error('Synthetic local user cleanup failed; reset isolated test database before reuse.');
  }
}
