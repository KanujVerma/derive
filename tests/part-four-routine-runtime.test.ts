import assert from 'node:assert/strict';
import test from 'node:test';
import {handlePersonalRequest,type PartThreePorts} from '../supabase/functions/part-three/handler.ts';
import type {PartThreeEvaluateRequest} from '../src/contracts/PartThreeService.ts';
import type {RoutineFormulaReadyEvidence} from '../src/contracts/RoutineFormula.ts';
import {planRoutineFormulaRequests} from '../src/domain/part-four/routineFormula.ts';
import {p3input,p3routine,p3revision} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';

test('canonical evaluation samples time after the awaited routine authority check',async()=>{
 const x=p3input();x.context.profile!.id=p2id(401);
 const item=p3routine(p2id(402));item.reference={kind:'catalog',productId:p2id(403),variantId:p2id(404),formulaVersionId:p2id(405)};
 x.context.routine=p3revision(p2id(406),{completeness:'partial',items:[item]});
 const normalized=x.partTwo;
 if(normalized.state!=='ready'||normalized.output.kind!=='bound'||normalized.output.productFacts.binding.kind!=='declaration')throw Error('Bound fixture required');
 const binding=normalized.output.productFacts.binding,sources=normalized.output.productFacts.dependencyManifest.sourceRefs;
 const request=planRoutineFormulaRequests(x.context).requests[0],late=new Date(Date.parse(x.now)+1000).toISOString();
 const evidence:RoutineFormulaReadyEvidence={version:'routine-formula-evidence/v1',request,state:'ready',partTwo:normalized,association:{id:p2id(407),revision:1,reference:request.reference,partOneItemId:binding.itemId,partOneSnapshotId:binding.snapshotId,declarationId:binding.declarationId,declarationRevision:binding.declarationRevision,partTwoSnapshotId:p2id(408),partTwoBindingKey:normalized.bindingKey,partTwoRevision:normalized.resultRevision,dependencyDigest:binding.dependencyDigest,sourceDependencies:sources.map(s=>s.observationId),validUntil:normalized.expiresAt,revoked:false},authorization:{authorityId:p2id(409),authorityRevision:1,checkedAt:late,validUntil:normalized.expiresAt,evaluate:true,display:true,store:true,revoked:false,withdrawnDependencies:[],sourcePermissions:sources.map(s=>({observationId:s.observationId,sourceRevision:s.sourceRevision,policyId:s.policyId,policyVersion:s.policyVersion,grantId:p2id(410),grantVersion:'1',evaluate:true,display:true,store:true,revoked:false,validUntil:s.expiresAt}))}};
 let clock=x.now,lookupCalls=0;
 const ports:PartThreePorts={partFourEnabled:true,ownerId:x.context.ownerId,now:()=>clock,normalize:async()=>normalized,context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{
  if(action==='encounter/read')return {};
  if(action==='prepare')return {resultId:p2id(411),resultRevision:2,leaseToken:p2id(412)};
  if(action==='routine/formulas'){lookupCalls++;assert.deepEqual(payload.requests,[request]);await Promise.resolve();clock=late;return [evidence];}
  if(action==='provider/gate')return {allowed:false};
  if(action==='publish')return {kind:'result',result:payload.result,replayed:false};
  throw Error(action);
 }};
 const input:PartThreeEvaluateRequest={operation:'evaluate',requestId:p2id(413),encounterId:p2id(414),accountGeneration:1,generation:1,scanId:normalized.scanId,captureSessionId:normalized.captureSessionId,expectedPartOneGeneration:normalized.generation,expectedPartOneRevision:normalized.evidenceRevision,intent:'add',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse,savedAssessmentId:null};
 const result=await handlePersonalRequest(input,ports);assert.equal(lookupCalls,1);assert.equal(result.kind,'result');if(result.kind!=='result')throw Error('Result required');
 assert.equal(result.result.evaluatedAt,late);
 assert(result.result.partFour!.insights.some(i=>i.ruleId==='F07'&&i.state==='supported'),'Fresh authority must contribute exact co-presence after its awaited check');
});
