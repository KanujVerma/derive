import {ordinaryPartThreeRelease} from '../../../src/domain/part-three/release.ts';
import {ExternalSourcePolicies} from '../../../src/domain/part-one/policies.ts';
import {SourcePolicySchema,type SourcePolicy} from '../../../src/contracts/PartOne.ts';
import {z} from 'zod';
import {searchPartOneProducts} from './part-one-search.ts';
import {consumeOnce,type PartOneWorkerRpc} from './part-one-consumer.ts';
import {PartOneHttpError} from './part-one-runtime.ts';
import {parseRetryAfter,type ProviderTransport} from './part-one-providers.ts';
import {sha256} from '../../../src/domain/part-two/hash.ts';
export const OBF_PUBLIC_SOURCE_RELEASE=Object.freeze({id:'derive-obf-public-content-v1',reviewedAt:'2026-10-04T08:15:00.000Z',expiresAt:'2027-01-04T00:00:00.000Z',
 permissionEvidence:'https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/ ; ODbL database / DbCL contents; reviewed public identity and ingredient fields only',
 attribution:'Open Beauty Facts contributors · ODbL database / DbCL contents',
 userAgent:'Derive/1.0 (+https://github.com/KanujVerma/derive)'});
const authority=z.strictObject({allowed:z.boolean(),policyVersion:z.string(),expiresAt:z.iso.datetime({offset:true}).nullable()});
const reservation=z.strictObject({allowed:z.boolean()});
interface Options {url:string;selectedReleaseId?:string;sourceReleaseId?:string;ownerId:string;rpc:PartOneWorkerRpc;transport:ProviderTransport;now?:()=>string}
/** Compiled source expectations do not register or permit anything. The existing
 * source ledger must independently authorize its exact version at every entry. */
export function createPartOneOrdinaryServices(options:Options){
 if(!ordinaryPartThreeRelease(options.url,options.selectedReleaseId)||options.sourceReleaseId!==OBF_PUBLIC_SOURCE_RELEASE.id)return null;
 const now=options.now??(()=>new Date().toISOString());
 const currentPolicy=async():Promise<SourcePolicy>=>{
  const live=authority.parse(await options.rpc('public/policy',{policyVersion:OBF_PUBLIC_SOURCE_RELEASE.id}));
  if(!live.allowed||live.policyVersion!==OBF_PUBLIC_SOURCE_RELEASE.id||!live.expiresAt||Date.parse(live.expiresAt)<=Date.parse(now())||Date.parse(live.expiresAt)>Date.parse(OBF_PUBLIC_SOURCE_RELEASE.expiresAt))throw new PartOneHttpError('source_policy_blocked',503);
  return SourcePolicySchema.parse({...ExternalSourcePolicies[0],version:OBF_PUBLIC_SOURCE_RELEASE.id,permissionEvidence:OBF_PUBLIC_SOURCE_RELEASE.permissionEvidence,reviewedAt:OBF_PUBLIC_SOURCE_RELEASE.reviewedAt,expiresAt:live.expiresAt,
   operations:{...ExternalSourcePolicies[0].operations,lookup:true,process:true,retain:true,sharedDisplay:true},retainedFields:['identity','ingredients'],attribution:OBF_PUBLIC_SOURCE_RELEASE.attribution,
   purgeObligations:['Maximum 24-hour observation/current rights lifetime; live expiry and withdrawal apply to saved projections','No images, OCR, private capture, rehosting or unrelated source transfer','ODbL derivative database access obligations remain an independent operational activation gate']});
 };
 const config={endpoint:'https://world.openbeautyfacts.org/',allowedHosts:['world.openbeautyfacts.org'],userAgent:OBF_PUBLIC_SOURCE_RELEASE.userAgent,maxBytes:65536,timeoutMs:10000};
 const transport:ProviderTransport={...options.transport,fetch:async(url,request)=>{
  const response=await options.transport.fetch(url,request);
  if(response.status===429||response.status===503){const observed=now();const parsed=parseRetryAfter(response.headers.get('retry-after'),observed);const retryAt=new Date(Math.max(Date.parse(observed)+60000,parsed?Date.parse(parsed):0)).toISOString();try{await options.rpc('public/backoff',{policyVersion:OBF_PUBLIC_SOURCE_RELEASE.id,retryAt});}catch(error){await response.body?.cancel();throw error;}}
  return response;
 }};
 const budget=async(operation:'search')=>reservation.parse(await options.rpc('public/budget',{ownerId:options.ownerId,operation,policyVersion:OBF_PUBLIC_SOURCE_RELEASE.id})).allowed;
 return {
  async search(input:unknown){const policy=await currentPolicy();try{const reply=await searchPartOneProducts(input,policy,config,transport,{now,id:async(code:string)=>{const h=sha256(`openbeautyfacts:${code}`);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;},reserve:()=>budget('search')});await currentPolicy();return reply;}catch{throw new PartOneHttpError('public_source_unavailable',503);}},
  async consume(){const policy=await currentPolicy();return consumeOnce({rpc:async(action,payload)=>options.rpc(action==='reserve'?'public/reserve':action,action==='reserve'?{...payload,ownerId:options.ownerId,policyVersion:OBF_PUBLIC_SOURCE_RELEASE.id}:payload),lookupPorts:{now,policies:[policy],configs:{open_facts:config},transport}});},
 };
}
