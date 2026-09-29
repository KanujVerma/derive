import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders,requirePlusEnabled,permanentOwner,requestId,stripeClient,customerBinding,redirect,jsonResponse,errorResponse,ServiceError } from '../_shared/plusBillingRuntime.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED'},405);
 try{
  requirePlusEnabled();const id=await requestId(req);const {user,admin}=await permanentOwner(req);
  const customer=await customerBinding(admin,user.id);
  if(!customer)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','No Plus billing account was found',409);
  const portal=await stripeClient().billingPortal.sessions.create({customer,return_url:redirect('DERIVE_PLUS_PORTAL_RETURN_URL')},
   {idempotencyKey:`derive-plus-portal-${user.id}-${id}`});
  return jsonResponse({url:portal.url});
 }catch(error){return errorResponse(error);}
});
