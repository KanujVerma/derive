import type { PlusSubscriptionTruth } from './lifecycle.ts';
export function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid Stripe object');
 return value as Record<string,unknown>;
}
export function resourceId(value:unknown):string|null {
 if(typeof value==='string')return value;
 if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof (value as Record<string,unknown>).id==='string') {
  return (value as {id:string}).id;
 }
 return null;
}
export function invoiceSubscription(value:unknown):string|null{
 const invoice=record(value);
 if(invoice.parent&&typeof invoice.parent==='object'){
  const parent=record(invoice.parent);
  if(parent.type==='subscription_details'&&parent.subscription_details) {
   return resourceId(record(parent.subscription_details).subscription);
  }
 }
 return resourceId(invoice.subscription);
}
/** Match the one allowed subscription item and its own paid invoice line.
 * Tax can increase amount paid; discounts, credits, prorations and extra items do not grant under this first policy.
 */
export function readPlusSubscriptionTruth(subscriptionValue:unknown,invoiceValue:unknown,priceId:string,
 expectedCustomer:string,expectedLive:boolean):PlusSubscriptionTruth {
 const subscription=record(subscriptionValue),items=record(subscription.items);
 if(!Array.isArray(items.data)||items.data.length!==1||items.has_more!==false
  ||resourceId(subscription.customer)!==expectedCustomer||subscription.livemode!==expectedLive
  ||subscription.pause_collection!==null||subscription.pending_update!==null)throw new Error('Invalid Plus subscription');
 const item=record(items.data[0]),price=record(item.price),recurring=record(price.recurring);
 if(price.id!==priceId||price.currency!=='usd'||price.unit_amount!==499||price.type!=='recurring'
  ||recurring.interval!=='month'||recurring.interval_count!==1||recurring.usage_type!=='licensed'
  ||item.quantity!==1||typeof subscription.status!=='string'||typeof subscription.cancel_at_period_end!=='boolean'
  ||!Number.isSafeInteger(item.current_period_end))throw new Error('Invalid Plus price or period');
 const truth:PlusSubscriptionTruth={subscriptionId:String(subscription.id),customerId:expectedCustomer,priceId,
  status:subscription.status,periodEnd:Number(item.current_period_end),cancelAtPeriodEnd:subscription.cancel_at_period_end,
  latestInvoice:null};
 if(invoiceValue===null)return truth;
 const invoice=record(invoiceValue),lines=record(invoice.lines);
 const empty=(value:unknown)=>value===null||(Array.isArray(value)&&value.length===0);
 if(resourceId(subscription.latest_invoice)!==invoice.id||invoiceSubscription(invoice)!==subscription.id
  ||resourceId(invoice.customer)!==expectedCustomer||invoice.livemode!==expectedLive
  ||!Array.isArray(invoice.discounts)||invoice.discounts.length!==0||!empty(invoice.total_discount_amounts)
  ||!empty(invoice.total_pretax_credit_amounts)||invoice.starting_balance!==0
  ||invoice.pre_payment_credit_notes_amount!==0||invoice.post_payment_credit_notes_amount!==0
  ||!Array.isArray(lines.data)||lines.has_more!==false||lines.data.length!==1)throw new Error('Invoice is not bound to Plus');
 const line=record(lines.data[0]);
 const pricing=line.pricing?record(line.pricing):null;
 const details=pricing?.price_details?record(pricing.price_details):null;
 const linePrice=resourceId(details?.price)??resourceId(line.price);
 const parent=line.parent?record(line.parent):null;
 const detail=parent?.subscription_item_details?record(parent.subscription_item_details):null;
 const proration=detail?.proration??line.proration;
 const period=record(line.period);
 if(linePrice!==priceId||line.quantity!==1||line.amount!==499||proration!==false||!Number.isSafeInteger(period.end)
  ||!Array.isArray(line.discounts)||line.discounts.length!==0||!empty(line.discount_amounts)||!empty(line.pretax_credit_amounts)
  ||typeof invoice.status!=='string'||typeof invoice.currency!=='string'||!Number.isSafeInteger(invoice.amount_paid)) {
  throw new Error('Invoice line does not prove a full Plus payment');
 }
 truth.latestInvoice={id:String(invoice.id),status:invoice.status,currency:invoice.currency,
  amountPaid:Number(invoice.amount_paid),periodEnd:Number(period.end)};
 return truth;
}
