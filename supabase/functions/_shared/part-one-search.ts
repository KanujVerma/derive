import { z } from 'zod';
import { PartOneSearchRequestSchema, PartOneSearchReplySchema, type PartOneSearchItem } from '../../../src/contracts/PartOneSearch.ts';
import type { SourcePolicy } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { isPermittedProviderDestination, permittedOpenFactsImage, providerOperationPermitted, type ProviderTransport, type ProviderConfiguration } from './part-one-providers.ts';
const envelope=z.object({products:z.array(z.object({code:z.string(),product_name:z.string().nullish(),brands:z.string().nullish(),quantity:z.string().nullish(),countries_tags:z.array(z.string()).optional(),image_front_url:z.string().nullish()})).max(10)});
/** Read-only candidates. Selecting a returned barcode always re-resolves identity;
 * these name matches never admit declarations or establish exact package truth. */
export async function searchPartOneProducts(input:unknown,policy:SourcePolicy,config:ProviderConfiguration,transport:ProviderTransport,ports:{now():string;id(code:string):Promise<string>;reserve():boolean|Promise<boolean>}):Promise<{items:PartOneSearchItem[]}> {
 const {query}=PartOneSearchRequestSchema.parse(input),now=ports.now();
 if(!providerOperationPermitted('open_facts',policy,['identity'],now))throw Error('source_policy_blocked');
 const origin=new URL(config.endpoint);if(origin.origin!=='https://world.openbeautyfacts.org')throw Error('source_origin_unapproved');
 const url=new URL('/cgi/search.pl',origin);for(const [key,value]of Object.entries({search_terms:query,tagtype_0:'countries',tag_contains_0:'contains',tag_0:'en:united-states',search_simple:'1',action:'process',json:'1',page_size:'10',fields:'code,product_name,brands,quantity,countries_tags,image_front_url'}))url.searchParams.set(key,value);
 const controller=new AbortController();
 let timer: ReturnType<typeof setTimeout>;
 let stage='resolve',responseStatus:number|null=null,jsonContentType:boolean|null=null;
 const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('source_timeout'));},10000);});
 try{return await Promise.race([deadline,(async()=>{
  const addresses=await transport.resolve(url.hostname,controller.signal);
  controller.signal.throwIfAborted();
  if(!providerOperationPermitted('open_facts',policy,['identity'],ports.now()))throw Error('source_policy_blocked');
  stage='budget';
  if(!transport.pinsResolvedAddresses||!isPermittedProviderDestination(url.toString(),config.allowedHosts,addresses)||!await ports.reserve())throw Error('source_unavailable');
  if(!providerOperationPermitted('open_facts',policy,['identity'],ports.now()))throw Error('source_policy_blocked');
  controller.signal.throwIfAborted();
  stage='fetch';
  const reply=await transport.fetch(url.toString(),{method:'GET',headers:{Accept:'application/json','User-Agent':config.userAgent},redirect:'manual',signal:controller.signal,resolvedAddresses:addresses});
  stage='response';responseStatus=reply.status;jsonContentType=/^application\/json/i.test(reply.headers.get('content-type')??'');
  if(!reply.ok||!jsonContentType){await reply.body?.cancel();throw Error('source_unavailable');}
  stage='body';
  const reader=reply.body?.getReader();if(!reader)throw Error('source_unavailable');let bytes=0;const chunks:Uint8Array[]=[];
  while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>Math.min(262144,Math.max(1,config.maxBytes??262144))){await reader.cancel();throw Error('source_response_limit');}chunks.push(chunk.value);}
  const data=new Uint8Array(bytes);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  stage='schema';
  const parsed=envelope.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))),items:PartOneSearchItem[]=[];
  for(const product of parsed.products){const code=normalizeBarcode({raw:product.code,symbology:product.code.length===8?'ean8':null,namespace:'gtin',retailerId:null});if(!code.supported||!product.product_name?.trim()||!product.countries_tags?.includes('en:united-states'))continue;
   const reportedMarkets=(product.countries_tags??[]).map(tag=>tag.replace(/^[a-z]{2}:/i,'').replaceAll('-',' ').replace(/\b[a-z]/g,letter=>letter.toUpperCase()));
   const variantText=[product.quantity,...reportedMarkets].filter(Boolean).join(' · ');
   items.push({productId:await ports.id(product.code),brand:product.brands??'',name:product.product_name,category:variantText||'Package details unavailable',imageUrl:permittedOpenFactsImage(product.image_front_url??null,product.code,policy,now),isCatalogStandard:true,variantCount:1,formulaState:'unverified',sourceLookup:{barcode:product.code,provider:'open_facts',variantText,sourceUrl:`https://world.openbeautyfacts.org/product/${product.code}`,observedAt:now,expiresAt:new Date(Math.min(Date.parse(now)+86400000,Date.parse(policy.expiresAt!))).toISOString(),policyVersion:policy.version}});
  }
  if(!providerOperationPermitted('open_facts',policy,['identity'],ports.now()))throw Error('source_policy_blocked');
  controller.signal.throwIfAborted();
  return PartOneSearchReplySchema.parse({items});
 })()]);}catch(error){
  const failure=error as {message?:string;code?:string};
  const reasons=['source_timeout','source_unavailable','source_response_limit','source_policy_blocked'];
  const codes=['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENOTFOUND','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_NOT_IMPLEMENTED'];
  // Fixed categories only: no query, response body, URL, owner, token or raw error.
  console.warn(JSON.stringify({event:'part_one_public_search_failure',stage,reason:reasons.includes(failure?.message??'')?failure.message:stage==='schema'?'invalid_response':'network',networkCode:codes.includes(failure?.code??'')?failure.code:null,networkHint:/NotValidForName|CERT_ALTNAME|Hostname\/IP|not valid for.*name/i.test(failure?.message??'')?'tls_hostname':/certificate|UnknownIssuer|TLS|SSL/i.test(failure?.message??'')?'tls_other':/not implemented|not supported|unsupported/i.test(failure?.message??'')?'runtime_unsupported':/timed? ?out|abort/i.test(failure?.message??'')?'timeout':/ECONN|connection|socket|eof/i.test(failure?.message??'')?'connection':'unclassified',responseStatus,jsonContentType}));
  throw error;
 }finally{clearTimeout(timer!);controller.abort();}
}
