import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartTwoController, type PartTwoTarget } from '../src/presentation/part-two/controller.ts';
import { createPartTwoTransport, savePartTwoInterpretation } from '../src/services/partTwoClient.ts';
import type { NormalizationRequest, NormalizationResult } from '../src/contracts/PartTwo.ts';
import fc from 'fast-check';
const target: PartTwoTarget = { ownerId: 'owner-a', scanId: 'scan-a', captureSessionId: null, generation: 4, evidenceRevision: 9 };
function result(request: NormalizationRequest, revision: number, state: 'pending'|'no_declaration'|'blocked'|'expired'|'parse_limit'|'failed' = 'no_declaration'): NormalizationResult {
  const base = { schemaVersion: 2 as const, scanId: request.scanId, captureSessionId: request.captureSessionId, requestId: request.requestId, authenticatedOwnerId: target.ownerId,
    bindingKey: 'authoritative-binding-a', generation: request.expectedGeneration, evidenceRevision: request.expectedEvidenceRevision, resultRevision: revision, expiresAt: '2099-01-01T00:00:00Z', permittedText: null };
  return state === 'pending' ? { ...base, state } : { ...base, state, reasonCodes: [state] };
}
function fixture() {
  let id = 0;
  const waits: { request: NormalizationRequest; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const controller = createPartTwoController({ normalize: request => new Promise((resolve, reject) => waits.push({ request, resolve, reject })) }, () => `request-${++id}`, () => {});
  controller.bind(target); return { controller, waits };
}
test('A20 every pending/terminal state rejects stale binding, owner and request fields', async () => {
  for (const state of ['pending','no_declaration','blocked','expired','parse_limit','failed'] as const) {
    for (const patch of [{authenticatedOwnerId:'owner-b'},{generation:3},{evidenceRevision:8},{scanId:'scan-b'},{captureSessionId:'foreign'},{requestId:'wrong'}]) {
      const f = fixture(), read = f.controller.refresh(); f.waits[0].resolve({ ...result(f.waits[0].request, 10, state), ...patch });
      assert.equal(await read, false); assert.equal(f.controller.getView().result, null);
    }
  }
});
test('A20 delayed pending/error cannot overwrite a newer terminal revision or cross account', async () => {
  const f = fixture(), old = f.controller.refresh(); f.controller.invalidate(); const next = f.controller.refresh();
  f.waits[1].resolve(result(f.waits[1].request, 6)); assert.equal(await next, true);
  f.waits[0].resolve(result(f.waits[0].request, 5,'pending')); assert.equal(await old, false); assert.equal(f.controller.getView().result?.resultRevision, 6);
  const delayed = f.controller.refresh(); f.controller.bind({ ...target, ownerId:'owner-b' }); f.waits[2].reject(new Error('late network failure'));
  assert.equal(await delayed,false); assert.equal(f.controller.getView().target?.ownerId,'owner-b'); assert.equal(f.controller.getView().error,null);
});
test('review a 20-second successful response survives the 15-second poll by joining in-flight work', async t => {
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),first=f.controller.refresh();t.mock.timers.tick(15000);const poll=f.controller.refresh();
 assert.equal(f.waits.length,1,'poll must join, not supersede the current request');
 t.mock.timers.tick(5000);f.waits[0].resolve(result(f.waits[0].request,12));
 assert.equal(await first,true);assert.equal(await poll,true);assert.equal(f.controller.getView().result?.resultRevision,12);assert.equal(f.controller.getView().loading,false);
});
test('review slow failure settles all joiners and permits a later retry', async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),first=f.controller.refresh();t.mock.timers.tick(15000);const poll=f.controller.refresh();assert.equal(f.waits.length,1);
 t.mock.timers.tick(5000);f.waits[0].reject(Error('slow failure'));assert.equal(await first,false);assert.equal(await poll,false);assert.equal(f.controller.getView().loading,false);
 const retry=f.controller.refresh();assert.equal(f.waits.length,2);f.waits[1].resolve(result(f.waits[1].request,13));assert.equal(await retry,true);
});
test('review timeout releases a stuck flight and a late old result cannot supersede retry or account switch', async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),old=f.controller.refresh();t.mock.timers.tick(30000);assert.equal(await old,false);assert.equal(f.controller.getView().loading,false);
 const retry=f.controller.refresh();f.waits[1].resolve(result(f.waits[1].request,15));assert.equal(await retry,true);
 f.waits[0].resolve(result(f.waits[0].request,99));await Promise.resolve();assert.equal(f.controller.getView().result?.resultRevision,15);
 const delayed=f.controller.refresh();f.controller.bind({...target,ownerId:'owner-b'});assert.equal(await delayed,false);
 f.waits[2].resolve(result(f.waits[2].request,100));await Promise.resolve();assert.equal(f.controller.getView().result,null);assert.equal(f.controller.getView().target?.ownerId,'owner-b');
});
test('A22 revisions stay monotonic across binding/release changes; equal revisions only replay identical content', async () => {
  const f = fixture();
  let read = f.controller.refresh(); f.waits[0].resolve(result(f.waits[0].request, 8)); assert.equal(await read,true);
  read=f.controller.refresh(); f.waits[1].resolve(result(f.waits[1].request,8)); assert.equal(await read,true);
  read=f.controller.refresh(); f.waits[2].resolve({...result(f.waits[2].request,7),bindingKey:'rollback-release'}); assert.equal(await read,false);
  read=f.controller.refresh(); f.waits[3].resolve(result(f.waits[3].request,8,'blocked')); assert.equal(await read,false);
  read=f.controller.refresh(); f.waits[4].resolve(result(f.waits[4].request,9,'blocked')); assert.equal(await read,true);
});
test('A24 expiry clears in-memory derived material before offline use', async () => {
  let now=1,id=0; const c=createPartTwoController({normalize:async request=>({...result(request,1),expiresAt:'1970-01-01T00:00:00.010Z'})},()=>`r-${++id}`,()=>{},()=>now);
  c.bind(target); assert.equal(await c.refresh(),true); now=10; c.expire(); assert.equal(c.getView().result,null); assert.match(c.getView().error!,/unavailable/);
  c.close(); assert.equal(c.getView().target,null);
});
test('A25 transport validates all responses and sends only bounded reference requests',async()=>{
  let sent='';const request:NormalizationRequest={schemaVersion:1,requestId:'r',scanId:'s',captureSessionId:null,expectedGeneration:0,expectedEvidenceRevision:1};
  const t=createPartTwoTransport({enabled:()=>true,invoke:async(path,body)=>{assert.equal(path,'part-two/normalize');sent=body;return{data:{...result(request,1),itemId:'forged'},error:null};}});
  await assert.rejects(t.normalize(request)); assert.deepEqual(JSON.parse(sent),request); assert(!sent.includes('owner'));
  await assert.rejects(createPartTwoTransport({enabled:()=>false,invoke:async()=>{throw Error('must not call');}}).normalize(request),/unavailable/);
});
test('A29 stale interpretation save never reports Saved and sends exact CAS guard',async()=>{
  const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const save={idempotencyKey:'exact',scanId:id(1),expectedGeneration:0,expectedResultRevision:4,selectedSnapshotId:id(2),selectedDeclarationId:id(3)};
  let payload:unknown; await assert.rejects(savePartTwoInterpretation(save,{bindingKey:'exact-binding',expectedPartTwoRevision:7},async(path,body)=>{assert.equal(path,'part-two/saves');payload=JSON.parse(body);return{data:null,error:Error('409')};}),/Details changed/);
  assert.deepEqual(payload,{save,bindingKey:'exact-binding',expectedPartTwoRevision:7});
});
test('A20/A22 generated work-state and release sequences never regress or accept a changed equal revision (seed 20261004)',async()=>{
  await fc.assert(fc.asyncProperty(fc.array(fc.record({revision:fc.integer({min:0,max:25}),state:fc.constantFrom('pending','no_declaration','blocked','expired','parse_limit','failed'),foreign:fc.boolean()}),{minLength:1,maxLength:60}),async events=>{
    const f=fixture();let model:{revision:number;state:string}|null=null;
    for(const event of events){
      const pending=f.controller.refresh(),wait=f.waits.at(-1)!;
      const reply=result(wait.request,event.revision,event.state);
      wait.resolve({...reply,...(event.foreign?{authenticatedOwnerId:'foreign'}:{})});
      const expected:boolean=!event.foreign&&(!model||event.revision>model.revision||event.revision===model.revision&&event.state===model.state);
      assert.equal(await pending,expected);
      if(expected){model={revision:event.revision,state:event.state};assert.equal(f.controller.getView().result?.resultRevision,model.revision);}
    }
  }),{seed:20261004,numRuns:100});
});
