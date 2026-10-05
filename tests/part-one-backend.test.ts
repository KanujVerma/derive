import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handlePartOneRequest, PartOneHttpError, normalizeDatabaseDates, rpcErrorToHttp,
  type PartOneHttpPorts,
} from '../supabase/functions/_shared/part-one-runtime.ts';
import { ScanResultSchema, type ScanResult } from '../src/contracts/PartOne.ts';

const id='be000000-0000-4000-8000-000000000001';
const other='be000000-0000-4000-8000-000000000002';
const scan={schemaVersion:1,requestId:id,idempotencyKey:'synthetic-backend-1',clientScanId:other,generation:0,
  code:{raw:'305210416383',symbology:'upc_a',namespace:'gtin',retailerId:null},requestedMarket:null,categoryHint:null};
function fixture(patch: Partial<ScanResult>={}): ScanResult {
  return ScanResultSchema.parse({schemaVersion:1,requestId:id,scanId:other,generation:0,resultRevision:1,
    identity:'pending',itemId:null,candidateIds:[],snapshotId:null,declarationId:null,declarationState:'none',scope:null,
    packageConfirmation:'unconfirmed',work:'deferred_budget',jobId:id,subscriptionId:null,nextCheckAfter:null,
    display:{resultRevision:1,selectedIdentity:null,candidates:[],sections:[],sources:[],limitations:['Worker unavailable']},
    reasonCodes:['worker_unavailable'],conflictIds:[],evidenceIds:[],allowedActions:['rescan','retry'],
    freshness:{observedAt:null,expiresAt:null,state:'unknown'},...patch});
}
function request(path: string,method='POST',body?: unknown): Request {
  return new Request(`http://localhost/functions/v1/part-one${path}`,{
    method,headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}
function ports(output: unknown=fixture()): PartOneHttpPorts & { calls: Array<{action:string;payload:Record<string,unknown>}> } {
  const calls: Array<{action:string;payload:Record<string,unknown>}>=[];
  return {calls,async authorize(){},async operation(action,payload){calls.push({action,payload});return output;}};
}

test('A20: equivalent native codes arrive at one canonical server lookup key',async()=>{
  const p=ports();
  assert.equal((await handlePartOneRequest(request('/scans','POST',scan),p)).status,202);
  const equivalent={...scan,code:{...scan.code,raw:'0305210416383',symbology:'ean13'}};
  assert.equal((await handlePartOneRequest(request('/scans','POST',equivalent),p)).status,202);
  assert.equal(p.calls[0].payload.canonicalKey,'gtin:00305210416383');
  assert.equal(p.calls[0].payload.canonicalKey,p.calls[1].payload.canonicalKey);
  assert.notEqual((p.calls[0].payload.request as typeof scan).code.raw,(p.calls[1].payload.request as typeof scan).code.raw);
});
test('A21: reopen and subscribe read durable state without another create operation',async()=>{
  const p=ports();
  await handlePartOneRequest(request(`/scans/${other}`,'GET'),p);
  await handlePartOneRequest(request(`/scans/${other}/subscriptions`),p);
  assert.deepEqual(p.calls.map(c=>c.action),['scans/read','subscriptions/create']);
});
test('A22: worker absence is typed pending and never a product miss',async()=>{
  const r=await handlePartOneRequest(request('/scans','POST',scan),ports());
  const body=await r.json();
  assert.equal(r.status,202); assert.equal(body.work,'deferred_budget');
  assert.ok(body.reasonCodes.includes('worker_unavailable')); assert.equal(body.declarationState,'none');
});
test('A22: terminal source-policy refusal uses a terminal unresolved state',async()=>{
  const r=await handlePartOneRequest(request(`/scans/${other}`,'GET'),ports(fixture({identity:'unresolved',work:'complete',reasonCodes:['source_blocked']})));
  assert.equal(r.status,200); assert.deepEqual((await r.json()).reasonCodes,['source_blocked']);
});
test('A23/A24: stale atomic save returns 409 with current revision',async()=>{
  const p=ports({conflict:true,code:'stale_result',result:fixture({resultRevision:3,display:{...fixture().display,resultRevision:3}})});
  const r=await handlePartOneRequest(request('/saves','POST',{idempotencyKey:'save-1',scanId:other,
    expectedGeneration:0,expectedResultRevision:1,selectedSnapshotId:id,selectedDeclarationId:null}),p);
  assert.equal(r.status,409); assert.equal((await r.json()).result.resultRevision,3);
});
test('A24/A25: wrong owner injection is rejected before any private operation',async()=>{
  const p=ports();
  const r=await handlePartOneRequest(request('/scans','POST',{...scan,ownerId:id}),p);
  assert.equal(r.status,400); assert.equal(p.calls.length,0);
});
test('A24: account authorization failure prevents persistence',async()=>{
  const p=ports(); p.authorize=async()=>{throw new PartOneHttpError('unauthorized',401);};
  const r=await handlePartOneRequest(request('/scans','POST',scan),p);
  assert.equal(r.status,401); assert.equal(p.calls.length,0);
});
test('A25: durable OCR commit is explicitly disabled pending retention',async()=>{
  const p=ports(); p.operation=async()=>{throw rpcErrorToHttp('P0001','PART_ONE_PRIVATE_RETENTION_DISABLED');};
  const r=await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',{
    idempotencyKey:'capture-1',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,
    expectedDeletionEpoch:0,packageObservationId:other,assets:[],observations:[],edits:[],
  }),p);
  assert.equal(r.status,423); assert.equal((await r.json()).code,'private_retention_disabled');
});
test('A28: save reopen uses the persisted snapshot-at-save projection',async()=>{
  const p=ports({saveId:id,snapshotAtSaveId:other,result:fixture()});
  const r=await handlePartOneRequest(request(`/saves/${id}`,'GET'),p);
  assert.equal(r.status,200); assert.equal((await r.json()).snapshotAtSaveId,other);
  assert.equal(p.calls[0].action,'saves/read');
});
test('A24: repeated delete returns a tombstone without restarting work',async()=>{
  const p=ports({deleted:true,saveId:id});
  const r=await handlePartOneRequest(request(`/saves/${id}`,'DELETE'),p);
  assert.equal(r.status,200); assert.equal(p.calls[0].action,'saves/delete');
});
test('request bounds apply to actual streamed bytes without Content-Length',async()=>{
  const p=ports(); const r=await handlePartOneRequest(request('/scans','POST',{...scan,unexpected:'x'.repeat(65536)}),p);
  assert.equal(r.status,413); assert.equal(p.calls.length,0);
});
test('malformed paths and required nullable omissions are rejected without effects',async()=>{
  const p=ports();
  assert.equal((await handlePartOneRequest(request('/scans/not-a-uuid','GET'),p)).status,400);
  const { requestedMarket: ignored,...incomplete}=scan; void ignored;
  assert.equal((await handlePartOneRequest(request('/scans','POST',incomplete),p)).status,400);
  assert.equal(p.calls.length,0);
});
test('A23: revision-mismatched server display cannot render',async()=>{
  const invalid={...fixture(),resultRevision:9};
  assert.equal((await handlePartOneRequest(request(`/scans/${id}`,'GET'),ports(invalid))).status,500);
});
test('database timestamps normalize to UTC ISO without touching ingredient text',()=>{
  assert.deepEqual(normalizeDatabaseDates({observedAt:'2026-10-02T12:00:00+00:00',rawText:'1,2-Hexanediol',nextCheckAfter:null}),
    {observedAt:'2026-10-02T12:00:00.000Z',rawText:'1,2-Hexanediol',nextCheckAfter:null});
});
test('authorization and tombstone RPC errors remain separate from provider failures',()=>{
  assert.equal(rpcErrorToHttp('42501','PART_ONE_NOT_FOUND').status,403);
  assert.equal(rpcErrorToHttp('P0001','PART_ONE_DELETED').status,409);
  assert.equal(rpcErrorToHttp('P0001','other').status,503);
});

test('A02 restricted UPC2/4 representations never request a public HTTP lookup key',async()=>{
  const cases=[['200000000004','upca'],['0200000000004','ean13'],['00200000000004','gtin14'],
    ['400000000008','upca'],['0400000000008','ean13'],['00400000000008','gtin14'],
    ['200000000004','ean13'],['400000000008','ean13'],['2000000000008','ean13'],['02000000000008','gtin14']];
  for(const [raw,symbology] of cases) {
    const p=ports(fixture({identity:'unresolved',work:'complete',jobId:null,reasonCodes:['unsupported_namespace']}));
    const r=await handlePartOneRequest(request('/scans','POST',{...scan,code:{...scan.code,raw,symbology}}),p);
    assert.equal(r.status,200,raw); assert.equal(p.calls[0].payload.canonicalKey,null,raw);
    assert.deepEqual(p.calls[0].payload.reasonCodes,['unsupported_namespace'],raw);
    assert.equal((await r.json()).jobId,null,raw);
  }
});
test('A01 bounded iOS EAN-labeled UPC12 stays supported without namespace guessing',async()=>{
  const p=ports();
  await handlePartOneRequest(request('/scans','POST',{...scan,code:{...scan.code,symbology:'ean13'}}),p);
  assert.equal(p.calls[0].payload.canonicalKey,'gtin:00305210416383');
  assert.equal(p.calls[0].payload.normalizationVersion,'part-one-gtin-2');
});
test('A02 genuine nonzero packaging GTIN is retained distinctly at HTTP boundary',async()=>{
  const p=ports();
  for(const raw of ['20012345000014','20305210416387','40305210416381']) {
    await handlePartOneRequest(request('/scans','POST',{...scan,code:{...scan.code,raw,symbology:'itf14'}}),p);
    assert.equal(p.calls.at(-1)?.payload.canonicalKey,`gtin:${raw}`);
    assert.notEqual(p.calls.at(-1)?.payload.canonicalKey,'gtin:00305210416383');
  }
});

// The local CLI is JavaScript with deliberately injectable fixture ports.
// @ts-ignore -- no declaration file is needed for the supervised local CLI.
import { consumeOnce } from '../scripts/part-one-worker.mjs';
import type { SourcePolicy } from '../src/contracts/PartOne.ts';
function ledgerFixture() {
  const calls:Array<{action:string;payload:Record<string,unknown>}>=[];
  const job={id,leaseToken:other,publishRevision:0,targets:[{scanId:other,generation:0,bindingRevision:1}],
    input:{raw:'3606000537538',symbology:'ean13',namespace:'gtin',retailerId:null,canonicalKey:'gtin:03606000537538',requestedMarket:null},
    checkpoints:{} as Record<string,unknown>,unknownReservations:[] as unknown[],attempts:1,maxAttempts:4};
  const rpc=async(action:string,payload:Record<string,unknown>)=>{
    calls.push({action,payload});
    if(action==='claim')return{job};
    if(action==='catalog')return null;
    if(action==='reserve')return{reservationId:other,mayDispatch:true};
    if(action==='dispatch')return{mayDispatch:true};
    if(action==='checkpoint')job.checkpoints[payload.stage as string]=structuredClone(payload.output);
    return{};
  };
  return{calls,job,rpc};
}
function workerLookupFixture() {
  const policy:SourcePolicy={policyId:id,provider:'open_facts',version:'synthetic-1',permissionEvidence:'Authorized synthetic fixture only',
    reviewedAt:'2026-10-01T00:00:00.000Z',expiresAt:'2027-01-01T00:00:00.000Z',revokedAt:null,
    operations:{lookup:true,process:true,retain:true,sharedDisplay:true,privateDisplay:false,ocr:false,cropThumbnail:false,rehost:false,hotlink:false,export:false},
    retainedFields:['identity','ingredients'],attribution:'Synthetic fixture',purgeObligations:[]};
  let fetches=0;
  return{lookupPorts:{now:()=> '2026-10-02T12:00:00.000Z',policies:[policy],configs:{open_facts:{endpoint:'https://open.synthetic.invalid/',allowedHosts:['open.synthetic.invalid'],userAgent:'Synthetic local fixture'}},
    transport:{pinsResolvedAddresses:true as const,resolve:async()=>['93.184.216.34'],fetch:async()=>{fetches++;return new Response(JSON.stringify({status:1,product:{code:'3606000537538',product_name:'Synthetic worker lotion',brands:'Fixture',ingredients_text:'Water, Glycerin'}}),{headers:{'content-type':'application/json'}});}}},get fetches(){return fetches;}};
}
test('A20 supervised consumer dispatches actual primary pipeline through durable RPC boundaries',async()=>{
  const l=ledgerFixture(),f=workerLookupFixture();
  assert.equal(await consumeOnce({rpc:l.rpc,lookupPorts:f.lookupPorts}),true);
  assert.equal(f.fetches,1);
  const actions=l.calls.map(c=>c.action);
  assert.ok(actions.indexOf('reserve')<actions.indexOf('dispatch'));
  assert.ok(actions.indexOf('checkpoint')<actions.indexOf('admit'));
  assert.deepEqual(l.calls.filter(c=>c.action==='admit').map(c=>c.payload.kind),['observation','declaration','snapshot']);
  const finished=l.calls.find(c=>c.action==='finish')!;
  assert.equal(finished.payload.expectedPublishRevision,0);
  assert.deepEqual(finished.payload.targets,l.job.targets);
  assert.equal((finished.payload.resultPatch as ScanResult).identity,'exact');
  assert.equal((finished.payload.resultPatch as ScanResult).declarationState,'partial');
});
test('A21 CLI default disabled policies complete with no quota/network/admission',async()=>{
  const l=ledgerFixture();await consumeOnce({rpc:l.rpc});
  assert.deepEqual(l.calls.map(c=>c.action),['heartbeat','claim','catalog','finish']);
  assert.deepEqual((l.calls.at(-1)!.payload.resultPatch as ScanResult).reasonCodes,['source_blocked']);
});
test('A21 consumer unknown outcome resumes durably without re-dispatch',async()=>{
  const l=ledgerFixture();l.job.unknownReservations=[{id:other}];await consumeOnce({rpc:l.rpc});
  assert.deepEqual(l.calls.map(c=>c.action),['heartbeat','claim','retry']);
  assert.deepEqual((l.calls.at(-1)!.payload.resultPatch as ScanResult).reasonCodes,['unknown_provider_outcome']);
});
test('A20 quota transaction defer relinquishes lease without stale publication or fetch',async()=>{
  const l=ledgerFixture(),f=workerLookupFixture();
  await consumeOnce({rpc:async(action:string,payload:Record<string,unknown>)=>action==='reserve'?{deferred:true,nextCheckAfter:'2026-10-03T00:00:00+00:00'}:l.rpc(action,payload),lookupPorts:f.lookupPorts});
  assert.equal(f.fetches,0);assert.equal(l.calls.some(c=>c.action==='finish'||c.action==='retry'||c.action==='admit'),false);
});
test('A21 consumer publication failure does not acknowledge provider persistence as finished',async()=>{
  const l=ledgerFixture(),f=workerLookupFixture();
  await assert.rejects(consumeOnce({rpc:async(action:string,payload:Record<string,unknown>)=>{
    if(action==='finish')throw new Error('synthetic stale publication');return l.rpc(action,payload);
  },lookupPorts:f.lookupPorts}),/stale publication/);
  assert.equal(f.fetches,1);assert.equal(l.calls.filter(c=>c.action==='admit').length,3);
  assert.equal(l.calls.some(c=>c.action==='retry'),false);
});

test('A25 private capture recovery reads the owner-scoped session without repeating a commit', async () => {
  const capture = {schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:1,captureRevision:2,deletionEpoch:0,itemId:null,candidateId:null};
  const p = ports(capture);
  const r = await handlePartOneRequest(request(`/captures/${id}`, 'GET'), p);
  assert.equal(r.status,200); assert.deepEqual(await r.json(),capture);
  assert.deepEqual(p.calls,[{action:'captures/read',payload:{id}}]);
});
test('A18/A25 private capture removal routes to an authenticated tombstone operation', async () => {
  const p = ports({deleted:true,id});
  const r = await handlePartOneRequest(request(`/captures/${id}`, 'DELETE'),p);
  assert.equal(r.status,200); assert.deepEqual(await r.json(),{deleted:true,id});
  assert.deepEqual(p.calls,[{action:'captures/delete',payload:{id}}]);
});
test('A25 enabled private commit returns a strict bound receipt on its explicit route', async () => {
  const capture = {schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:0,captureRevision:1,deletionEpoch:0,itemId:null,candidateId:null};
  const receipt={schemaVersion:1,capture,observationIds:[],declarationIds:[],assetIds:[],result:fixture()};
  const p = ports(receipt);
  const body={idempotencyKey:'private-commit-fixture',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other,
    assets:[],observations:[],edits:[]};
  const r=await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),p);
  assert.equal(r.status,200); assert.deepEqual(await r.json(),receipt);
  assert.deepEqual(p.calls,[{action:'captures/observations',payload:{captureSessionId:id,...body}}]);
});
test('A19/A25 private commit receipt cannot cross capture/result bindings or duplicate immutable ids', async () => {
  const capture={schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:0,captureRevision:1,deletionEpoch:0,itemId:null,candidateId:null};
  const body={idempotencyKey:'receipt-fixture',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other,assets:[],observations:[],edits:[]};
  for(const receipt of [
    {schemaVersion:1,capture:{...capture,scanId:id},observationIds:[],declarationIds:[],assetIds:[],result:fixture()},
    {schemaVersion:1,capture,observationIds:[id,id],declarationIds:[],assetIds:[],result:fixture()},
  ]) assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),ports(receipt))).status,500);
});
test('A25 private commit response requires a complete receipt and the requested capture id', async () => {
  const capture={schemaVersion:1,captureSessionId:other,packageObservationId:other,scanId:other,generation:0,captureRevision:1,deletionEpoch:0,itemId:null,candidateId:null};
  const body={idempotencyKey:'complete-receipt',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other,assets:[],observations:[],edits:[]};
  for(const output of [{result:fixture()}, {schemaVersion:1,capture,observationIds:[],declarationIds:[],assetIds:[],result:fixture()}])
    assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),ports(output))).status,500);
});
test('A25 duplicate sanitized asset references are rejected before private persistence', async () => {
  const asset={evidenceId:id,storageObjectId:other,contentHash:'synthetic-content-hash',width:100,height:100,metadataStripped:true};
  const body={idempotencyKey:'duplicate-assets',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other,assets:[asset,asset],observations:[],edits:[]};
  const p=ports();
  assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),p)).status,400);
  assert.equal(p.calls.length,0);
});
test('A25 UUID path casing cannot invalidate a successful owner capture response',async()=>{
  const capture={schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:0,captureRevision:0,deletionEpoch:0,itemId:null,candidateId:null};
  const p=ports(capture);
  assert.equal((await handlePartOneRequest(request(`/captures/${id.toUpperCase()}`,'GET'),p)).status,200);
  assert.deepEqual(p.calls,[{action:'captures/read',payload:{id}}]);
});
test('A25 private asset and receipt UUID uniqueness is case insensitive', async () => {
  const asset={evidenceId:id,storageObjectId:other,contentHash:'synthetic-content-hash',width:100,height:100,metadataStripped:true};
  const body={idempotencyKey:'uuid-case-assets',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other,assets:[asset,{...asset,evidenceId:id.toUpperCase(),storageObjectId:other.toUpperCase()}],observations:[],edits:[]};
  const p=ports();
  assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),p)).status,400);
  assert.equal(p.calls.length,0);
  const capture={schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:0,captureRevision:1,deletionEpoch:0,itemId:null,candidateId:null};
  const receipt={schemaVersion:1,capture,observationIds:[id,id.toUpperCase()],declarationIds:[],assetIds:[],result:fixture()};
  assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',{...body,assets:[]}),ports(receipt))).status,500);
});
test('A25 equivalent package UUID casing cannot turn a successful private commit into a projection error',async()=>{
  const capture={schemaVersion:1,captureSessionId:id,packageObservationId:other,scanId:other,generation:0,captureRevision:1,deletionEpoch:0,itemId:null,candidateId:null};
  const receipt={schemaVersion:1,capture,observationIds:[],declarationIds:[],assetIds:[],result:fixture()};
  const body={idempotencyKey:'package-uuid-case',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:other.toUpperCase(),assets:[],observations:[],edits:[]};
  assert.equal((await handlePartOneRequest(request(`/captures/${id}/observations`,'POST',body),ports(receipt))).status,200);
});
