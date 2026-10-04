import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePartOneRequest} from '../supabase/functions/_shared/part-one-runtime.ts';
const moduleUrl=new URL('../supabase/functions/_shared/part-one-ordinary.ts',import.meta.url);
async function factory(){try{return (await import(moduleUrl.href)).createPartOneOrdinaryServices;}catch(e){if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return undefined;throw e;}}
const owner='00000000-0000-4000-8000-000000000910',jobId='00000000-0000-4000-8000-000000000911',lease='00000000-0000-4000-8000-000000000912';
function fixture(){
 let live=true,budget=true,now='2026-10-04T08:20:00.000Z',fetches=0;const calls:Array<{action:string;payload:Record<string,unknown>}>=[];
 const job={id:jobId,leaseToken:lease,publishRevision:0,targets:[],input:{raw:'3606000537538',symbology:'ean13',namespace:'gtin',retailerId:null,canonicalKey:'gtin:03606000537538',requestedMarket:null},checkpoints:{} as Record<string,unknown>,attempts:1,maxAttempts:4};
 const rpc=async(action:string,payload:Record<string,unknown>)=>{calls.push({action,payload});
  if(action==='public/policy')return {allowed:live,policyVersion:'derive-obf-public-content-v1',expiresAt:'2027-01-04T00:00:00.000Z'};
  if(action==='public/budget')return {allowed:budget};if(action==='heartbeat')return {alive:true};if(action==='claim')return {job};if(action==='catalog')return null;
  if(action==='public/reserve')return budget?{reservationId:lease}:{deferred:true,nextCheckAfter:'2026-10-04T08:21:00.000Z'};if(action==='dispatch')return {mayDispatch:true};if(action==='checkpoint')job.checkpoints[payload.stage as string]=structuredClone(payload.output);return {};
 };
 const transport={pinsResolvedAddresses:true as const,resolve:async()=>['93.184.216.34'],fetch:async(url:string)=>{fetches++;return new Response(JSON.stringify(url.includes('/cgi/search.pl')?{products:[{code:'3606000537538',product_name:'Synthetic public lotion',brands:'Fixture',quantity:'100 ml'}]}:{status:1,product:{code:'3606000537538',product_name:'Synthetic public lotion',brands:'Fixture',ingredients_text:'Water, Glycerin'}}),{headers:{'content-type':'application/json'}});}};
 const options={url:'https://snojlbqovlawewwqbviz.supabase.co',selectedReleaseId:'derive-original-personal-v1',sourceReleaseId:'derive-obf-public-content-v1',ownerId:owner,rpc,transport,now:()=>now};
 return {options,calls,setLive:(v:boolean)=>{live=v;},setBudget:(v:boolean)=>{budget=v;},get fetches(){return fetches;},advance:()=>{now='2027-01-04T00:00:00.000Z';}};
}
// Detects missing ordinary search composition through the actual HTTP handler,
// then checks that candidates never acquire formula or canonical admission.
test('ordinary authenticated search returns bounded source candidates and reserves before HTTP',async()=>{
 const f=fixture(),create=await factory(),services=create?.(f.options);
 const reply=await handlePartOneRequest(new Request('https://derive.invalid/part-one/search',{method:'POST',body:JSON.stringify({query:'Synthetic lotion'})}),{authorize:async()=>{},operation:async()=>{},...(services?{search:services.search}:{})});
 assert.equal(reply.status,200);const data=await reply.json();assert.equal(data.items.length,1);assert.equal(data.items[0].formulaState,'unverified');assert.equal(data.items[0].sourceLookup.barcode,'3606000537538');assert.equal(data.items[0].imageUrl,null);assert.equal(f.fetches,1);
 assert.equal(f.calls[0].action,'public/policy');assert.equal(f.calls[1].action,'public/budget');assert.equal(f.calls[1].payload.operation,'search');assert.equal(f.calls.some(c=>c.action==='admit'),false);
});
// Detects a missing consumer integration, loss of durable CAS, and bypass of
// the shared source budget before the existing ledger authorizes dispatch.
test('ordinary bounded consumer reuses durable admission and preserves incomplete source list',async()=>{
 const f=fixture(),create=await factory(),services=create?.(f.options);
 assert.equal(await services?.consume(),true);assert.equal(f.fetches,1);
 const actions=f.calls.map(c=>c.action);assert.ok(actions.indexOf('public/reserve')<actions.indexOf('dispatch'));assert.deepEqual(f.calls.filter(c=>c.action==='admit').map(c=>c.payload.kind),['observation','declaration','snapshot']);
 const finished=f.calls.find(c=>c.action==='finish')!;assert.equal(finished.payload.expectedPublishRevision,0);assert.equal((finished.payload.resultPatch as {declarationState:string}).declarationState,'partial');assert.equal(f.calls.find(c=>c.action==='public/reserve')!.payload.ownerId,owner);
});
test('ordinary source denial and shared quota exhaustion dispatch no provider bytes',async()=>{
 const create=await factory();assert.equal(typeof create,'function');const denied=fixture();denied.setLive(false);const services=create(denied.options);await assert.rejects(services.search({query:'Synthetic lotion'}));assert.equal(denied.fetches,0);
 const exhausted=fixture();exhausted.setBudget(false);await assert.rejects(create(exhausted.options).search({query:'Synthetic lotion'}));assert.equal(exhausted.fetches,0);
 const expired=fixture();const original=expired.options.rpc;expired.options.rpc=async(action,payload)=>{const result=await original(action,payload);if(action==='public/budget')expired.advance();return result;};await assert.rejects(create(expired.options).search({query:'Synthetic lotion'}));assert.equal(expired.fetches,0);
 for(const delta of [{url:'https://other.supabase.co'},{selectedReleaseId:'part-three-local-v1'},{sourceReleaseId:undefined}])assert.equal(create({...fixture().options,...delta}),null);
});
test('ordinary search uses its configured response bound',async()=>{
 const create=await factory(),f=fixture();f.options.transport.fetch=async()=>new Response(JSON.stringify({products:[{code:'3606000537538',product_name:'x'.repeat(70000)}]}),{headers:{'content-type':'application/json'}});
 await assert.rejects(create(f.options).search({query:'Synthetic lotion'}));
});

test('ordinary search reauthorizes after an in-flight source withdrawal',async()=>{
 const create=await factory(),f=fixture(),original=f.options.transport.fetch;
 f.options.transport.fetch=async url=>{const response=await original(url);f.setLive(false);return response;};
 await assert.rejects(create(f.options).search({query:'Synthetic lotion'}));assert.equal(f.fetches,1);
});
test('ordinary source throttling records shared backoff rather than immediately retrying another route',async()=>{
 const create=await factory(),f=fixture();f.options.transport.fetch=async()=>new Response('{}',{status:429,headers:{'content-type':'application/json','retry-after':'300'}});
 await assert.rejects(create(f.options).search({query:'Synthetic lotion'}));
 const backoff=f.calls.find(c=>c.action==='public/backoff');assert.ok(backoff);assert.equal(backoff.payload.retryAt,'2026-10-04T08:25:00.000Z');
});

test('shared product quota waits before reservation and cannot consume a terminal attempt',async()=>{
 const f=fixture(),create=await factory();f.setBudget(false);await create(f.options).consume();
 assert.equal(f.fetches,0);assert.ok(f.calls.some(c=>c.action==='public/reserve'));
 assert.equal(f.calls.some(c=>['dispatch','checkpoint','admit','retry','finish'].includes(c.action)),false);
});
