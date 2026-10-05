import assert from 'node:assert/strict';
import test from 'node:test';
import {createPartThreeController} from '../src/presentation/part-three/controller.ts';
import {partThreeTarget,emptyPartThreeChoices} from '../src/presentation/part-three/target.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {p3input} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
import type {PartThreeRequest} from '../src/contracts/PartThreeService.ts';
import type {PersonalResultV2} from '../src/contracts/PersonalResultV2.ts';
for(const committed of [false,true])test(`uncertain Save retries exact request after lease expiry (committed=${committed})`,async()=>{
 const x=p3input(),choices=emptyPartThreeChoices();choices.intent='add';choices.use=x.requestedUse;
 const t=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(80),generation:1},choices)!;
 let clock=Date.parse(x.now),id=100,packet:PersonalResultV2|null=null,reads=0,writes=0,commits=0;
 const requests:Array<Extract<PartThreeRequest,{operation:'save'}>>=[];
 const c=createPartThreeController({request:async r=>{
  if(r.operation==='evaluate'){packet=evaluatePersonalResult({...x,binding:{...t.binding,attemptId:r.requestId},resultId:p2id(90),resultRevision:1});return {kind:'result',result:packet,replayed:false};}
  if(r.operation==='read'){reads++;assert(packet);return {kind:'result',result:packet,replayed:true};}
  if(r.operation==='save'){requests.push(r);writes++;if(writes===1){if(committed)commits++;throw Error('Transport lost');}if(!committed)commits++;return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:committed};}
  return {kind:'acknowledged'};
 }},()=>p2id(id++),()=>{},()=>clock);
 c.bind(t);assert(await c.evaluate());assert.equal(await c.save(),null);assert.equal(c.getView().pendingSave,true);assert.match(c.getView().error!,/confirmation is pending/);
 assert.equal(await c.evaluate(),false,'Uncertain commit cannot be replaced by a new evaluation/save identity');
 clock=Date.parse(c.getView().result!.validUntil)+1;c.expire();assert.equal(c.getView().result,null);
 assert.equal(await c.save(),p2id(88));assert.deepEqual(requests[0],requests[1]);assert.equal(reads,1,'Receipt retry bypasses expired current read');assert.equal(commits,1);assert.equal(c.getView().pendingSave,false);c.close();
});
test('pending Save remains owner-bound and cannot replay after account change',async()=>{
 const x=p3input(),choices=emptyPartThreeChoices();choices.intent='add';choices.use=x.requestedUse;const t=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(80),generation:1},choices)!;let packet:PersonalResultV2|null=null,writes=0;
 const c=createPartThreeController({request:async r=>{if(r.operation==='evaluate'){packet=evaluatePersonalResult({...x,binding:{...t.binding,attemptId:r.requestId},resultId:p2id(90),resultRevision:1});return {kind:'result',result:packet,replayed:false};}if(r.operation==='read'){assert(packet);return {kind:'result',result:packet,replayed:true};}if(r.operation==='save'){writes++;throw Error('Lost');}return {kind:'acknowledged'};}},()=>p2id(100),()=>{},()=>Date.parse(x.now));c.bind(t);await c.evaluate();await c.save();c.bind({...t,binding:{...t.binding,accountGeneration:2}});assert.equal(await c.save(),null);assert.equal(writes,1);assert.equal(c.getView().pendingSave,false);c.close();
});
test('an uncertain Save for A neither blocks B nor attaches its receipt to B',async()=>{
 const x=p3input(),choices=emptyPartThreeChoices();choices.intent='add';choices.use=x.requestedUse;
 const a=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(80),generation:1},choices)!;
 const b=structuredClone(a);b.request.scanId=p2id(81);b.binding.scanId=p2id(81);b.request.encounterId=p2id(82);b.binding.encounterId=p2id(82);
 let serial=100,active=a,packet:PersonalResultV2|null=null,writes=0;const requests:Array<Extract<PartThreeRequest,{operation:'save'}>>=[];
 const c=createPartThreeController({request:async r=>{if(r.operation==='evaluate'){packet=evaluatePersonalResult({...x,binding:{...active.binding,attemptId:r.requestId},resultId:active===a?p2id(90):p2id(91),resultRevision:1});return {kind:'result',result:packet,replayed:false};}if(r.operation==='read'){assert(packet);return {kind:'result',result:packet,replayed:true};}if(r.operation==='save'){requests.push(r);writes++;if(writes===1)throw Error('A committed but response lost');return {kind:'saved',savedAssessmentId:r.resultId===p2id(90)?p2id(88):p2id(89),resultRevision:r.expectedResultRevision,replayed:r.resultId===p2id(90)};}return {kind:'acknowledged'};}},()=>p2id(serial++),()=>{},()=>Date.parse(x.now));
 c.bind(a);await c.evaluate();await c.save();c.close();active=b;c.bind(b);assert.equal(c.getView().pendingSave,false);assert(await c.evaluate());assert.equal(await c.save(),p2id(89));assert.equal(c.getView().savedAssessmentId,p2id(89));
 c.close();active=a;c.bind(a);assert.equal(c.getView().pendingSave,true);assert.equal(await c.save(),p2id(88));assert.deepEqual(requests[0],requests[2]);c.close();
});
