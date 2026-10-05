import assert from 'node:assert/strict';
import test from 'node:test';
import {componentHarness} from './ux-profile-render.ts';
import {createPartThreeSaveRecoveryStore,type SaveRecoveryStorage} from '../src/presentation/part-three/saveRecovery.ts';
import type {PartThreePorts} from '../src/components/check/part-three/usePartThreeCheck.ts';
import type {PartThreeRequest} from '../src/contracts/PartThreeService.ts';
import {p3input} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('actual Check hook restores durable encounter before evaluation and preserves uncertainty across readiness events',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});
 const x=p3input(),a={ownerId:x.context.ownerId,accountGeneration:123},scope={...a,encounterId:p2id(80),scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId};
 const request={operation:'save' as const,requestId:p2id(100),resultId:p2id(90),expectedResultRevision:1,expectedBindingHash:'a'.repeat(64),expectedPacketHash:'b'.repeat(64)};
 const data=new Map<string,string>(),storage:SaveRecoveryStorage={getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value);}},journal=createPartThreeSaveRecoveryStore(storage,()=>a);await journal.retain(scope,request);
 let session:ReturnType<PartThreePorts['session']>=null,listener=()=>{},serial=200;const calls:PartThreeRequest[]=[];
 const ports:PartThreePorts={context:async()=>x.context,session:()=>session,recovery:journal,subscribeSession:fn=>{listener=fn;return ()=>{};},recoverSession:async(owner,scan,capture)=>{
  assert.equal(owner,a.ownerId);assert.equal(scan,scope.scanId);assert.equal(capture,scope.captureSessionId);
  const discovered=await journal.discover({...a,scanId:scan,captureSessionId:capture});assert.equal(discovered.state,'pending');if(discovered.state!=='pending')throw Error('Missing pending');
  session={...a,encounterId:discovered.scope.encounterId};return session;
 },createId:()=>p2id(serial++),transport:{request:async r=>{calls.push(r);if(r.operation==='save')return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:1,replayed:true};return {kind:'acknowledged'};}}};
 const details={target:{ownerId:a.ownerId,scanId:scope.scanId,captureSessionId:scope.captureSessionId,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null};
 const h=componentHarness('tests/fixtures/part-three-recovery-probe.ts','RecoveryProbe',{ownerId:a.ownerId,details,enabled:true,ports},{effects:true,modules:{'../../../services/productCatalog':{createCatalogRequestId:()=>p2id(serial++)}}});
 try {
  for(let i=0;i<8;i++){h.render();await settle();}let check=h.render()[0].props.check;
  assert.equal(check.view.target.binding.encounterId,scope.encounterId);assert.equal(check.view.pendingSave,true);assert.equal(check.view.result,null);assert.equal(calls.filter(r=>r.operation==='evaluate').length,0);
  session=null;listener();for(let i=0;i<8;i++){h.render();await settle();}check=h.render()[0].props.check;
  assert.equal(check.view.pendingSave,true);assert.deepEqual(await journal.recover(scope),request,'Auth readiness notifications do not erase the durable Save');
  assert.equal(await check.save(),p2id(88));assert.deepEqual(calls.filter(r=>r.operation==='save'),[request]);assert.equal(calls.filter(r=>r.operation==='read'||r.operation==='evaluate').length,0);
 }finally{h.dispose();}
});

test('ambiguous or corrupt encounter discovery blocks live hook binding and exposes an honest retry state',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});
 const x=p3input(),calls:PartThreeRequest[]=[];let serial=200;
 const ports:PartThreePorts={context:async()=>x.context,session:()=>null,recoverSession:async()=>{throw Error('Ambiguous metadata');},createId:()=>p2id(serial++),transport:{request:async r=>{calls.push(r);return {kind:'acknowledged'};}}};
 const details={target:{ownerId:x.context.ownerId,scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null};
 const h=componentHarness('tests/fixtures/part-three-recovery-probe.ts','RecoveryProbe',{ownerId:x.context.ownerId,details,enabled:true,ports},{effects:true,modules:{'../../../services/productCatalog':{createCatalogRequestId:()=>p2id(serial++)}}});
 try{for(let i=0;i<6;i++){h.render();await settle();}const check=h.render()[0].props.check;assert.equal(check.view.target,null);assert.equal(check.view.result,null);assert.match(check.view.error,/Save recovery is unavailable/);assert.equal(await check.save(),null);assert.equal(calls.length,0);}finally{h.dispose();}
});
