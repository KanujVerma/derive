import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handlePartOneRequest, PartOneHttpError, rpcErrorToHttp } from '../_shared/part-one-runtime.ts';
import { uploadPrivateDerivative, recoverPrivateCapture } from '../_shared/part-one-private-storage.ts';
import { createPrivateStoragePorts, privateService } from '../_shared/part-one-private-supabase.ts';
import { commitPrivateCapture } from '../_shared/part-one-private-commit.ts';

import { createPartOneBoundedFetch } from '../_shared/part-one-bounded-fetch.ts';
const boundedFetch=createPartOneBoundedFetch();
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
  return handlePartOneRequest(request,{
    async authorize() {
      if (!url || !key) throw new PartOneHttpError('configuration_required',503);
      if (!authorization.startsWith('Bearer ')) throw new PartOneHttpError('unauthorized',401);
      const {data:{user},error}=await client.auth.getUser();
      if (error || !user) throw new PartOneHttpError('unauthorized',401);
      ownerId=user.id;
    },
    operation,
    privateUpload:(request,id,binding)=>uploadPrivateDerivative(request,{captureSessionId:id,...binding},privatePorts()),
    privateCommit:(id,payload)=>commitPrivateCapture(id,payload,privatePorts()),
    privateRecover:id=>recoverPrivateCapture(id,privatePorts()),
  });
});
