import assert from 'node:assert/strict';
import test from 'node:test';
import { FunctionsClient } from '@supabase/functions-js';
import { CapturePrivateCommitRequestSchema, CaptureRecoverySchema, privateUploadHeaders, parsePrivateUploadHeaders } from '../src/contracts/PartOnePrivate.ts';
import { createPartOnePrivateTransport, PartOnePrivateConflict } from '../src/services/partOnePrivateClient.ts';
import { handlePartOneRequest, type PartOneHttpPorts } from '../supabase/functions/_shared/part-one-runtime.ts';
import type { ScanResult } from '../src/contracts/PartOne.ts';
const id=(n:number)=>`be000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const capture={schemaVersion:1 as const,captureSessionId:id(1),packageObservationId:id(2),scanId:id(3),generation:0,captureRevision:0,deletionEpoch:0,itemId:id(4),candidateId:null};
const result:ScanResult={schemaVersion:1,requestId:id(5),scanId:id(3),generation:0,resultRevision:1,identity:'exact',itemId:id(4),candidateIds:[],snapshotId:id(6),declarationId:null,declarationState:'none',scope:null,
 packageConfirmation:'unconfirmed',work:'complete',jobId:null,subscriptionId:null,nextCheckAfter:null,display:{resultRevision:1,selectedIdentity:{id:id(4),name:'Synthetic label',brand:null,variantText:'100 ml',expiresAt:'2027-01-01T00:00:00.000Z',image:null},candidates:[],sections:[],sources:[],limitations:[]},reasonCodes:[],conflictIds:[],evidenceIds:[],allowedActions:['save_partial','add_photo'],freshness:{observedAt:'2026-10-01T00:00:00.000Z',expiresAt:'2027-01-01T00:00:00.000Z',state:'fresh'}};
const binding={idempotencyKey:'private-fixture-upload',evidenceId:id(7),packageObservationId:id(2),expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0};
const asset={evidenceId:id(7),storageObjectId:id(8),contentHash:'synthetic-jpeg-sha256',width:10,height:10,metadataStripped:true as const};
const receipt={schemaVersion:1,capture,result,asset,attestationId:id(9),expiresAt:'2027-01-01T00:00:00.000Z'};
const committed={schemaVersion:1,capture,observationIds:[],declarationIds:[],assetIds:[],result};
const request={schemaVersion:2 as const,idempotencyKey:'private-fixture-commit',expectedGeneration:0,expectedResultRevision:1,expectedCaptureRevision:0,expectedDeletionEpoch:0,packageObservationId:id(2),assets:[],sourceObservations:[],edits:[],review:null,reviewId:null};
const prepared={bytes:new Uint8Array([255,216,1,2,255,217]),mimeType:'image/jpeg' as const,width:10,height:10,sourceWidth:10,sourceHeight:10,orientationTransform:[1,0,0,0,1,0,0,0,1],cropRegion:[0,0,1,1],recipeVersion:'derive-private-jpeg-v1' as const};
function http(path:string,method='POST',body?:unknown,headers:Record<string,string>={}){return new Request(`http://localhost/functions/v1/part-one${path}`,{method,headers:{authorization:'Bearer synthetic-owner','content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
function ports():PartOneHttpPorts{return{async authorize(){},async operation(){return committed;}};}
test('private binary binding requires all explicit nonnegative revisions and never client sanitation claims',()=>{
 assert.deepEqual(parsePrivateUploadHeaders(new Headers(privateUploadHeaders(binding))),binding);
 const missing=new Headers(privateUploadHeaders(binding));missing.delete('x-part-one-deletion-epoch');assert.throws(()=>parsePrivateUploadHeaders(missing));
 const bad=new Headers(privateUploadHeaders(binding));bad.set('x-part-one-generation','-1');assert.throws(()=>parsePrivateUploadHeaders(bad));
 assert.equal(CapturePrivateCommitRequestSchema.safeParse({...request,metadataStripped:true}).success,false);
 assert.equal(CapturePrivateCommitRequestSchema.safeParse({...request,ownerId:id(20)}).success,false);
});
test('private v2 rejects case-equivalent duplicate assets and immutable observation IDs',()=>{
 assert.equal(CapturePrivateCommitRequestSchema.safeParse({...request,assets:[asset,{...asset,evidenceId:asset.evidenceId.toUpperCase(),storageObjectId:asset.storageObjectId.toUpperCase()}]}).success,false);
});
test('private upload uses actual installed SDK binary ArrayBuffer rather than JSON-encoded Uint8Array',async()=>{
 let wire:Uint8Array|undefined;
 const sdk=new FunctionsClient('http://127.0.0.1/synthetic/functions/v1',{customFetch:async(_input,init)=>{
  assert.equal(new Headers(init?.headers).get('content-type'),'image/jpeg');assert(init?.body instanceof ArrayBuffer);
  wire=new Uint8Array(init.body);return new Response(JSON.stringify(receipt),{headers:{'content-type':'application/json'}});
 }});
 const client=createPartOnePrivateTransport({enabled:()=>true,invoke:(path,options)=>sdk.invoke(path,options)});
 const actual=await client.upload(id(1),binding,prepared);assert.equal(actual.asset.contentHash,asset.contentHash);assert.deepEqual(wire,prepared.bytes);
});
test('private client disabled/cancelled boundaries prevent calls and late receipt adoption',async()=>{
 let calls=0;const p=createPartOnePrivateTransport({enabled:()=>false,invoke:async()=>{calls++;return{data:receipt,error:null};}});
 await assert.rejects(p.upload(id(1),binding,prepared),/disabled/);assert.equal(calls,0);
 const controller=new AbortController();const live=createPartOnePrivateTransport({enabled:()=>true,invoke:async()=>{calls++;controller.abort();return{data:receipt,error:null};}});
 await assert.rejects(live.upload(id(1),binding,prepared,controller.signal),/cancelled/);
});
test('private HTTP boundary authorizes before upload callback and validates returned asset binding',async()=>{
 let uploads=0;const p=ports();p.authorize=async()=>{throw Object.assign(new Error(),{name:'ZodError'});};p.privateUpload=async()=>{uploads++;return receipt;};
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/assets`,'POST',undefined,privateUploadHeaders(binding)),p)).status,400);assert.equal(uploads,0);
 p.authorize=async()=>{};p.privateUpload=async()=>{uploads++;return{...receipt,asset:{...asset,evidenceId:id(10)}};};
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/assets`,'POST',undefined,privateUploadHeaders(binding)),p)).status,500);assert.equal(uploads,1);
});
test('private v2 and recovery have typed disabled results when the real handlers are absent',async()=>{
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/observations`,'POST',request),ports())).status,423);
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/evidence`,'GET'),ports())).status,423);
});
test('private v2 cannot bypass closed payload schema or return the wrong package receipt',async()=>{
 let commits=0;const p=ports();p.privateCommit=async()=>{commits++;return committed;};
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/observations`,'POST',{...request,accepted:true}),p)).status,400);assert.equal(commits,0);
 p.privateCommit=async()=>({...committed,capture:{...capture,packageObservationId:id(12)}});
 assert.equal((await handlePartOneRequest(http(`/captures/${id(1)}/observations`,'POST',request),p)).status,500);
});
test('private recovery rejects signed access beyond evidence expiry and changed editable binding',()=>{
 const recovered={schemaVersion:1,capture,editable:true,result,boundResult:result,assets:[{recordId:null,asset,attestationId:id(9),expiresAt:'2027-01-01T00:00:00.000Z',signedAccess:{url:'http://127.0.0.1/synthetic/signed',expiresAt:'2027-01-01T00:00:01.000Z'}}],sourceObservations:[],edits:[],declarationIds:[],review:null,reviewReceiptId:null};
 assert.equal(CaptureRecoverySchema.safeParse(recovered).success,false);
 assert.equal(CaptureRecoverySchema.safeParse({...recovered,assets:[],result:{...result,itemId:id(30)}}).success,false);
 assert.equal(CaptureRecoverySchema.safeParse({...recovered,assets:[],editable:false,result:{...result,itemId:id(30)}}).success,true);
});
test('private client conflict preserves current revision while error messages omit server payloads',async()=>{
 const current={code:'stale_result',result:{...result,resultRevision:2,display:{...result.display,resultRevision:2}}};
 const p=createPartOnePrivateTransport({enabled:()=>true,invoke:async()=>({data:null,error:{context:new Response(JSON.stringify(current),{status:409})}})});
 await assert.rejects(p.commit(id(1),request),error=>error instanceof PartOnePrivateConflict && (error.current as typeof current).result.resultRevision===2 && !error.message.includes('Synthetic'));
});
