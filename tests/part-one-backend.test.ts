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
