import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders,readJsonObject,requirePlusEnabled,permanentOwner,rpc,jsonResponse,errorResponse,ServiceError } from '../_shared/plusBillingRuntime.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED'},405);
 try{
  requirePlusEnabled();if(Object.keys(await readJsonObject(req)).length)throw new ServiceError('INVALID_PAYLOAD','No billing identifiers are accepted',400);
  const {user,admin}=await permanentOwner(req);
  return jsonResponse(await rpc(admin,'read_plus_billing_access',{p_user_id:user.id}));
 }catch(error){return errorResponse(error);}
});
