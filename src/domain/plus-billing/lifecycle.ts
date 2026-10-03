export interface PlusSubscriptionTruth {
  subscriptionId:string;customerId:string;priceId:string;status:string;
  periodEnd:number;cancelAtPeriodEnd:boolean;
  latestInvoice:{id:string;status:string;amountPaid:number;currency:string;periodEnd:number}|null;
}
export interface PlusBillingSnapshot {
  subscriptionId:string;customerId:string;priceId:string;status:string;
  periodEnd:string;cancelAtPeriodEnd:boolean;paidInvoiceId:string|null;paidUntil:string|null;
  hold:'refund_or_dispute'|null;
}
export const plusBillingEventTypes=new Set([
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'customer.subscription.created','customer.subscription.updated','customer.subscription.deleted',
  'customer.subscription.paused','customer.subscription.resumed',
  'invoice.paid','invoice.payment_failed','invoice.payment_action_required','invoice.finalization_failed',
  'charge.refunded','charge.dispute.created',
]);
const stripeId=(value:string,prefix:string)=>new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value);
/** Only current Stripe truth fetched while holding the owner lease can enter here.
 * An active status alone, a free trial, a success URL, or an unpaid invoice cannot grant Plus.
 */
export function evaluatePlusBillingTruth(truth:PlusSubscriptionTruth,allowedPrice:string,risk:boolean):PlusBillingSnapshot {
  if(!stripeId(truth.subscriptionId,'sub')||!stripeId(truth.customerId,'cus')||!stripeId(allowedPrice,'price')
    ||truth.priceId!==allowedPrice||!Number.isSafeInteger(truth.periodEnd)||truth.periodEnd<=0
    ||typeof truth.cancelAtPeriodEnd!=='boolean'
    ||!['active','trialing','incomplete','incomplete_expired','past_due','unpaid','paused','canceled'].includes(truth.status)) {
    throw new Error('Invalid Plus subscription truth');
  }
  const invoice=truth.latestInvoice;
  const paid=truth.status==='active'&&invoice!==null&&stripeId(invoice.id,'in')&&invoice.status==='paid'
    &&invoice.currency==='usd'&&Number.isSafeInteger(invoice.amountPaid)&&invoice.amountPaid>=499&&Number.isSafeInteger(invoice.periodEnd)
    &&invoice.periodEnd>=truth.periodEnd;
  return {subscriptionId:truth.subscriptionId,customerId:truth.customerId,priceId:truth.priceId,status:truth.status,
    periodEnd:new Date(truth.periodEnd*1000).toISOString(),cancelAtPeriodEnd:truth.cancelAtPeriodEnd,
    paidInvoiceId:paid?invoice.id:null,paidUntil:paid?new Date(truth.periodEnd*1000).toISOString():null,
    hold:risk?'refund_or_dispute':null};
}
export interface VerifiedPlusEvent {id:string;type:string;created:number;livemode:boolean}
export interface PlusReconcileDependencies {
  replay:(eventId:string)=>Promise<boolean>;
  acquire:()=>Promise<string|null>;
  currentTruth:(token:string)=>Promise<PlusSubscriptionTruth>;
  hold:(token:string)=>Promise<void>;
  commit:(token:string,event:VerifiedPlusEvent,snapshot:PlusBillingSnapshot)=>Promise<void>;
  release:(token:string)=>Promise<void>;
}
/** Signature verification and customer/subscription binding happen before this function.
 * No event timestamp sorting: a lease serializes current Stripe reads and fences expired writers.
 */
export async function reconcileVerifiedPlusEvent(event:VerifiedPlusEvent,allowedPrice:string,expectedLiveMode:boolean,
  risk:boolean,deps:PlusReconcileDependencies):Promise<'applied'|'replayed'|'ignored'>{
  if(!stripeId(event.id,'evt')||!Number.isSafeInteger(event.created)||event.created<=0||event.livemode!==expectedLiveMode) {
    throw new Error('Invalid verified Plus event');
  }
  if(!plusBillingEventTypes.has(event.type))return 'ignored';
  if(await deps.replay(event.id))return 'replayed';
  const token=await deps.acquire();
  if(!token)throw new Error('PLUS_BILLING_BUSY');
  try {
    // A signed refund/dispute must suspend an existing grant even if a later Stripe read fails.
    if(risk)await deps.hold(token);
    const snapshot=evaluatePlusBillingTruth(await deps.currentTruth(token),allowedPrice,risk);
    await deps.commit(token,event,snapshot);
    return 'applied';
  } finally {await deps.release(token);}
}
