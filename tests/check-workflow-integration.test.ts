import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalogSearchController } from '../src/presentation/catalog/searchController.ts';
import { evaluateProviderFixture } from '../supabase/functions/_shared/part-one-providers.ts';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
import type { SourcePolicy } from '../src/contracts/PartOne.ts';
const id='10000000-0000-4000-8000-000000000001';
const now='2026-10-02T00:00:00.000Z';
test('public provider searches issue no query until explicit submit and reject stale results', async()=>{
 let calls=0; let done!: (v:number[])=>void;
 const c=createCatalogSearchController<number>(async()=>{calls++;return new Promise(r=>done=r);},()=>{},{automatic:false});
 c.setQuery('CeraVe'); await new Promise(r=>setTimeout(r,300)); assert.equal(calls,0); assert.equal(c.getState().loading,false);
 const p=c.submit(); assert.equal(calls,1); c.setQuery('different'); done([1]); await p; assert.deepEqual(c.getState().items,[]); c.dispose();
});
test('Open Facts preserves exact-code photo and package quantity only with independent image permission',()=>{
 const policy:SourcePolicy={...ExternalSourcePolicies[0],version:'synthetic-test',permissionEvidence:'synthetic test only',reviewedAt:now,expiresAt:'2026-11-02T00:00:00.000Z',operations:{...ExternalSourcePolicies[0].operations,lookup:true,process:true,retain:true,sharedDisplay:true,hotlink:true},retainedFields:['identity','ingredients','images']};
 const request={canonicalCode:'03337875597197',originalCode:'3337875597197',symbology:'ean13',nativeCode:'3337875597197',requestedMarket:null,categoryHint:null,requestedFields:['identity','ingredients'] as ('identity'|'ingredients')[],jobId:id,stageId:id,reservationId:id,deadlineAt:'2026-10-02T00:01:00.000Z'};
 const image='https://images.openbeautyfacts.org/images/products/333/787/559/7197/front_en.5.400.jpg';
 const body=JSON.stringify({status:1,product:{code:request.nativeCode,product_name:'Synthetic cleanser',brands:'Synthetic',quantity:'236ml',image_front_url:image,ingredients_text:'Water, Glycerin'}});
 const evaluate=(p:SourcePolicy,b=body)=>evaluateProviderFixture('open_facts',request,p,{status:200,contentType:'application/json',body:b,decompressedBytes:Buffer.byteLength(b),elapsedMs:1,retryAfter:null,providerRequestId:null},{now,observationId:id,contentHash:'synthetic',sourceUrl:'https://world.openbeautyfacts.org/api/v2/product/3337875597197.json'});
 const payload=evaluate(policy).observations[0].payload as Record<string,unknown>; assert.equal(payload.imageUrl,image); assert.equal(payload.sourceQuantity,'236ml');
 assert.equal((evaluate({...policy,operations:{...policy.operations,hotlink:false}}).observations[0].payload as Record<string,unknown>).imageUrl,null);
 assert.equal((evaluate(policy,body.replace('/7197/','/7357/')).observations[0].payload as Record<string,unknown>).imageUrl,null);
});

test('search invalidation retires external measurement interest on edit, cancel, selection, reset and disposal', () => {
 let invalidations = 0;
 const c = createCatalogSearchController<number>(async () => [], () => {}, { automatic: false, onInvalidate: () => { invalidations++; } });
 c.setQuery('CeraVe'); c.cancel(); c.select(true); c.reset(); c.dispose();
 assert.equal(invalidations, 5);
});
