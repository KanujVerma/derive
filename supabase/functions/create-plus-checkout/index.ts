import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders,requirePurchaseGate,permanentOwner,requestId,stripeClient,allowedPrice,acquire,release,customerBinding,rpc,
  redirect,jsonResponse,errorResponse,ServiceError } from '../_shared/plusBillingRuntime.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED'},405);
 try{
  requirePurchaseGate();const id=await requestId(req);const {user,admin}=await permanentOwner(req);
  const stripe=stripeClient(),price=await allowedPrice(stripe),token=await acquire(admin,user.id);
  try{
   let customer=await customerBinding(admin,user.id);
   if(!customer){
    const created=await stripe.customers.create({email:user.email,metadata:{derive_user_id:user.id,derive_capability:'plus'}},
      {idempotencyKey:`derive-plus-customer-${user.id}`});
    customer=created.id;
    await rpc(admin,'bind_plus_billing_customer',{p_user_id:user.id,p_token:token,p_customer_id:customer});
   }
   const subscriptions=await stripe.subscriptions.list({customer,price,status:'all',limit:100});
   if(subscriptions.has_more)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing account needs review',503);
   if(subscriptions.data.some(s=>!['canceled','incomplete_expired'].includes(s.status))) {
    throw new ServiceError('PLUS_ALREADY_SUBSCRIBED','Manage your existing Plus subscription in billing settings',409);
   }
   const sessions=await stripe.checkout.sessions.list({customer,limit:100});
   if(sessions.has_more)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing account needs review',503);
   const open=sessions.data.find(s=>s.status==='open'&&s.metadata?.derive_capability==='plus'
    &&s.metadata?.derive_price_id===price&&s.client_reference_id===user.id);
   if(open?.url)return jsonResponse({url:open.url});
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer,client_reference_id:user.id,
    line_items:[{price,quantity:1}],success_url:redirect('DERIVE_PLUS_CHECKOUT_SUCCESS_URL'),
    cancel_url:redirect('DERIVE_PLUS_CHECKOUT_CANCEL_URL'),allow_promotion_codes:false,
    metadata:{derive_capability:'plus',derive_price_id:price,derive_user_id:user.id},
    subscription_data:{metadata:{derive_capability:'plus',derive_user_id:user.id}},payment_method_types:['card']},
    {idempotencyKey:`derive-plus-checkout-${user.id}-${id}`});
   if(!session.url)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Checkout could not be opened',503);
   return jsonResponse({url:session.url});
  }finally{await release(admin,user.id,token);}
 }catch(error){return errorResponse(error);}
});
