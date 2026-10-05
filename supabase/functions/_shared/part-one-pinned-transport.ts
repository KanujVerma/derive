import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {Readable} from 'node:stream';
import {nativePinnedHttpGet,type NativeTransportRuntime} from './part-one-native-http.ts';
import {isPermittedProviderDestination,type ProviderTransport} from './part-one-providers.ts';
/** TLS connects to a validated literal IP, with the original hostname retained
 * for certificate validation/SNI and Host. No second DNS lookup or shared agent.
 * Native Deno avoids unsupported Node HTTP socket callbacks. */
export function createOpenBeautyFactsTransport():ProviderTransport{
 const hosts=['world.openbeautyfacts.org'];
 return {pinsResolvedAddresses:true,
  async resolve(hostname,signal){signal.throwIfAborted();if(!hosts.includes(hostname))throw Error('unapproved_source_host');const addresses=await lookup(hostname,{all:true});signal.throwIfAborted();return addresses.map(a=>a.address);},
  async fetch(url,options){
   options.signal.throwIfAborted();if(!isPermittedProviderDestination(url,hosts,options.resolvedAddresses)||options.method!=='GET'||options.redirect!=='manual')throw Error('unapproved_source_destination');
   const parsed=new URL(url),address=options.resolvedAddresses[0];
   const deno=(globalThis as unknown as {Deno?:NativeTransportRuntime}).Deno;
   if(deno)return nativePinnedHttpGet(deno,parsed,address,options.headers['User-Agent'],options.signal);
   return new Promise<Response>((resolve,reject)=>{
    const req=request({protocol:'https:',hostname:address,agent:false,port:443,servername:parsed.hostname,rejectUnauthorized:true,method:'GET',path:parsed.pathname+parsed.search,signal:options.signal,
     headers:{Accept:'application/json','User-Agent':options.headers['User-Agent'],Host:parsed.hostname,'Accept-Encoding':'identity'}},res=>{
      const headers=new Headers();for(const [name,value] of Object.entries(res.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
      if([204,205,304].includes(res.statusCode??0)){res.destroy();resolve(new Response(null,{status:res.statusCode,headers}));return;}
      resolve(new Response(Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>,{status:res.statusCode,headers}));
     });req.once('error',reject);
    req.end();
   });
  },
 };
}
