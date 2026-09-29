import { z } from 'zod';

export const plusBillingAccessSchema = z.strictObject({
  schemaVersion: z.literal('plus-billing/v1'), ownerId: z.string().uuid(),
  state: z.enum(['active','inactive','review_required']),
  reason: z.enum(['no_subscription','payment_unconfirmed','subscription_inactive','expired','refund_or_dispute']).nullable(),
  validUntil: z.iso.datetime({offset:true}).nullable(), cancelAtPeriodEnd: z.boolean(),
  checkedAt: z.iso.datetime({offset:true}),
}).superRefine((value,ctx)=>{
  if (value.state==='active' && (value.reason!==null || !value.validUntil || Date.parse(value.validUntil)<=Date.parse(value.checkedAt))) {
    ctx.addIssue({code:'custom',message:'Active Plus requires an unexpired paid period'});
  }
  if (value.state!=='active' && (value.reason===null || value.validUntil!==null)) {
    ctx.addIssue({code:'custom',message:'Inactive Plus cannot carry a paid grant'});
  }
  if ((value.state==='review_required') !== (value.reason==='refund_or_dispute')) {
    ctx.addIssue({code:'custom',message:'Review state requires a billing hold'});
  }
});
export type PlusBillingAccess = z.infer<typeof plusBillingAccessSchema>;
export const plusBillingRequestSchema=z.strictObject({requestId:z.string().uuid()});
export const plusBillingLinkSchema=z.strictObject({url:z.string().url()});
export type PlusBillingErrorCode='PLUS_BILLING_DISABLED'|'PERMANENT_ACCOUNT_REQUIRED'|'PLUS_BILLING_BUSY'
  |'PLUS_ALREADY_SUBSCRIBED'|'PLUS_BILLING_UNAVAILABLE'|'INVALID_PAYLOAD'|'UNAUTHORIZED';

/** Checkout/portal URLs are destinations, never evidence that Plus was paid. */
export function parsePlusBillingLink(value:unknown,kind:'checkout'|'portal'):string {
  const {url}=plusBillingLinkSchema.parse(value);
  const parsed=new URL(url);
  const host=kind==='checkout'?'checkout.stripe.com':'billing.stripe.com';
  if(parsed.protocol!=='https:'||parsed.hostname!==host||parsed.username||parsed.password||parsed.port) {
    throw new Error('Invalid billing destination');
  }
  return parsed.toString();
}
