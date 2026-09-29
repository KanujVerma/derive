export interface PlusCheckoutAttempt {attemptId:string;sessionId:string|null;reservedAt:string}
/** Server-persisted attempt identity survives lease expiry, client retry IDs and ambiguous provider failures.
 * Stripe only promises idempotency retention for at least 24h; unresolved attempts stop at 23h for review.
 */
export function parsePlusCheckoutAttempt(value:unknown,now=Date.now()):PlusCheckoutAttempt{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid checkout attempt');
 const row=value as Record<string,unknown>;
 if(typeof row.attemptId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.attemptId)
  ||typeof row.reservedAt!=='string'||!Number.isFinite(Date.parse(row.reservedAt))
  ||(row.sessionId!==null&&(typeof row.sessionId!=='string'||!/^cs_[A-Za-z0-9_]+$/.test(row.sessionId))))throw new Error('Invalid checkout attempt');
 if(row.sessionId===null&&now-Date.parse(row.reservedAt)>=23*60*60*1000)throw new Error('PLUS_CHECKOUT_REQUIRES_REVIEW');
 return row as unknown as PlusCheckoutAttempt;
}
