import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePlusBillingTruth,reconcileVerifiedPlusEvent,type PlusSubscriptionTruth,type PlusReconcileDependencies} from '../src/domain/plus-billing/lifecycle.ts';
import {readPlusSubscriptionTruth,invoiceSubscription} from '../src/domain/plus-billing/stripeTruth.ts';
import {plusBillingAccessSchema,parsePlusBillingLink} from '../src/contracts/PlusBilling.ts';
import {plusBillingTransport,PlusBillingError} from '../src/services/remote/plusBillingTransport.ts';
const owner='75000000-0000-4000-8000-000000000001',other='75000000-0000-4000-8000-000000000002';
const paid:PlusSubscriptionTruth={subscriptionId:'sub_plus',customerId:'cus_plus',priceId:'price_plus',status:'active',
 periodEnd:1900000000,cancelAtPeriodEnd:false,latestInvoice:{id:'in_plus',status:'paid',currency:'usd',amountPaid:499,periodEnd:1900000000}};
const verified={id:'evt_plus',type:'invoice.paid',created:1800000000,livemode:false};
function deps(overrides:Partial<PlusReconcileDependencies>={}){
 const calls:string[]=[];
 const value:PlusReconcileDependencies={replay:async()=>false,acquire:async()=>{calls.push('acquire');return 'lease';},
  currentTruth:async token=>{assert.equal(token,'lease');calls.push('read');return paid;},hold:async()=>{calls.push('hold');},
  commit:async()=>{calls.push('commit');},release:async()=>{calls.push('release');},...overrides};
 return {calls,value};
}
function stripeFixtures(){
 const price={id:'price_plus',currency:'usd',unit_amount:499,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
 const subscription={id:'sub_plus',customer:'cus_plus',livemode:false,status:'active',cancel_at_period_end:false,
  pause_collection:null,pending_update:null as unknown,latest_invoice:'in_plus',items:{has_more:false,data:[{price,quantity:1,current_period_end:1900000000}]}};
 const invoice={id:'in_plus',customer:'cus_plus',livemode:false,status:'paid',currency:'usd',amount_paid:499,
  parent:{type:'subscription_details',subscription_details:{subscription:'sub_plus'}},lines:{has_more:false,data:[{
   quantity:1,pricing:{price_details:{price:'price_plus'}},parent:{subscription_item_details:{proration:false}},period:{end:1900000000}}]}};
 return {subscription,invoice};
}
test('paid current period grants Plus without a Managed tier',()=>{
 const result=evaluatePlusBillingTruth(paid,'price_plus',false);
 assert.equal(result.paidUntil,new Date(paid.periodEnd*1000).toISOString());assert.equal(result.paidInvoiceId,'in_plus');
 assert.equal('managed' in result,false);assert.equal('tier' in result,false);
});
test('scheduled cancellation retains only the already paid period',()=>{
 const result=evaluatePlusBillingTruth({...paid,cancelAtPeriodEnd:true},'price_plus',false);
 assert.equal(result.cancelAtPeriodEnd,true);assert.equal(result.paidUntil,new Date(paid.periodEnd*1000).toISOString());
});
test('non-active lifecycle states cannot grant',()=>{
 for(const status of ['trialing','past_due','unpaid','incomplete','incomplete_expired','paused','canceled'])
  assert.equal(evaluatePlusBillingTruth({...paid,status},'price_plus',false).paidUntil,null);
});
test('unpaid, discounted, stale, or non-dollar invoice cannot grant',()=>{
 assert.equal(evaluatePlusBillingTruth({...paid,latestInvoice:null},'price_plus',false).paidUntil,null);
 for(const change of [{status:'open'},{amountPaid:0},{amountPaid:498},{amountPaid:499.5},{periodEnd:paid.periodEnd-1},{currency:'eur'}])
  assert.equal(evaluatePlusBillingTruth({...paid,latestInvoice:{...paid.latestInvoice!,...change}},'price_plus',false).paidUntil,null);
 assert.notEqual(evaluatePlusBillingTruth({...paid,latestInvoice:{...paid.latestInvoice!,amountPaid:525}},'price_plus',false).paidUntil,null);
});
test('wrong price, identifiers, period, or status fails closed',()=>{
 for(const change of [{priceId:'price_wrong'},{customerId:'cus_bad/slash'},{periodEnd:-1},{status:'made_up'}])
  assert.throws(()=>evaluatePlusBillingTruth({...paid,...change},'price_plus',false));
});
test('current API invoice binds to exactly one Plus subscription item',()=>{
 const {subscription,invoice}=stripeFixtures();assert.deepEqual(readPlusSubscriptionTruth(subscription,invoice,'price_plus','cus_plus',false),paid);
 assert.equal(invoiceSubscription({subscription:{id:'sub_legacy'}}),'sub_legacy');
});
test('foreign invoice, extra items, paused collection, proration, or wrong price rejects proof',()=>{
 const mutations:Array<(s:ReturnType<typeof stripeFixtures>['subscription'],i:ReturnType<typeof stripeFixtures>['invoice'])=>void>=[
  (s,i)=>{i.customer='cus_other';},(s,i)=>{i.parent.subscription_details.subscription='sub_other';},
  (s)=>{s.items.data.push(s.items.data[0]);},(s)=>{s.pending_update={};},
  (s)=>{s.items.data[0].price.id='price_wrong';},(s,i)=>{i.lines.data[0].parent.subscription_item_details.proration=true;},
  (s,i)=>{i.lines.has_more=true;},(s)=>{s.livemode=true;},
 ];
 for(const mutate of mutations){const {subscription,invoice}=stripeFixtures();mutate(subscription,invoice);assert.throws(()=>readPlusSubscriptionTruth(subscription,invoice,'price_plus','cus_plus',false));}
});
test('verified event obtains lease then reads current Stripe truth',async()=>{
 const d=deps();assert.equal(await reconcileVerifiedPlusEvent(verified,'price_plus',false,false,d.value),'applied');
 assert.deepEqual(d.calls,['acquire','read','commit','release']);
});
test('duplicate event does not fetch or write',async()=>{
 const d=deps({replay:async()=>true});assert.equal(await reconcileVerifiedPlusEvent(verified,'price_plus',false,false,d.value),'replayed');assert.deepEqual(d.calls,[]);
});
test('out-of-order event uses current paid state rather than old failed payload',async()=>{
 let status='';const d=deps({commit:async(t,e,s)=>{status=s.status;}});
 await reconcileVerifiedPlusEvent({...verified,type:'invoice.payment_failed',created:1700000000},'price_plus',false,false,d.value);
 assert.equal(status,'active');
});
test('risk hold precedes provider read and survives failure; lease always released',async()=>{
 const d=deps({currentTruth:async()=>{throw new Error('unavailable');}});
 await assert.rejects(reconcileVerifiedPlusEvent({...verified,type:'charge.refunded'},'price_plus',false,true,d.value));
 assert.deepEqual(d.calls,['acquire','hold','release']);
});
test('concurrent lock failure never fetches or commits',async()=>{
 const d=deps({acquire:async()=>null});await assert.rejects(reconcileVerifiedPlusEvent(verified,'price_plus',false,false,d.value),/BUSY/);assert.deepEqual(d.calls,[]);
});
test('wrong mode rejects and irrelevant event is ignored without lease',async()=>{
 const d=deps();await assert.rejects(reconcileVerifiedPlusEvent({...verified,livemode:true},'price_plus',false,false,d.value));
 assert.equal(await reconcileVerifiedPlusEvent({...verified,type:'customer.created'},'price_plus',false,false,d.value),'ignored');assert.deepEqual(d.calls,[]);
});
test('access contract rejects expired, foreign fields and inconsistent grants',()=>{
 const packet={schemaVersion:'plus-billing/v1',ownerId:owner,state:'active',reason:null,validUntil:'2030-01-01T00:00:00Z',checkedAt:'2026-09-29T00:00:00Z',cancelAtPeriodEnd:true};
 assert.equal(plusBillingAccessSchema.parse(packet).state,'active');
 for(const change of [{validUntil:'2020-01-01T00:00:00Z'},{reason:'expired'},{state:'inactive'},{tier:'managed'},{reason:'refund_or_dispute'}])
  assert.equal(plusBillingAccessSchema.safeParse({...packet,...change}).success,false);
});
test('billing destinations accept only exact official HTTPS hosts',()=>{
 assert.equal(parsePlusBillingLink({url:'https://checkout.stripe.com/c/pay/test'},'checkout'),'https://checkout.stripe.com/c/pay/test');
 for(const url of ['http://checkout.stripe.com/a','https://checkout.stripe.com.evil.test/a','https://evil@checkout.stripe.com/a','https://billing.stripe.com/a','derive://paid'])
  assert.throws(()=>parsePlusBillingLink({url},'checkout'));
 assert.throws(()=>parsePlusBillingLink({url:'https://checkout.stripe.com/a',paid:true},'checkout'));
});
test('client transport binds access to owner and sends only request ID',async()=>{
 let call:unknown;const client={functions:{invoke:async(name:string,options:{body:object})=>{call={name,...options};return {data:{url:'https://checkout.stripe.com/c/pay/test'},error:null};}}};
 await plusBillingTransport(client).checkout(owner);assert.deepEqual(call,{name:'create-plus-checkout',body:{requestId:owner}});
 const packet={schemaVersion:'plus-billing/v1',ownerId:other,state:'inactive',reason:'no_subscription',validUntil:null,checkedAt:'2026-09-29T00:00:00Z',cancelAtPeriodEnd:false};
 await assert.rejects(plusBillingTransport({functions:{invoke:async()=>({data:packet,error:null})}}).access(owner),/unavailable/);
});
test('client transport preserves only known server error codes',async()=>{
 const client={functions:{invoke:async()=>({data:null,error:{context:new Response(JSON.stringify({code:'PERMANENT_ACCOUNT_REQUIRED',message:'secret'}))}})}};
 await assert.rejects(plusBillingTransport(client).checkout(owner),(error:unknown)=>error instanceof PlusBillingError&&error.code==='PERMANENT_ACCOUNT_REQUIRED'&&!error.message.includes('secret'));
 await assert.rejects(plusBillingTransport(null).access(owner));
});
