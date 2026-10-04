import {createPartOneOrdinaryServices} from '../_shared/part-one-ordinary.ts';
import {createOpenBeautyFactsTransport} from '../_shared/part-one-pinned-transport.ts';
import {ordinaryPartThreeRelease} from '../../../src/domain/part-three/release.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handlePartOneRequest, PartOneHttpError, rpcErrorToHttp } from '../_shared/part-one-runtime.ts';
import { uploadPrivateDerivative, recoverPrivateCapture } from '../_shared/part-one-private-storage.ts';
import { createPrivateStoragePorts, privateService } from '../_shared/part-one-private-supabase.ts';
import { commitPrivateCapture } from '../_shared/part-one-private-commit.ts';

import { normalizeAuthorized, PartTwoHttpError } from '../_shared/part-two-runtime.ts';
import { createPartOneBoundedFetch } from '../_shared/part-one-bounded-fetch.ts';
import { authorizeServerUser } from '../_shared/server-auth.ts';
const boundedFetch=createPartOneBoundedFetch();
const publicTransport=createOpenBeautyFactsTransport();
Deno.serve(async (request: Request) => {
  // Clients and the verified owner are request-scoped, including private work.
  const url=Deno.env.get('SUPABASE_URL') ?? '';
  const key=Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization=request.headers.get('authorization') ?? '';
  const client=createClient(url || 'http://127.0.0.1',key || 'unconfigured',{
    global:{headers:{Authorization:authorization},fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false},
  });
  let ownerId:string|null=null;
  const operation=async(action:string,payload:Record<string,unknown>)=>{
    const {data,error}=await client.rpc('part_one_operation',{p_action:action,p_payload:payload});
    if(error)throw rpcErrorToHttp(error.code,error.message);
    return data;
  };
  const privatePorts=()=>{
    if(!ownerId)throw new PartOneHttpError('unauthorized',401);
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!serviceKey)throw new PartOneHttpError('private_capture_configuration_required',503);
    const admin=createClient(url,serviceKey,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}});
    return{ownerId,operation,service:privateService(admin),storage:createPrivateStoragePorts(admin,{publicApiOrigin:Deno.env.get('PART_ONE_PRIVATE_PUBLIC_API_ORIGIN')})};
  };
  const ordinaryServices=()=>{
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!ownerId||!serviceKey)return null;
    const admin=createClient(url,serviceKey,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}});
    return createPartOneOrdinaryServices({url,selectedReleaseId:Deno.env.get('DERIVE_CHECK_RELEASE'),sourceReleaseId:Deno.env.get('DERIVE_OBF_SOURCE_RELEASE'),ownerId,transport:publicTransport,
      rpc:async(action,payload)=>{const {data,error}=await admin.rpc('part_one_worker',{p_action:action,p_payload:payload});if(error)throw new PartOneHttpError('public_source_unavailable',503);return data;}});
  };
  const reply=await handlePartOneRequest(request,{
    async authorize() {
      if (!url || !key) throw new PartOneHttpError('configuration_required',503);
      if (!authorization.startsWith('Bearer ')) throw new PartOneHttpError('unauthorized',401);
      ownerId=await authorizeServerUser(client.auth,(code,status)=>new PartOneHttpError(code,status));
    },
    operation,
    search:async input=>{const services=ordinaryServices();if(!services)throw new PartOneHttpError('source_configuration_required',503);return services.search(input);},
    privateUpload:(request,id,binding)=>uploadPrivateDerivative(request,{captureSessionId:id,...binding},privatePorts()),
    privateCommit:(id,payload)=>commitPrivateCapture(id,payload,privatePorts()),
    privateRecover:id=>recoverPrivateCapture(id,privatePorts()),
  });
  // One durable public job per authorized scan/poll request. No recursive Edge
  // calls, perpetual loop, new scheduler, private extractor or provider defaults.
  if(ownerId&&reply.ok&&['GET','POST'].includes(request.method)&&/\/part-one\/scans(?:\/|$)/.test(new URL(request.url).pathname)){
    const services=ordinaryServices();if(services)EdgeRuntime.waitUntil(services.consume().catch(()=>undefined));
  }
  // Bounded precomputation after admitted/selected evidence. It uses the same
  // authenticated resolver and local deterministic worker as explicit reopen.
  // No provider, dictionary service or private-data export is involved.
  if(ownerId && reply.ok && request.method==='POST') {
    try {
      const body=await reply.clone().json();
      const result=body.result??(body.scanId?body:null);
      if(result && typeof result.scanId==='string' && Number.isInteger(result.generation) && Number.isInteger(result.resultRevision)) {
        const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if(serviceKey) {
          const admin=createClient(url,serviceKey,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}});
          const work=normalizeAuthorized({schemaVersion:1,requestId:crypto.randomUUID(),scanId:result.scanId,captureSessionId:body.capture?.captureSessionId??null,expectedGeneration:result.generation,expectedEvidenceRevision:result.resultRevision},ownerId,{
            authorize:async()=>ownerId!,
            dictionaryRelease:ordinaryPartThreeRelease(url,Deno.env.get('DERIVE_CHECK_RELEASE'))?.dictionaryRelease,
            localFixtureApproved:Deno.env.get('PART_TWO_LOCAL_FIXTURE')==='1'&&/^http:\/\/(?:127\.0\.0\.1|localhost|kong)(?::[0-9]+)?(?:\/|$)/.test(url),
            operation:async(action,payload)=>{if(action!=='resolve')throw new PartTwoHttpError('precompute_unavailable',503);const {data,error}=await admin.rpc('part_two_resolve',{p_owner:ownerId,p_payload:payload});if(error)throw new PartTwoHttpError('precompute_unavailable',503);return data;},
            worker:async(action,payload)=>{const {data,error}=await admin.rpc('part_two_worker',{p_action:action,p_payload:payload});if(error)throw new PartTwoHttpError('precompute_unavailable',503);return data;},
          }).catch(()=>undefined);
          EdgeRuntime.waitUntil(work);
        }
      }
    } catch { /* Part 1 admitted literal evidence remains usable. */ }
  }
  return reply;
});
