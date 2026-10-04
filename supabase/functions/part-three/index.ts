import {REVIEWED_USEFULNESS_MANIFEST} from '../../../src/domain/part-four/reviewedUsefulness.ts';
import {REVIEWED_PUBLIC_USEFULNESS_MANIFEST} from '../../../src/domain/part-four/reviewedHostedUsefulness.ts';
import {ordinaryPartThreeRelease} from '../../../src/domain/part-three/release.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {authorizeServerUser} from '../_shared/server-auth.ts';
import {normalizeAuthorized} from '../_shared/part-two-runtime.ts';
import {createPartOneBoundedFetch} from '../_shared/part-one-bounded-fetch.ts';
import {projectPersonalContextV2,migrateExperienceV1} from '../../../src/services/context/migrateV2.ts';
import {createJevProvider,createJevHttpTransport} from '../../../src/domain/part-three/provider.ts';
import {handlePersonalRequest,PartThreeError} from './handler.ts';
import {PENDING_SCIENTIFIC_MANIFEST} from '../../../src/domain/part-four/scientificDecision.ts';
import {REVIEWED_AHA_MANIFEST} from '../../../src/domain/part-four/reviewedAha.ts';
import {projectScientificFeatures} from '../../../src/domain/part-four/featureProjection.ts';
const headers={'content-type':'application/json','cache-control':'private, no-store, max-age=0','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type'};
const bounded=createPartOneBoundedFetch();
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')??'',anon=Deno.env.get('SUPABASE_ANON_KEY')??'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',authorization=req.headers.get('authorization')??'';
  if(!url||!anon||!service||!authorization.startsWith('Bearer '))return reply({error:'Authentication required'},401);
  const user=createClient(url,anon,{global:{headers:{Authorization:authorization},fetch:bounded},auth:{persistSession:false,autoRefreshToken:false}});
  const owner={id:await authorizeServerUser(user.auth,(code,status)=>new PartThreeError(code,status))};
  const admin=createClient(url,service,{global:{fetch:bounded},auth:{persistSession:false,autoRefreshToken:false}});
  const ordinary=ordinaryPartThreeRelease(url,Deno.env.get('DERIVE_CHECK_RELEASE'));
  const ordinaryScience=Deno.env.get('DERIVE_PART_FOUR_SCIENCE');
  if(ordinary&&ordinaryScience&&!['pending_candidates','reviewed_public_usefulness'].includes(ordinaryScience))return reply({kind:'unavailable',reason:'configuration_required'});
  if(!ordinary&&(Deno.env.get('PART_THREE_LOCAL_FIXTURE')!=='1'||!/^http:\/\/(?:127\.0\.0\.1|localhost|kong)(?::[0-9]+)?\/?$/.test(url)))return reply({kind:'unavailable',reason:'configuration_required'});
  const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(!reader)return reply({error:'Request required'},400);try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>32768){await reader.cancel();return reply({error:'Request is too large'},413);}chunks.push(next.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const checked=async(name:string,args:Record<string,unknown>)=>{const {data,error}=await admin.rpc(name,args);if(error)throw new PartThreeError(error.code==='42501'?'forbidden':'changed_basis',error.code==='42501'?403:409);return data;};
  let context:any=null;
  const pendingScience=Boolean(ordinary)||Deno.env.get('PART_FOUR_LOCAL_PENDING_SCIENCE')==='1';
  const composition=(ordinary?ordinaryScience==='reviewed_public_usefulness':Deno.env.get('PART_FOUR_LOCAL_REVIEWED_USEFULNESS')==='1')?'reviewed_usefulness' as const:undefined;
  const scientificManifest=composition?(ordinary?REVIEWED_PUBLIC_USEFULNESS_MANIFEST:REVIEWED_USEFULNESS_MANIFEST):!ordinary&&Deno.env.get('PART_FOUR_LOCAL_REVIEWED_AHA')==='1'?REVIEWED_AHA_MANIFEST:pendingScience?PENDING_SCIENTIFIC_MANIFEST:null;
  const result=await handlePersonalRequest(raw,{partFourComposition:composition,releaseSelection:ordinary??undefined,partFourEnabled:Boolean(ordinary)||Deno.env.get('PART_FOUR_LOCAL_FOUNDATION')==='1',partFourEducation:ordinary||Deno.env.get('PART_FOUR_LOCAL_EDUCATION')==='approved423'?'approved423':undefined,
   ...(scientificManifest?{partFourDecisionEvidence:{manifest:scientificManifest,load:async(binding,input)=>projectScientificFeatures({manifest:scientificManifest,binding,...input,now:new Date().toISOString()})}}:{}),
   ownerId:owner.id,now:()=>new Date().toISOString(),defer:work=>EdgeRuntime.waitUntil(work().catch(()=>undefined)),
   identity:(scanId,generation,revision,snapshotId,pinnedSnapshotId,captureSessionId)=>checked('part_three_worker',{p_owner:owner.id,p_action:'identity/resolve',p_payload:{scanId,generation,revision,snapshotId,pinnedSnapshotId,captureSessionId}}),
   worker:(action,payload)=>checked('part_three_worker',{p_owner:owner.id,p_action:action,p_payload:payload}),
   async normalize(r){return normalizeAuthorized({schemaVersion:1,requestId:r.requestId,scanId:r.scanId,captureSessionId:r.captureSessionId,expectedGeneration:r.expectedPartOneGeneration,expectedEvidenceRevision:r.expectedPartOneRevision},owner.id,{dictionaryRelease:ordinary?.dictionaryRelease,authorize:async()=>owner.id,localFixtureApproved:Deno.env.get('PART_TWO_LOCAL_FIXTURE')==='1',operation:(action,payload)=>action==='resolve'?checked('part_two_resolve',{p_owner:owner.id,p_payload:payload}):checked('part_two_operation',{p_action:action,p_payload:payload}),worker:(action,payload)=>checked('part_two_worker',{p_action:action,p_payload:payload})});},
   async context(){const raw=await checked('read_personal_context_v2',{p_user_id:owner.id});context=projectPersonalContextV2(raw.v1,raw.setupRevision);return context;},
   async history(revision,scope,cursor){const record=context?.experiences.find((e:any)=>e.data.id===(scope.kind==='manual'?scope.recordId:null));const page:any=await checked('read_personal_experience_history_v2',{p_user_id:owner.id,p_at_revision:revision,p_limit:50,p_cursor:cursor,p_product_id:scope.kind==='catalog'?scope.productId:null,p_manual_name:scope.kind==='manual'?(scope.name??(record?.data.reference.kind==='manual'?record.data.reference.name:null)):null});return {...page,items:page.items.map((e:any)=>typeof e.data.occurred?.start==='object'&&e.data.occurred?.start!==null?e:{...e,data:migrateExperienceV1(e.data)})};},
   provider:model=>createJevProvider(createJevHttpTransport(fetch,()=>Deno.env.get('JEV_API_KEY')??null),model),
  });return reply(result);
 }catch(error){return reply({error:'Personal assessment unavailable',code:error instanceof PartThreeError?error.code:'invalid_request'},error instanceof PartThreeError?error.status:400);}
});
