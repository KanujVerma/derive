import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { parsePlusCheckoutAttempt } from '../../../src/domain/plus-billing/checkoutAttempt.ts';
import { corsHeaders,requirePurchaseGate,permanentOwner,requestId,stripeClient,allowedPrice,acquire,release,customerBinding,rpc,
  redirect,jsonResponse,errorResponse,ServiceError } from '../_shared/plusBillingRuntime.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED'},405);
 try{
  requirePurchaseGate();await requestId(req);const {user,admin}=await permanentOwner(req);
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
   let attempt=parsePlusCheckoutAttempt(await rpc(admin,'reserve_plus_checkout_attempt',{
    p_user_id:user.id,p_token:token,p_attempt_id:crypto.randomUUID()}));
   if(attempt.sessionId){
    const prior=await stripe.checkout.sessions.retrieve(attempt.sessionId);
    if(prior.customer!==customer||prior.client_reference_id!==user.id||prior.metadata?.derive_price_id!==price
      ||prior.metadata?.derive_attempt_id!==attempt.attemptId||prior.mode!=='subscription')throw new Error('Checkout binding conflict');
    if(prior.status==='open'&&prior.url)return jsonResponse({url:prior.url});
    if(prior.status==='complete'){
     const subId=typeof prior.subscription==='string'?prior.subscription:prior.subscription?.id;
     if(!subId)throw new ServiceError('PLUS_BILLING_BUSY','Payment is still updating',503);
     const sub=await stripe.subscriptions.retrieve(subId);
     if(!['canceled','incomplete_expired'].includes(sub.status))throw new ServiceError('PLUS_ALREADY_SUBSCRIBED','Manage your existing subscription',409);
    }else if(prior.status!=='expired')throw new Error('Checkout status unavailable');
    attempt=parsePlusCheckoutAttempt(await rpc(admin,'reserve_plus_checkout_attempt',{
     p_user_id:user.id,p_token:token,p_attempt_id:crypto.randomUUID(),p_rotate_attempt_id:attempt.attemptId}));
   }
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer,client_reference_id:user.id,
    line_items:[{price,quantity:1}],success_url:redirect('DERIVE_PLUS_CHECKOUT_SUCCESS_URL'),
    cancel_url:redirect('DERIVE_PLUS_CHECKOUT_CANCEL_URL'),allow_promotion_codes:false,
    metadata:{derive_capability:'plus',derive_price_id:price,derive_user_id:user.id,derive_attempt_id:attempt.attemptId},
    subscription_data:{metadata:{derive_capability:'plus',derive_user_id:user.id}},payment_method_types:['card']},
    {idempotencyKey:`derive-plus-checkout-${user.id}-${attempt.attemptId}`});
   if(!session.url)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Checkout could not be opened',503);
   await rpc(admin,'bind_plus_checkout_session',{p_user_id:user.id,p_token:token,p_attempt_id:attempt.attemptId,p_session_id:session.id});
   return jsonResponse({url:session.url});
  }finally{await release(admin,user.id,token);}
 }catch(error){return errorResponse(error);}
});
