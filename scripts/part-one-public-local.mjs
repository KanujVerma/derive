#!/usr/bin/env node
/** Supervised PUBLIC PRODUCT read only. Defaults remain disabled everywhere.
 * Separate loopback gateway + local ledger; never accepts a hosted destination.
 * Existing service key stays server-side; no customer context reaches OBF. */
import { createServer } from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { consumeOnce } from './part-one-worker.mjs';
import { handlePartOneRequest, PartOneHttpError } from '../supabase/functions/_shared/part-one-runtime.ts';
import { classifyServerAuthFailure } from '../supabase/functions/_shared/server-auth.ts';
import { localProductProxyDestination } from '../supabase/functions/_shared/part-one-local-gateway.ts';
import { searchPartOneProducts } from '../supabase/functions/_shared/part-one-search.ts';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
const backend=new URL(process.env.SUPABASE_URL??'');
if(process.env.PART_ONE_OPEN_BEAUTY_PUBLIC_READ!=='1'||backend.origin!=='http://127.0.0.1:59621')throw Error('Explicit task-isolated public-source activation required');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Existing local service environment required');
const reviewedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+86400000).toISOString();
const policy={...ExternalSourcePolicies[0],version:'obf-supervised-public-read-2026-10-02',permissionEvidence:'https://world.openbeautyfacts.org/legal (ODbL/DbCL; photos CC BY-SA 3.0); user authorized bounded local public product verification',reviewedAt,expiresAt,operations:{...ExternalSourcePolicies[0].operations,lookup:true,process:true,retain:true,sharedDisplay:true,hotlink:true},retainedFields:['identity','ingredients','images'],attribution:'Open Beauty Facts contributors · ODbL/DbCL · Photos CC BY-SA 3.0',purgeObligations:['Local verification only; maximum 24-hour rights window; no rehosting/cropping, external export or private capture']};
const config={endpoint:'https://world.openbeautyfacts.org/',allowedHosts:['world.openbeautyfacts.org'],userAgent:'DeriveLocalVerification/1.0 (https://github.com/openfoodfacts; public read-only local verification)',maxBytes:262144,timeoutMs:10000};
const receiptRoot=process.env.PART_ONE_PUBLIC_RECEIPTS??'/tmp/derive-check-public-receipts';
const receipts=`${receiptRoot}/run-${reviewedAt.replaceAll(':','-')}-${randomUUID()}`;
mkdirSync(receipts,{recursive:true});writeFileSync(`${receipts}/source-policy.json`,JSON.stringify(policy,null,2));
let requestNumber=0;
const transport={pinsResolvedAddresses:true,resolve:async(host,signal)=>{signal.throwIfAborted();const addresses=await lookup(host,{all:true});signal.throwIfAborted();return addresses.map(r=>r.address);},fetch:async(url,options)=>new Promise((resolve,reject)=>{
 const parsed=new URL(url),addresses=options.resolvedAddresses;
 const request=https.request(parsed,{method:'GET',headers:{...options.headers,'Accept-Encoding':'identity'},signal:options.signal,lookup:(_host,opts,callback)=>opts.all?callback(null,addresses.map(address=>({address,family:address.includes(':')?6:4}))):callback(null,addresses[0],addresses[0].includes(':')?6:4)},response=>{
  const headers=new Headers();for(const [k,v]of Object.entries(response.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const number=++requestNumber;writeFileSync(`${receipts}/request-${number}.json`,JSON.stringify({url,method:'GET',status:response.statusCode,source:'LIVE Open Beauty Facts',observedAt:new Date().toISOString()},null,2));
  resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers}));
 });request.on('error',reject);request.end();
})};
const rpc=async(action,payload)=>{
 const reply=await fetch(new URL('/rest/v1/rpc/part_one_worker',backend),{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(10000)});
 if(!reply.ok){const diagnostic=await reply.json().catch(()=>({}));throw Error(`Local ledger ${action} failed (${reply.status}): ${diagnostic.code??''} ${diagnostic.message??''}`);}return reply.json();
};
let searchTimes=[];const cache=new Map();
const search=async input=>{
 const cacheKey=JSON.stringify(input),cached=cache.get(cacheKey);if(cached&&Date.parse(cached.items[0]?.sourceLookup.expiresAt??expiresAt)>Date.now())return cached;
 const reply=await searchPartOneProducts(input,policy,config,transport,{now:()=>new Date().toISOString(),id:async code=>{const h=createHash('sha256').update(`openbeautyfacts:${code}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;},reserve:()=>{searchTimes=searchTimes.filter(t=>Date.now()-t<60000);if(searchTimes.length>=8)return false;searchTimes.push(Date.now());return true;}});
 cache.set(cacheKey,reply);if(cache.size>20)cache.delete(cache.keys().next().value);writeFileSync(`${receipts}/search-${createHash('sha256').update(cacheKey).digest('hex').slice(0,12)}.json`,JSON.stringify(reply,null,2));return reply;
};
const server=createServer(async(req,res)=>{
 try {
  const url=localProductProxyDestination(req.url??'/',backend);
  if(req.url==='/functions/v1/part-one/search'){
   const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const reply=await handlePartOneRequest(request,{authorize:async r=>{const token=r.headers.get('authorization')??'';if(!token.startsWith('Bearer '))throw new PartOneHttpError('unauthorized',401);const auth=await fetch(new URL('/auth/v1/user',backend),{headers:{Authorization:token,apikey:r.headers.get('apikey')??''},signal:AbortSignal.timeout(8000)});if(!auth.ok){const failure=classifyServerAuthFailure({status:auth.status});throw new PartOneHttpError(failure.code,failure.status);}},operation:async()=>{throw Error('unsupported');},search});
   res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(await reply.text());return;
  }
  const response=await fetch(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'}),redirect:'manual',signal:AbortSignal.timeout(35000)});
  res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-encoding','content-length'].includes(k))));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'content-type':'application/json','access-control-allow-origin':'*'});res.end('{"code":"local_source_unavailable"}');}
});
server.listen(59631,'127.0.0.1',()=>console.log('Public-product local gateway ready on loopback59631; no hosted source activation'));
let stopping=false;process.on('SIGINT',()=>{stopping=true;server.close();});process.on('SIGTERM',()=>{stopping=true;server.close();});
while(!stopping){try{const consumed=await consumeOnce({rpc,lookupPorts:{policies:[policy],configs:{open_facts:config},transport}});if(!consumed)await new Promise(r=>setTimeout(r,1000));}catch(error){console.error(String(error.message).replace(/Bearer\s+\S+/g,'[redacted]'));await new Promise(r=>setTimeout(r,3000));}}
