import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePersonalRequest, type PartThreePorts } from '../supabase/functions/part-three/handler.ts';
import { partThreeTarget, type PartThreeChoices } from '../src/presentation/part-three/target.ts';
import { p3input, p3routine, p3assessment, p3revision } from './fixtures/part-three.ts';
import { p2id } from './fixtures/part-two-core.ts';
import type { PartThreeEvaluateRequest } from '../src/contracts/PartThreeService.ts';
import { canonicalJson } from '../src/domain/part-two/hash.ts';
function host(enabled=true, count=1) {
 const x=p3input(); x.context.profile!.id=p2id(201);
 const items=Array.from({length:count},(_,n)=>{const item=p3routine(p2id(210+n));item.reference={kind:'manual',name:`Current lotion ${n+1}`};return item;});
 x.context.routine=p3revision(p2id(220),{completeness:'complete',items});
 x.context.assessments=items.map((item,n)=>{const report=p3assessment(item);report.id=p2id(230+n);return p3revision(p2id(240+n),report);});
 const request:PartThreeEvaluateRequest={operation:'evaluate',requestId:p2id(250),encounterId:p2id(251),accountGeneration:1,generation:1,scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId,expectedPartOneGeneration:x.partTwo.generation,expectedPartOneRevision:x.partTwo.evidenceRevision,intent:'unanswered',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse,savedAssessmentId:null};
 const histories:Array<{kind:string;recordId?:string;productId?:string}>=[], prepared:Record<string,unknown>[]=[];
 const ports:PartThreePorts={partFourEnabled:enabled,ownerId:x.context.ownerId,now:()=>x.now,normalize:async()=>x.partTwo,context:async()=>x.context,history:async(_revision,scope)=>{histories.push(scope);return {items:[],nextCursor:null,atRevision:x.context.revision};},worker:async(action,payload)=>{if(action==='encounter/read')return {};if(action==='prepare'){prepared.push(payload);return {resultId:p2id(260),resultRevision:2,leaseToken:p2id(261)};}if(action==='provider/gate')return {allowed:false};if(action==='publish')return {kind:'result',result:payload.result,replayed:false};throw Error(action);}};
 const target=()=>{const choices:PartThreeChoices={intent:request.intent,comparatorId:request.comparatorId,candidateRoutineItemId:request.candidateRoutineItemId,selectedManualReportIds:request.selectedManualReportIds,use:request.use};return partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:request.encounterId,generation:1},choices,null,null,enabled)!;};
 return {x,items,request,ports,histories,prepared,target};
}
test('automatic same-use comparator reaches canonical binding, history and replacement question',async()=>{
 const h=host(), target=h.target();
 assert.equal(target.request.comparatorId,null,'transport retains the original choice');
 assert.equal(target.binding.comparatorId,h.items[0].id);
 const response=await handlePersonalRequest(h.request,h.ports);assert.equal(response.kind,'result');if(response.kind!=='result')return;
 assert.equal(response.result.binding.comparatorId,h.items[0].id);
 assert.equal(response.result.question?.id,'question:replace-or-add');
 assert.equal(response.result.partFour?.comparison.routineItemId,h.items[0].id);
 assert.match(response.result.partFour!.comparison.explanation,/automatically/i);
 assert.deepEqual(h.histories,[{kind:'manual',recordId:h.items[0].id,name:h.items[0].reference.kind==='manual'?h.items[0].reference.name:undefined}]);
 assert.equal((h.prepared[0].request as PartThreeEvaluateRequest).comparatorId,null);
 assert.equal(canonicalJson(response.result.binding),canonicalJson({...target.binding,attemptId:h.request.requestId}));
});
test('ambiguous same-use routine does not select a winner or generate the selected-pair question',async()=>{
 const h=host(true,2);assert.equal(h.target().binding.comparatorId,null);
 const response=await handlePersonalRequest(h.request,h.ports);if(response.kind!=='result')throw Error('Missing result');
 assert.equal(response.result.binding.comparatorId,null);assert.equal(response.result.question,null);
 assert.equal(response.result.partFour?.comparison.state,'ambiguous');assert.deepEqual(h.histories,[]);
});
test('explicit eligible override resolves ambiguity while retaining selected explanation',async()=>{
 const h=host(true,2);h.request.comparatorId=h.items[1].id;
 assert.equal(h.target().binding.comparatorId,h.items[1].id);
 const response=await handlePersonalRequest(h.request,h.ports);if(response.kind!=='result')throw Error('Missing result');
 assert.equal(response.result.binding.comparatorId,h.items[1].id);assert.equal(response.result.question?.id,'question:replace-or-add');
 assert.doesNotMatch(response.result.partFour!.comparison.explanation,/automatically/i);
});
test('Part Four disabled retains null comparator and inherited question behavior',async()=>{
 const h=host(false);assert.equal(h.target().binding.comparatorId,null);
 const response=await handlePersonalRequest(h.request,h.ports);if(response.kind!=='result')throw Error('Missing result');
 assert.equal(response.result.binding.comparatorId,null);assert.equal(response.result.question,null);assert.equal(response.result.partFour,undefined);assert.deepEqual(h.histories,[]);
});
test('paused, incompatible and self-only items are not automatic canonical comparators',async()=>{
 for(const kind of ['paused','different_site','self'] as const){const h=host();if(kind==='paused')h.items[0].state='paused';if(kind==='different_site')h.items[0].applicationSite={answer:{state:'known',value:'hands'},provenance:'self_report'};if(kind==='self')h.request.candidateRoutineItemId=h.items[0].id;
  assert.equal(h.target().binding.comparatorId,null);const response=await handlePersonalRequest(h.request,h.ports);if(response.kind!=='result')throw Error('Missing result');assert.equal(response.result.binding.comparatorId,null);assert.equal(response.result.question,null);
 }
});
test('client cannot assert unchecked automatic origin and invalid explicit overrides are rejected',async()=>{
 const h=host();await assert.rejects(()=>handlePersonalRequest({...h.request,comparatorOrigin:'automatic'},h.ports),/invalid_request/);
 h.items[0].state='paused';h.request.comparatorId=h.items[0].id;await assert.rejects(()=>handlePersonalRequest(h.request,h.ports),/invalid_comparator/);
});
