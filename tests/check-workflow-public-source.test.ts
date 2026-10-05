import assert from 'node:assert/strict';
import test from 'node:test';
import { searchPartOneProducts } from '../supabase/functions/_shared/part-one-search.ts';
import { localProductProxyDestination } from '../supabase/functions/_shared/part-one-local-gateway.ts';
import { handlePartOneRequest } from '../supabase/functions/_shared/part-one-runtime.ts';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
import type { SourcePolicy } from '../src/contracts/PartOne.ts';
import type { ProviderTransport } from '../supabase/functions/_shared/part-one-providers.ts';
const now='2026-10-03T00:00:00.000Z';
const policy:SourcePolicy={...ExternalSourcePolicies[0],version:'synthetic-test',permissionEvidence:'Synthetic contract tests only',reviewedAt:now,expiresAt:'2026-10-04T00:00:00.000Z',operations:{...ExternalSourcePolicies[0].operations,lookup:true,process:true,retain:true,sharedDisplay:true,hotlink:true},retainedFields:['identity','images']};
const config={endpoint:'https://world.openbeautyfacts.org/',allowedHosts:['world.openbeautyfacts.org'],userAgent:'SyntheticTests/1',timeoutMs:10000,maxBytes:262144};
function fixture(){
 const calls:string[]=[];let status=200,body=JSON.stringify({products:[{code:'3337875597197',product_name:'Synthetic variant',brands:'Synthetic',quantity:'236 ml',countries_tags:['en:netherlands','en:united-states'],image_front_url:'https://images.openbeautyfacts.org/images/products/333/787/559/7197/front_en.5.400.jpg'},{code:'3337875597357',product_name:'Synthetic variant',quantity:'474 ml',countries_tags:['en:united-states']},{code:'invalid',product_name:'Rejected'}]});
 const transport:ProviderTransport={pinsResolvedAddresses:true,resolve:async()=>['1.1.1.1'],fetch:async url=>{calls.push(url);return new Response(body,{status,headers:{'content-type':'application/json'}});}};
 const ports={now:()=>now,id:async(code:string)=>`10000000-0000-4000-8000-${code.slice(-12)}`,reserve:()=>true};
 return {calls,transport,ports,status:(v:number)=>status=v,body:(v:string)=>body=v};
}
test('local proxy rejects alternate origins and ambiguous request targets before dispatch',()=>{
 const backend=new URL('http://127.0.0.1:59621');
 for(const path of ['https://example.org/auth/v1/user','//example.org/auth/v1/user','//127.0.0.1:59622/rest/v1/test','/\\evil/auth/v1/user','http://user:secret@127.0.0.1:59621/auth/v1/user','/unapproved/path'])assert.throws(()=>localProductProxyDestination(path,backend));
 for(const path of ['/auth/v1/user','/rest/v1/rpc/part_one_worker','/functions/v1/part-one/search','/storage/v1/object/x'])assert.equal(localProductProxyDestination(path,backend).origin,backend.origin);
});
test('bounded name search preserves variant evidence and missing photo without admitting ingredient declarations',async()=>{
 const f=fixture();const out=await searchPartOneProducts({query:'Synthetic variant'},policy,config,f.transport,f.ports);
 assert.equal(out.items.length,2);assert.equal(out.items[0].sourceLookup.variantText,'236 ml · Netherlands · United States');assert.equal(out.items[1].imageUrl,null);
 assert.equal(out.items[0].formulaState,'unverified');assert(!JSON.stringify(out).includes('declarationId'));
 const url=new URL(f.calls[0]);assert.equal(url.searchParams.get('search_terms'),'Synthetic variant');assert.equal(url.searchParams.get('page_size'),'10');
});
test('name source policy, dispatch budget and DNS boundary fail closed without network calls',async()=>{
 for(const mode of ['policy','budget','dns']){const f=fixture();if(mode==='budget')f.ports.reserve=()=>false;if(mode==='dns')f.transport.resolve=async()=>['127.0.0.1'];
 await assert.rejects(searchPartOneProducts({query:'Synthetic'},mode==='policy'?ExternalSourcePolicies[0]:policy,config,f.transport,f.ports));assert.equal(f.calls.length,0);}
});
test('empty source search differs from malformed, unavailable and oversized responses',async()=>{
 const f=fixture();f.body('{"products":[]}');assert.deepEqual(await searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports),{items:[]});
 f.status(503);await assert.rejects(searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports),/source_unavailable/);
 f.status(200);f.body('not json');await assert.rejects(searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports));
 f.body(' '.repeat(262145));await assert.rejects(searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports),/source_response_limit/);
});
test('normal authenticated search route and disabled production default remain explicit',async()=>{
 let auth=0;const ports={authorize:async()=>{auth++;},operation:async()=>({}),search:async()=>({items:[]})};
 const request=()=>new Request('http://local/functions/v1/part-one/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"query":"Synthetic"}'});
 assert.equal((await handlePartOneRequest(request(),ports)).status,200);assert.equal(auth,1);
 assert.equal((await handlePartOneRequest(request(),{authorize:ports.authorize,operation:ports.operation})).status,503);
});

test('stalled DNS settles at the deadline and late DNS cannot dispatch a request', async t => {
 t.mock.timers.enable({ apis: ['setTimeout'] });
 const f=fixture(); let resolve!: (addresses:string[])=>void; let signal!: AbortSignal;
 f.transport.resolve=async(_host,s)=>{signal=s;return new Promise(r=>{resolve=r;});};
 const pending=searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports);
 const rejected=assert.rejects(pending,/source_timeout/);
 t.mock.timers.tick(10000); await rejected; assert.equal(signal.aborted,true);
 resolve(['1.1.1.1']); for(let i=0;i<4;i++)await Promise.resolve(); assert.equal(f.calls.length,0);
});
test('policy expiry during DNS denies dispatch before spending budget or fetching', async()=>{
 const f=fixture(); let clock=now, reserves=0;
 f.ports.now=()=>clock;f.ports.reserve=()=>{reserves++;return true;};
 f.transport.resolve=async()=>{clock=policy.expiresAt!;return ['1.1.1.1'];};
 await assert.rejects(searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports),/source_policy_blocked/);
 assert.equal(reserves,0); assert.equal(f.calls.length,0);
});

test('stalled response body settles at the search deadline and aborts its transport', async t => {
 t.mock.timers.enable({ apis: ['setTimeout'] });
 const f=fixture(); let signal!: AbortSignal;
 const body=new ReadableStream<Uint8Array>({ start() {} });
 f.transport.fetch=async(_url,options)=>{signal=options.signal;return new Response(body,{headers:{'content-type':'application/json'}});};
 const pending=searchPartOneProducts({query:'Synthetic'},policy,config,f.transport,f.ports);
 const rejected=assert.rejects(pending,/source_timeout/);
 for(let i=0;i<4;i++)await Promise.resolve();
 assert(signal, 'the read reached the stalled body before the deadline');
 t.mock.timers.tick(10000); await rejected; assert.equal(signal.aborted,true);
});

test('search diagnostics identify the failed boundary without retaining query or network messages',async t=>{
 const log=t.mock.method(console,'warn',()=>{});
 const f=fixture();f.transport.fetch=async()=>{throw Object.assign(Error('secret-query-and-token'),{code:'ECONNRESET'});};
 await assert.rejects(searchPartOneProducts({query:'private query'},policy,config,f.transport,f.ports));
 assert.equal(log.mock.calls.length,1);assert.deepEqual(JSON.parse(log.mock.calls[0].arguments[0]),{event:'part_one_public_search_failure',stage:'fetch',reason:'network',networkCode:'ECONNRESET',networkHint:'unclassified',responseStatus:null,jsonContentType:null});
 assert(!JSON.stringify(log.mock.calls).includes('secret-query-and-token'));assert(!JSON.stringify(log.mock.calls).includes('private query'));
 log.mock.resetCalls();f.transport.fetch=async()=>{throw Error('invalid peer certificate: NotValidForName secret token');};
 await assert.rejects(searchPartOneProducts({query:'private query'},policy,config,f.transport,f.ports));assert.equal(JSON.parse(log.mock.calls[0].arguments[0]).networkHint,'tls_hostname');assert(!JSON.stringify(log.mock.calls).includes('secret token'));
 log.mock.resetCalls();f.transport.fetch=async()=>new Response('not JSON',{status:200,headers:{'content-type':'text/html'}});
 await assert.rejects(searchPartOneProducts({query:'private query'},policy,config,f.transport,f.ports));
 const event=JSON.parse(log.mock.calls[0].arguments[0]);assert.equal(event.stage,'response');assert.equal(event.responseStatus,200);assert.equal(event.jsonContentType,false);
});
