import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartThreeController,createQuestionLatchStore } from '../src/presentation/part-three/controller.ts';
import { partThreeTarget,emptyPartThreeChoices } from '../src/presentation/part-three/target.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { canonicalJson,sha256 } from '../src/domain/part-two/hash.ts';
import { p3input,p3routine,p3assessment,p3revision } from './fixtures/part-three.ts';
import { p2id } from './fixtures/part-two-core.ts';
import type { PartThreeRequest,PartThreeResponse } from '../src/contracts/PartThreeService.ts';
import type { PersonalResultV2 } from '../src/contracts/PersonalResultV2.ts';
import type { PartThreeTarget } from '../src/presentation/part-three/target.ts';
const now=()=>Date.parse(p3input().now);
function fixture(question=false){const x=p3input(),choices=emptyPartThreeChoices();choices.intent='add';choices.use=x.requestedUse;
 if(question){const item=p3routine(p2id(70));x.context.routine=p3revision('routine',{completeness:'partial',items:[item]});x.context.assessments=[p3revision('assessment-rev',p3assessment(item))];choices.intent='unanswered';choices.comparatorId=item.id;}
 const t=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(80),generation:1},choices)!;
 const result=(requestId:string,revision=1,target:PartThreeTarget=t)=>evaluatePersonalResult({...x,binding:{...target.binding,attemptId:requestId},resultId:p2id(90),resultRevision:revision});
 return {x,t,result};
}
function client(fn:(r:PartThreeRequest)=>Promise<PartThreeResponse>|PartThreeResponse,latches=createQuestionLatchStore()){
 let ids=100;return createPartThreeController({request:async r=>fn(r)},()=>p2id(ids++),()=>{},now,latches);
}
test('complete independent binding is required for every result response',async()=>{
 const f=fixture();const binding=f.result(p2id(100)).binding;
 for(const field of Object.keys(binding)){
  const c=client(r=>{assert.equal(r.operation,'evaluate');const value=f.result((r as any).requestId);const b=value.binding as any;b[field]=Array.isArray(b[field])?['unexpected']:typeof b[field]==='number'?b[field]+1:typeof b[field]==='string'?'foreign':b[field]===null?'unexpected':{...b[field],unexpected:true};return {kind:'result',result:value,replayed:false};});
  c.bind(f.t);assert.equal(await c.evaluate(),false,field);assert.equal(c.getView().result,null);c.close();
 }
});
test('equal revision accepts identical replay only and lower revisions hide the judgment',async()=>{
 const f=fixture();let revision=2,alter=false;
 const c=client(r=>{const id=r.operation==='evaluate'?r.requestId:p2id(100);const value=f.result(id,revision);if(alter)value.refinementStatus='abstained';return {kind:'result',result:value,replayed:r.operation==='read'};});
 c.bind(f.t);assert(await c.evaluate());assert(await c.renew());alter=true;assert.equal(await c.renew(),false);assert.equal(c.getView().result,null);alter=false;revision=1;assert.equal(await c.renew(),false);c.close();
});
test('late owner/scan response, offline and expiry cannot publish cached personal bodies',async()=>{
 const f=fixture();let resolve!:(r:PartThreeResponse)=>void;let requestId='';const c=client(r=>{requestId=(r as any).requestId;return new Promise(done=>{resolve=done;});});c.bind(f.t);const pending=c.evaluate();c.bind({...f.t,binding:{...f.t.binding,ownerId:p2id(9)}});resolve({kind:'result',result:f.result(requestId),replayed:false});assert.equal(await pending,false);assert.equal(c.getView().result,null);c.close();
 const online=client(r=>({kind:'result',result:f.result(r.operation==='evaluate'?r.requestId:p2id(100)),replayed:false}));online.bind(f.t);assert(await online.evaluate());online.setOnline(false);assert.equal(online.getView().result,null);assert.equal(online.getView().historical,null);assert.equal(await online.renew(),false);online.close();
 let time=now();const timed=createPartThreeController({request:async r=>({kind:'result',result:f.result((r as any).requestId),replayed:false})},()=>p2id(100),()=>{},()=>time);timed.bind(f.t);await timed.evaluate();time=Date.parse(timed.getView().result!.validUntil);timed.expire();assert.equal(timed.getView().result,null);timed.close();
});
test('first question latches only at visible exposure and skip blocks replacement, transient refusal and reopen',async()=>{
 const f=fixture(true),latches=createQuestionLatchStore();let currentId=p2id(100),different=false,events:PartThreeRequest[]=[];
 const c=client(r=>{if(r.operation==='question_event'){events.push(r);return {kind:'acknowledged'};}if(r.operation==='evaluate')currentId=r.requestId;const result=f.result(currentId);assert(result.question);if(different)result.question.id='late-question';return {kind:'result',result,replayed:false};},latches);
 c.bind(f.t);assert(await c.evaluate());assert.equal(latches.get(canonicalJson([f.t.binding.ownerId,1,f.t.binding.encounterId])),undefined);assert.equal(events.length,0);assert.equal(c.exposeQuestion('old-hidden-question'),null);assert.equal(events.length,0);c.exposeQuestion();assert.equal(latches.get(canonicalJson([f.t.binding.ownerId,1,f.t.binding.encounterId]))?.id,c.getView().question?.id);assert.equal(events[0]?.operation,'question_event');c.questionEvent('skip');assert.equal(c.getView().question,null);different=true;await c.renew();assert.equal(c.getView().question,null);c.bind(null);c.bind(f.t);await c.evaluate();assert.equal(c.getView().question,null);c.close();c.bind(f.t);await c.evaluate();assert.equal(c.getView().question,null);c.close();
});
test('purposeful comparison input allows the first useful question; historical reopen remains suppressed',async()=>{
 const f=fixture(true);for(const historical of [false,true]){const c=client(r=>r.operation==='question_event'?{kind:'acknowledged'}:{kind:'result',result:f.result((r as any).requestId),replayed:false});c.bind({...f.t,request:{...f.t.request,savedAssessmentId:historical?p2id(88):null}});if(!historical)c.questionEvent('interact');await c.evaluate();if(historical)assert.equal(c.getView().question,null);else assert.equal(c.getView().question?.id,'question:replace-or-add');c.close();}
});
test('assessment save rechecks exact revision and sends canonical binding hash independently',async()=>{
 const f=fixture();let packet:PersonalResultV2|null=null,save:Extract<PartThreeRequest,{operation:'save'}>|null=null;
 const c=client(r=>{if(r.operation==='evaluate'){packet=f.result(r.requestId);return {kind:'result',result:packet,replayed:false};}if(r.operation==='read')return {kind:'result',result:packet!,replayed:true};if(r.operation==='save'){save=r;return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:r.expectedResultRevision,replayed:false};}throw Error('Unexpected operation');});c.bind(f.t);await c.evaluate();assert.equal(await c.save(),p2id(88));assert.equal((save as any).expectedBindingHash,sha256(canonicalJson(packet!.binding)));assert.equal((save as any).expectedResultRevision,packet!.resultRevision);c.close();
 const changed=client(r=>({kind:'result',result:f.result(r.operation==='evaluate'?r.requestId:p2id(100),r.operation==='read'?2:1),replayed:false}));changed.bind(f.t);await changed.evaluate();assert.equal(await changed.save(),null);assert.equal(changed.getView().result,null);changed.close();
});
test('historical reads validate saved ID and owner, and never become current authority',async()=>{
 const f=fixture();let foreign=false;
 const c=client(r=>{assert.equal(r.operation,'read_saved');const result=f.result(p2id(100));if(foreign)result.binding.ownerId=p2id(9);return {kind:'historical',savedAssessmentId:p2id(88),savedAt:f.x.now,assessmentWhenSaved:result,currentAssessment:'unavailable'};});c.bind(f.t);assert(await c.readSaved(p2id(88)));assert.equal(c.getView().result,null);foreign=true;assert.equal(await c.readSaved(p2id(88)),false);c.setOnline(false);assert.equal(c.getView().historical,null);c.close();
});
test('every encounter input field is part of display/save authority',async()=>{
 const f=fixture();for(const mutate of [
  (r:PersonalResultV2)=>{r.binding.encounterInputs.candidateRoutineItemId=p2id(71);},
  (r:PersonalResultV2)=>{r.binding.encounterInputs.selectedManualReportIds=[p2id(72)];},
  (r:PersonalResultV2)=>{r.binding.encounterInputs.use.purpose='cleansing';},
  (r:PersonalResultV2)=>{r.binding.encounterInputs.use.site='hands';},
  (r:PersonalResultV2)=>{r.binding.encounterInputs.use.useForm='rinse_off';},
 ]){const c=client(r=>{const value=f.result((r as any).requestId);mutate(value);return {kind:'result',result:value,replayed:false};});c.bind(f.t);assert.equal(await c.evaluate(),false);assert.equal(await c.save(),null);c.close();}
});
test('local gate prevents any transport invocation and responses must pass strict schemas',async()=>{
 const {createPartThreeTransport}=await import('../src/services/partThreeClient.ts');let calls=0;
 const transport=createPartThreeTransport({enabled:()=>false,invoke:async()=>{calls++;return {data:{kind:'acknowledged'},error:null};}});
 await assert.rejects(transport.request({operation:'list_saved'}));assert.equal(calls,0);
 const invalid=createPartThreeTransport({enabled:()=>true,invoke:async()=>({data:{kind:'acknowledged',privateHealth:'unexpected'},error:null})});await assert.rejects(invalid.request({operation:'list_saved'}));
});
test('reopening never automatically re-exposes even the first unanswered question',async()=>{
 const f=fixture(true),latches=createQuestionLatchStore();const c=client(r=>r.operation==='question_event'?{kind:'acknowledged'}:{kind:'result',result:f.result((r as any).requestId),replayed:false},latches);c.bind(f.t);await c.evaluate();assert(c.getView().question);c.exposeQuestion();c.close();c.bind(f.t);await c.evaluate();assert.equal(c.getView().question,null);c.close();
});

test('explicit refresh after a refused read reacquires current assessment',async()=>{
 const f=fixture(),calls:string[]=[];
 const c=client(r=>{calls.push(r.operation);if(r.operation==='evaluate'){const result=f.result(r.requestId);result.resultId=r.requestId;return {kind:'result',result,replayed:false};}if(r.operation==='read')return {kind:'unavailable',reason:'evidence_unavailable'};throw Error('Unexpected request');});
 c.bind(f.t);assert(await c.evaluate());assert.equal(await c.renew(),false);assert.equal(c.getView().result,null);c.allowOptionalRefresh();c.invalidate();assert.equal(await c.renew(),true);assert(c.getView().result);assert.deepEqual(calls,['evaluate','read','evaluate']);c.close();
});


test('background suspension keeps the valid in-memory packet and resumes with an authorized read',async()=>{
 const f=fixture();let packet:PersonalResultV2|null=null;const calls:string[]=[];const c=client(r=>{calls.push(r.operation);if(r.operation==='evaluate'){packet=f.result(r.requestId);return {kind:'result',result:packet,replayed:false};}if(r.operation==='read')return {kind:'result',result:packet!,replayed:true};throw Error('unexpected');});
 c.bind(f.t);await c.evaluate();const before=c.getView().result;c.suspend();assert.deepEqual(c.getView().result,before);await c.renew();assert.deepEqual(calls,['evaluate','read']);c.setOnline(false);assert.equal(c.getView().result,null);c.close();
});
