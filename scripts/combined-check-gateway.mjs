/** Original synthetic name results through the real search adapter, then actual
 * loopback Auth/Edge/SQL. No DNS lookup, remote fetch, source activation or worker. */
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {handlePartOneRequest,PartOneHttpError} from '../supabase/functions/_shared/part-one-runtime.ts';
import {authorizeServerUser} from '../supabase/functions/_shared/server-auth.ts';
import {localProductProxyDestination} from '../supabase/functions/_shared/part-one-local-gateway.ts';
import {searchPartOneProducts} from '../supabase/functions/_shared/part-one-search.ts';
import {createClient} from '@supabase/supabase-js';
export async function startCombinedCheckGateway({backend,anon,barcode,name,policy}){
 if(backend.origin!=='http://127.0.0.1:59721')throw Error('Integration stack required');
 const counts={search:0,scan:0,normalize:0,saveProduct:0,evaluate:0};
 const syntheticPolicy={...policy,provider:'open_facts',retainedFields:['identity']};
 const config={endpoint:'https://world.openbeautyfacts.org/',allowedHosts:['world.openbeautyfacts.org'],userAgent:'DeriveOriginalSyntheticIntegration/1',maxBytes:262144,timeoutMs:10000};
 const transport={pinsResolvedAddresses:true,resolve:async()=>['93.184.216.34'],fetch:async()=>new Response(JSON.stringify({products:[{code:barcode,brands:'Synthetic',product_name:name,quantity:'100 ml',countries_tags:['en:united-states']}]}),{headers:{'content-type':'application/json'}})};
 const server=createServer(async(req,res)=>{try{
  const target=localProductProxyDestination(req.url??'/',backend);
  if(req.url==='/functions/v1/part-one/search'){
   counts.search++;
   const request=new Request(target,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handlePartOneRequest(request,{authorize:async r=>{
    const authorization=r.headers.get('authorization')??'';
    if(!authorization.startsWith('Bearer '))throw new PartOneHttpError('unauthorized',401);
    const client=createClient(backend.origin,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    await authorizeServerUser(client.auth,(code,status)=>new PartOneHttpError(code,status));
   },operation:async()=>{throw Error('No synthetic gateway operation');},search:input=>searchPartOneProducts(input,syntheticPolicy,config,transport,{now:()=>new Date().toISOString(),id:async()=>randomUUID(),reserve:()=>true})});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(req.url==='/functions/v1/part-one/scans'&&req.method==='POST')counts.scan++;
  if(req.url==='/functions/v1/part-two/normalize')counts.normalize++;
  if(req.url==='/functions/v1/part-one/saves'&&req.method==='POST')counts.saveProduct++;
  const response=await fetch(target,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'}),redirect:'manual',signal:AbortSignal.timeout(35000)});
  res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-encoding','content-length'].includes(k))));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'content-type':'application/json','access-control-allow-origin':'*'});res.end('{"code":"synthetic_gateway_unavailable"}');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(59731,'127.0.0.1',resolve);});
 return {counts,close:()=>new Promise(resolve=>server.close(resolve))};
}
