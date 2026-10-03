import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@22.0.0';
import { plusBillingEventTypes,reconcileVerifiedPlusEvent,type PlusBillingSnapshot } from '../../../src/domain/plus-billing/lifecycle.ts';
import { record,resourceId,invoiceSubscription,readPlusSubscriptionTruth } from '../../../src/domain/plus-billing/stripeTruth.ts';
import { verifyPlusStripeEvent,boundedBody,requirePlusEnabled,expectedLiveMode,stripeClient,allowedPrice,plusAdmin,acquire,release,rpc,value,
 jsonResponse,errorResponse,ServiceError } from '../_shared/plusBillingRuntime.ts';

async function eventSubscriptionIds(stripe:Stripe,event:Stripe.Event):Promise<string[]>{
 const object=record(event.data.object);
 if(event.type.startsWith('customer.subscription.'))return [String(object.id)];
 if(event.type.startsWith('checkout.session.')){
  const id=resourceId(object.subscription);if(!id)throw new Error('Checkout subscription missing');return[id];
 }
 if(event.type.startsWith('invoice.')){
  const id=invoiceSubscription(object);return id?[id]:[];
 }
 let charge=object;
 if(event.type==='charge.dispute.created'){
  const chargeId=resourceId(object.charge);if(!chargeId)throw new Error('Dispute charge missing');
  charge=record(await stripe.charges.retrieve(chargeId));
 }
 const legacyInvoice=resourceId(charge.invoice);
 if(legacyInvoice){const id=invoiceSubscription(await stripe.invoices.retrieve(legacyInvoice));return id?[id]:[];}
 const paymentIntent=resourceId(charge.payment_intent);
 if(!paymentIntent)return [];
 const payments=await stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:paymentIntent},status:'paid',limit:100});
 if(payments.has_more)throw new Error('Risk invoice mapping requires review');
 const ids=new Set<string>();
 for(const payment of payments.data){
  const invoiceId=resourceId(payment.invoice);if(!invoiceId)throw new Error('Risk invoice missing');
  const id=invoiceSubscription(await stripe.invoices.retrieve(invoiceId));if(id)ids.add(id);
 }
 return [...ids];
}

Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED'},405);
 try{
  requirePlusEnabled();const signature=req.headers.get('stripe-signature');
  if(!signature)throw new ServiceError('INVALID_SIGNATURE','Stripe signature is required',400);
  const raw=await boundedBody(req,1_000_000);
  const stripe=stripeClient(),secret=value('STRIPE_PLUS_WEBHOOK_SECRET');
  const event=await verifyPlusStripeEvent(raw,signature,stripe,secret,expectedLiveMode());
  if(!plusBillingEventTypes.has(event.type))return jsonResponse({received:true,handled:false});
  const price=await allowedPrice(stripe),admin=plusAdmin();
  const candidates=await eventSubscriptionIds(stripe,event);const targets=[];
  for(const id of candidates){
   const subscription=await stripe.subscriptions.retrieve(id);
   const {data:known,error}=await admin.from('plus_billing_subscriptions').select('stripe_subscription_id').eq('stripe_subscription_id',id).maybeSingle();
   if(error)throw new Error('Plus subscription binding unavailable');
   if(known||subscription.items.data.some(item=>item.price.id===price))targets.push(subscription);
  }
  if(targets.length===0)return jsonResponse({received:true,handled:false});
  if(targets.length!==1)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing event needs review',503);
  const target=targets[0],customer=resourceId(target.customer);
  if(!customer)throw new Error('Plus customer missing');
  const {data:binding,error}=await admin.from('plus_billing_customers').select('user_id').eq('stripe_customer_id',customer).maybeSingle();
  if(error)throw new Error('Plus binding unavailable');
  if(!binding)return jsonResponse({received:true,handled:false}); // Never map by email or client metadata.
  const userId=binding.user_id;
  const result=await reconcileVerifiedPlusEvent({id:event.id,type:event.type,created:event.created,livemode:event.livemode},
   price,expectedLiveMode(),event.type==='charge.refunded'||event.type==='charge.dispute.created',{
    replay:async(eventId)=>{
     const result=await admin.from('plus_billing_events').select('event_id').eq('event_id',eventId).eq('user_id',userId).maybeSingle();
     if(result.error)throw new Error('Event replay unavailable');return !!result.data;
    },
    acquire:async()=>acquire(admin,userId),release:async(token)=>release(admin,userId,token),
    hold:async(token)=>{await rpc(admin,'suspend_plus_billing_subscription',{
     p_user_id:userId,p_token:token,p_subscription_id:target.id,p_risk:true});},
    currentTruth:async(token)=>{
     const current=await stripe.subscriptions.retrieve(target.id);
     const invoiceId=resourceId(current.latest_invoice);
     const invoice=invoiceId?await stripe.invoices.retrieve(invoiceId):null;
     try{return readPlusSubscriptionTruth(current,invoice,price,customer,expectedLiveMode());}
     catch(error){
      // Unsupported price/item/pause changes must not preserve a previous grant.
      // The owner lease is still held here; retrieve errors above remain retryable without inventing facts.
      await rpc(admin,'suspend_plus_billing_subscription',{p_user_id:userId,p_token:token,p_subscription_id:target.id,p_risk:false});
      throw error;
     }
    },
    commit:async(token,verified,snapshot:PlusBillingSnapshot)=>{
     await rpc(admin,'commit_plus_billing_snapshot',{p_user_id:userId,p_token:token,p_event_id:verified.id,p_event_type:verified.type,
      p_event_created_at:new Date(verified.created*1000).toISOString(),p_subscription_id:snapshot.subscriptionId,
      p_customer_id:snapshot.customerId,p_price_id:snapshot.priceId,p_status:snapshot.status,
      p_period_end:snapshot.periodEnd,p_cancel:snapshot.cancelAtPeriodEnd,p_paid_invoice_id:snapshot.paidInvoiceId,
      p_paid_until:snapshot.paidUntil,p_hold:snapshot.hold});
    },
   });
  return jsonResponse({received:true,handled:true,outcome:result});
 }catch(error){return errorResponse(error);}
});
