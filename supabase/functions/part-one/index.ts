import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handlePartOneRequest, PartOneHttpError, rpcErrorToHttp } from '../_shared/part-one-runtime.ts';

Deno.serve(async (request: Request) => {
  // A separate client per request avoids account-switch credential leakage.
  const url=Deno.env.get('SUPABASE_URL') ?? '';
  const key=Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authorization=request.headers.get('authorization') ?? '';
  const client=createClient(url || 'http://127.0.0.1',key || 'unconfigured',{
    global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false},
  });
  return handlePartOneRequest(request,{
    async authorize() {
      if (!url || !key) throw new PartOneHttpError('configuration_required',503);
      if (!authorization.startsWith('Bearer ')) throw new PartOneHttpError('unauthorized',401);
      const {data:{user},error}=await client.auth.getUser();
      if (error || !user) throw new PartOneHttpError('unauthorized',401);
    },
    async operation(action,payload) {
      const {data,error}=await client.rpc('part_one_operation',{p_action:action,p_payload:payload});
      if (error) throw rpcErrorToHttp(error.code,error.message);
      return data;
    },
  });
});
