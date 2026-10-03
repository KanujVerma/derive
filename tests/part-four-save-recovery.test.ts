import assert from 'node:assert/strict';
import test from 'node:test';
import {createPartThreeSaveRecoveryStore,saveRecoveryStorageKey,type SaveRecoveryStorage,type SaveRecoveryScope,type PendingSaveRequest} from '../src/presentation/part-three/saveRecovery.ts';
import {createPartThreeController,createQuestionLatchStore} from '../src/presentation/part-three/controller.ts';
import {partThreeTarget,emptyPartThreeChoices} from '../src/presentation/part-three/target.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {p3input} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
import type {PersonalResultV2} from '../src/contracts/PersonalResultV2.ts';
import type {PartThreeRequest} from '../src/contracts/PartThreeService.ts';
import type {PartThreeTransport} from '../src/services/partThreeClient.ts';

const account={ownerId:p2id(1),accountGeneration:123};
const scope:SaveRecoveryScope={...account,encounterId:p2id(80),scanId:p2id(81),captureSessionId:p2id(82)};
const request:PendingSaveRequest={operation:'save',requestId:p2id(100),resultId:p2id(90),expectedResultRevision:1,expectedBindingHash:'a'.repeat(64),expectedPacketHash:'b'.repeat(64)};
function memory(backing=new Map<string,string>()) {
 const storage:SaveRecoveryStorage={getItem:async key=>backing.get(key)??null,setItem:async(key,value)=>{backing.set(key,value);}};
 return {storage,backing};
}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function fixture() {
 const x=p3input(),choices=emptyPartThreeChoices();choices.intent='add';choices.use=x.requestedUse;
 const t=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:123,encounterId:p2id(80),generation:1},choices)!;
 let clock=Date.parse(x.now),serial=100,packet:PersonalResultV2|null=null,reads=0,evaluations=0;
 const writes:PendingSaveRequest[]=[];
 let save:(r:PendingSaveRequest)=>ReturnType<PartThreeTransport['request']>=async r=>({kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:false});
 const transport:PartThreeTransport={request:async r=>{
  if(r.operation==='evaluate'){evaluations++;packet=evaluatePersonalResult({...x,binding:{...t.binding,attemptId:r.requestId},resultId:p2id(90),resultRevision:1});return {kind:'result',result:packet,replayed:false};}
  if(r.operation==='read'){reads++;assert(packet);return {kind:'result',result:packet,replayed:true};}
  if(r.operation==='save'){assert(r.expectedPacketHash);writes.push(structuredClone(r) as PendingSaveRequest);return save(r as PendingSaveRequest);}
  return {kind:'acknowledged'};
 }};
 const a={ownerId:t.binding.ownerId,accountGeneration:t.binding.accountGeneration};
 const s:SaveRecoveryScope={...a,encounterId:t.binding.encounterId,scanId:t.binding.scanId,captureSessionId:t.binding.captureSessionId};
 return {t,a,s,writes,get reads(){return reads;},get evaluations(){return evaluations;},setSave(fn:typeof save){save=fn;},expire(){clock=Date.parse(packet!.validUntil)+1;},controller(store:ReturnType<typeof createPartThreeSaveRecoveryStore>){return createPartThreeController(transport,()=>p2id(serial++),()=>{},()=>clock,createQuestionLatchStore(),store);}};
}

test('journal admits metadata only and discovers the exact scan/capture/encounter',async()=>{
 const {storage,backing}=memory(),store=createPartThreeSaveRecoveryStore(storage,()=>account);
 await store.retain(scope,request);
 const disk=JSON.parse(backing.get(saveRecoveryStorageKey(account.ownerId))!);
 assert.deepEqual(Object.keys(disk.attempts[0]).sort(),['request','scope']);
 assert.deepEqual(disk.attempts[0],{scope,request});
 assert(!saveRecoveryStorageKey(account.ownerId).includes(account.ownerId));
 assert.deepEqual(await store.discover({...account,scanId:scope.scanId,captureSessionId:scope.captureSessionId}),{state:'pending',scope,request});
 assert.equal((await store.discover({...account,scanId:p2id(83),captureSessionId:scope.captureSessionId})).state,'none');
 assert.equal(await store.recover({...scope,captureSessionId:null}),null);
 await assert.rejects(store.retain(scope,{...request,source:'private note'} as PendingSaveRequest));
 await assert.rejects(store.retain({...scope,context:'private skin context'} as SaveRecoveryScope,request));
 await assert.rejects(store.retain(scope,{...request,requestId:p2id(101)}));
 assert.deepEqual(await store.recover(scope),request);
});

for(const committed of [false,true])test(`process restart retries exact original Save after lease expiry (committed=${committed})`,async()=>{
 const f=fixture(),first=memory();let attempts=0,commits=0;
 f.setSave(async r=>{if(++attempts===1){if(committed)commits++;throw Error('Lost confirmation');}if(!committed)commits++;return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:committed};});
 const c=f.controller(createPartThreeSaveRecoveryStore(first.storage,()=>f.a));c.bind(f.t);assert(await c.evaluate());assert.equal(await c.save(),null);c.close();f.expire();
 // New storage facade and controller discard all process-local maps and latches.
 const restarted=f.controller(createPartThreeSaveRecoveryStore(memory(first.backing).storage,()=>f.a));restarted.bind(f.t);
 assert.equal(await restarted.evaluate(),false);assert.equal(restarted.getView().result,null);assert.equal(restarted.getView().pendingSave,true);
 assert.equal(await restarted.save(),p2id(88));assert.deepEqual(f.writes[0],f.writes[1]);assert.equal(f.reads,1);assert.equal(f.evaluations,1);assert.equal(commits,1);
 assert.equal(await createPartThreeSaveRecoveryStore(memory(first.backing).storage,()=>f.a).recover(f.s),null);restarted.close();
});

test('Save never reaches the server before durable retain; close during retain is recoverable',async()=>{
 const f=fixture(),m=memory(),entered=deferred<void>(),finish=deferred<void>();
 const storage:SaveRecoveryStorage={getItem:m.storage.getItem,setItem:async(key,value)=>{m.backing.set(key,value);entered.resolve();await finish.promise;}};
 const c=f.controller(createPartThreeSaveRecoveryStore(storage,()=>f.a));c.bind(f.t);await c.evaluate();const saving=c.save();await entered.promise;
 assert.equal(f.writes.length,0);c.close();finish.resolve();assert.equal(await saving,null);
 const restarted=f.controller(createPartThreeSaveRecoveryStore(memory(m.backing).storage,()=>f.a));restarted.bind(f.t);assert.equal(await restarted.save(),p2id(88));assert.equal(f.reads,1);assert.equal(f.writes.length,1);restarted.close();
});

test('uncertain disk write retains its nonce and confirmed Save with failed cleanup remains replayable',async()=>{
 const f=fixture(),m=memory();let fail=true,commits=0;
 const storage:SaveRecoveryStorage={getItem:m.storage.getItem,setItem:async(key,value)=>{m.backing.set(key,value);if(fail)throw Error('Disk completion lost');}};
 const c=f.controller(createPartThreeSaveRecoveryStore(storage,()=>f.a));c.bind(f.t);await c.evaluate();assert.equal(await c.save(),null);assert.equal(f.writes.length,0);
 const first=JSON.parse(m.backing.get(saveRecoveryStorageKey(f.a.ownerId))!).attempts[0].request;
 fail=false;f.setSave(async r=>{commits++;return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:false};});
 // Fail cleanup before it writes, preserving the original request after commit.
 const cleanupStorage:SaveRecoveryStorage={getItem:m.storage.getItem,setItem:async(key,value)=>{if(JSON.parse(value).attempts?.length===0)throw Error('Cleanup failed');m.backing.set(key,value);}};
 c.close();const next=f.controller(createPartThreeSaveRecoveryStore(cleanupStorage,()=>f.a));next.bind(f.t);assert.equal(await next.save(),null);assert.deepEqual(f.writes[0],first);assert.equal(next.getView().pendingSave,true);next.close();
 f.setSave(async r=>({kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:true}));
 const restarted=f.controller(createPartThreeSaveRecoveryStore(memory(m.backing).storage,()=>f.a));restarted.bind(f.t);assert.equal(await restarted.save(),p2id(88));assert.deepEqual(f.writes[1],first);assert.equal(commits,1);restarted.close();
});

test('failed durable write blocks server Save and corrupt storage blocks evaluation and Save',async()=>{
 const f=fixture(),m=memory(),storage:SaveRecoveryStorage={getItem:m.storage.getItem,setItem:async()=>{throw Error('No disk');}};
 const c=f.controller(createPartThreeSaveRecoveryStore(storage,()=>f.a));c.bind(f.t);await c.evaluate();assert.equal(await c.save(),null);assert.equal(f.writes.length,0);c.close();
 m.backing.set(saveRecoveryStorageKey(f.a.ownerId),'{broken');
 const restarted=f.controller(createPartThreeSaveRecoveryStore(memory(m.backing).storage,()=>f.a));restarted.bind(f.t);assert.equal(await restarted.evaluate(),false);assert.equal(await restarted.save(),null);assert.match(restarted.getView().error!,/recovery is unavailable/);assert.equal(f.evaluations,1);assert.equal(f.writes.length,0);restarted.close();
});

test('same-owner scan recovery is isolated; multiple encounter candidates are ambiguous',async()=>{
 const m=memory(),store=createPartThreeSaveRecoveryStore(m.storage,()=>account),b={...scope,scanId:p2id(84),encounterId:p2id(85)};
 await store.retain(scope,request);await store.retain(b,{...request,requestId:p2id(101),resultId:p2id(91)});
 await store.complete(b,{...request,requestId:p2id(101),resultId:p2id(91)});assert.deepEqual(await store.recover(scope),request);
 await store.retain({...scope,encounterId:p2id(86)},{...request,requestId:p2id(102)});
 assert.equal((await store.discover({...account,scanId:scope.scanId,captureSessionId:scope.captureSessionId})).state,'ambiguous');
 assert.equal((await store.discover({...account,scanId:scope.scanId,captureSessionId:null})).state,'none');
});

test('retirement fences a late retain and survives restart without owner/request identifiers',async()=>{
 const m=memory(),entered=deferred<void>(),finish=deferred<void>();let first=true,current:{ownerId:string;accountGeneration:number}|null=account;
 const storage:SaveRecoveryStorage={getItem:m.storage.getItem,setItem:async(key,value)=>{if(first){first=false;entered.resolve();await finish.promise;}m.backing.set(key,value);}};
 const store=createPartThreeSaveRecoveryStore(storage,()=>current),retaining=store.retain(scope,request);await entered.promise;
 current=null;const retiring=store.retireOwner(account.ownerId,account.accountGeneration);finish.resolve();await assert.rejects(retaining);await retiring;
 const disk=m.backing.get(saveRecoveryStorageKey(account.ownerId))!;assert(!disk.includes(account.ownerId));assert(!disk.includes(request.requestId));assert.equal(JSON.parse(disk).status,'retired');
 const restarted=createPartThreeSaveRecoveryStore(memory(m.backing).storage,()=>account);await assert.rejects(restarted.recover(scope));await assert.rejects(restarted.retain(scope,request));
 current={...account,accountGeneration:456};const fresh=createPartThreeSaveRecoveryStore(storage,()=>current);await fresh.retain({...scope,accountGeneration:456},request);
 await store.retireOwner(account.ownerId,123);assert.deepEqual(await fresh.recover({...scope,accountGeneration:456}),request,'Old erasure cannot erase the fresh session');
});

test('stale read completion and failed erasure cannot revive account data',async()=>{
 const m=memory(),store=createPartThreeSaveRecoveryStore(m.storage,()=>account);await store.retain(scope,request);
 const gate=deferred<string|null>();let current:{ownerId:string;accountGeneration:number}|null=account;
 const slow=createPartThreeSaveRecoveryStore({getItem:()=>gate.promise,setItem:m.storage.setItem},()=>current);
 const reading=slow.recover(scope);await Promise.resolve();current={...account,ownerId:p2id(2)};gate.resolve(m.backing.get(saveRecoveryStorageKey(account.ownerId))!);await assert.rejects(reading);
 const failed=createPartThreeSaveRecoveryStore({getItem:m.storage.getItem,setItem:async()=>{throw Error('Erasure failure');}},()=>account);
 await assert.rejects(failed.retireOwner(account.ownerId,123));await assert.rejects(failed.recover(scope));
});

test('confirmed-owner erase rechecks authority after a slow read and preserves a concurrently fresh generation',async()=>{
 const m=memory(),entered=deferred<void>(),finish=deferred<void>();let current:{ownerId:string;accountGeneration:number}|null=account,slow=false;
 const storage:SaveRecoveryStorage={getItem:async key=>{const value=await m.storage.getItem(key);if(slow){slow=false;entered.resolve();await finish.promise;}return value;},setItem:m.storage.setItem};
 const store=createPartThreeSaveRecoveryStore(storage,()=>current);await store.retain(scope,request);
 current=null;slow=true;const erasing=store.eraseOwner(account.ownerId);await entered.promise;
 current={...account,accountGeneration:1};finish.resolve();await erasing;
 assert(m.backing.get(saveRecoveryStorageKey(account.ownerId))!.includes(request.requestId),'A superseded owner-erasure read cannot delete an active session journal');
 const freshScope={...scope,accountGeneration:1},freshRequest={...request,requestId:p2id(101)};
 await store.retain(freshScope,freshRequest);await store.eraseOwner(account.ownerId);assert.deepEqual(await store.recover(freshScope),freshRequest,'A late older retirement cannot erase the fresh session');
});

test('invalid, foreign, duplicate or oversized persisted records fail closed',async()=>{
 const base={version:'part-three-save-recovery/v1',status:'active',...account,attempts:[{scope,request}]};
 const bad:unknown[]=[{...base,ownerId:p2id(2)},{...base,attempts:[{scope:{...scope,ownerId:p2id(2)},request}]},{...base,attempts:[{scope,request},{scope,request:{...request,requestId:p2id(101)}}]},{...base,attempts:[{scope,request},{scope:{...scope,scanId:p2id(83)},request}]},{...base,attempts:[{scope,request:{...request,expectedPacketHash:'invalid'}}]},{...base,notes:'private'},{...base,attempts:[{scope,request:{...request,source:'private'}}]}];
 for(const value of [...bad,'x'.repeat(65537)]){const m=memory();m.backing.set(saveRecoveryStorageKey(account.ownerId),typeof value==='string'?value:JSON.stringify(value));const store=createPartThreeSaveRecoveryStore(m.storage,()=>account);await assert.rejects(store.recover(scope));await assert.rejects(store.discover({...account,scanId:scope.scanId,captureSessionId:scope.captureSessionId}));}
});

test('unexpected receipt revision preserves exact durable request rather than clearing it',async()=>{
 const f=fixture(),m=memory(),store=createPartThreeSaveRecoveryStore(m.storage,()=>f.a);f.setSave(async r=>({kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision+1,replayed:false}));
 const c=f.controller(store);c.bind(f.t);await c.evaluate();assert.equal(await c.save(),null);assert.deepEqual(await store.recover(f.s),f.writes[0]);assert.equal(c.getView().savedAssessmentId,null);c.close();
});

test('an unexpected operation response is uncertain and cannot remove durable recovery metadata',async()=>{
 const f=fixture(),m=memory(),store=createPartThreeSaveRecoveryStore(m.storage,()=>f.a);f.setSave(async()=>({kind:'acknowledged'}));
 const c=f.controller(store);c.bind(f.t);await c.evaluate();assert.equal(await c.save(),null);assert.deepEqual(await store.recover(f.s),f.writes[0]);assert.equal(c.getView().pendingSave,true);c.close();
});

test('late receipt for scan A cannot publish its saved identifier onto scan B',async()=>{
 const f=fixture(),m=memory(),gate=deferred<Awaited<ReturnType<PartThreeTransport['request']>>>();f.setSave(()=>gate.promise);
 const c=f.controller(createPartThreeSaveRecoveryStore(m.storage,()=>f.a));c.bind(f.t);await c.evaluate();const saving=c.save();while(!f.writes.length)await new Promise(resolve=>setImmediate(resolve));
 const b=structuredClone(f.t);b.binding.scanId=p2id(84);b.request.scanId=p2id(84);b.binding.encounterId=p2id(85);b.request.encounterId=p2id(85);c.bind(b);
 gate.resolve({kind:'saved',savedAssessmentId:p2id(88),resultRevision:1,replayed:false});assert.equal(await saving,null);assert.equal(c.getView().savedAssessmentId,null);assert.equal(c.getView().pendingSave,false);assert.equal(await createPartThreeSaveRecoveryStore(m.storage,()=>f.a).recover(f.s),null);c.close();
});
