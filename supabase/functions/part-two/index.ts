import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handlePartTwoRequest, PartTwoHttpError } from '../_shared/part-two-runtime.ts';
import { createPartOneBoundedFetch } from '../_shared/part-one-bounded-fetch.ts';
const boundedFetch=createPartOneBoundedFetch();
Deno.serve(async(request:Request)=>{
 const url=Deno.env.get('SUPABASE_URL')??'',anon=Deno.env.get('SUPABASE_ANON_KEY')??'',authorization=request.headers.get('authorization')??'';
 const user=createClient(url||'http://127.0.0.1',anon||'unconfigured',{global:{headers:{Authorization:authorization},fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}});
 // Auth validates the current JWT owner; only the server resolver receives full
 // retained validation input. Saves/history remain checked user-JWT operations.
 let authenticatedOwnerId:string|null=null;
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const admin=service?createClient(url,service,{global:{fetch:boundedFetch},auth:{persistSession:false,autoRefreshToken:false}}):null;
 return handlePartTwoRequest(request,{
  localFixtureApproved:Deno.env.get('PART_TWO_LOCAL_FIXTURE')==='1'&&/^http:\/\/(?:127\.0\.0\.1|localhost|kong)(?::[0-9]+)?(?:\/|$)/.test(url),
  async authorize(){if(!url||!anon||!authorization.startsWith('Bearer '))throw new PartTwoHttpError('unauthorized',401);const {data:{user:owner},error}=await user.auth.getUser();if(error||!owner)throw new PartTwoHttpError('unauthorized',401);authenticatedOwnerId=owner.id;return owner.id;},
  async operation(action,payload){if(action==='resolve'&&(!admin||!authenticatedOwnerId))throw new PartTwoHttpError('normalization_configuration_required',503);const {data,error}=action==='resolve'?await admin!.rpc('part_two_resolve',{p_owner:authenticatedOwnerId,p_payload:payload}):await user.rpc('part_two_operation',{p_action:action,p_payload:payload});if(error){if(error.code==='42501')throw new PartTwoHttpError('forbidden',403);if(error.message.includes('INVALID'))throw new PartTwoHttpError('invalid_request',400);throw new PartTwoHttpError('part_two_unavailable',503);}return data;},
  async worker(action,payload){if(!admin)throw new PartTwoHttpError('normalization_configuration_required',503);const {data,error}=await admin.rpc('part_two_worker',{p_action:action,p_payload:payload});if(error)throw new PartTwoHttpError('part_two_unavailable',503);return data;},
 });
});
