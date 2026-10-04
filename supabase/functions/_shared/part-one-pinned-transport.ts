import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {createConnection} from 'node:net';
import {Readable} from 'node:stream';
import {isPermittedProviderDestination,type ProviderTransport} from './part-one-providers.ts';
/** TLS connects to a validated literal IP, with the original hostname retained
 * for certificate validation/SNI and Host. No second DNS lookup or shared agent.
 * Actual hosted Node-compatibility still needs exact-runtime acceptance. */
export function createOpenBeautyFactsTransport():ProviderTransport{
 const hosts=['world.openbeautyfacts.org'];
 return {pinsResolvedAddresses:true,
  async resolve(hostname,signal){signal.throwIfAborted();if(!hosts.includes(hostname))throw Error('unapproved_source_host');const addresses=await lookup(hostname,{all:true});signal.throwIfAborted();return addresses.map(a=>a.address);},
  async fetch(url,options){
   options.signal.throwIfAborted();if(!isPermittedProviderDestination(url,hosts,options.resolvedAddresses)||options.method!=='GET'||options.redirect!=='manual')throw Error('unapproved_source_destination');
   const parsed=new URL(url),address=options.resolvedAddresses[0];
   // Deno's HTTP compatibility layer derives TLS identity from request hostname,
   // ignoring servername. Keep that hostname and pin its plain TCP socket instead.
   const edge=Boolean((globalThis as {Deno?:unknown}).Deno);
   const connection=edge?{hostname:parsed.hostname,createConnection:()=>createConnection({host:address,port:443})}:{hostname:address};
   return new Promise<Response>((resolve,reject)=>{
    const req=request({protocol:'https:',...connection,port:443,servername:parsed.hostname,rejectUnauthorized:true,agent:false,method:'GET',path:parsed.pathname+parsed.search,signal:options.signal,
     headers:{Accept:'application/json','User-Agent':options.headers['User-Agent'],Host:parsed.hostname,'Accept-Encoding':'identity'}},res=>{
      const headers=new Headers();for(const [name,value] of Object.entries(res.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
      if([204,205,304].includes(res.statusCode??0)){res.destroy();resolve(new Response(null,{status:res.statusCode,headers}));return;}
      resolve(new Response(Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>,{status:res.statusCode,headers}));
     });req.once('error',reject);req.end();
   });
  },
 };
}
