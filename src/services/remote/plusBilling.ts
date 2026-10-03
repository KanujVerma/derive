import { supabase } from '../supabase.ts';
import { plusBillingTransport,type PlusBillingClient } from './plusBillingTransport.ts';
export { PlusBillingError } from './plusBillingTransport.ts';
export function loadPlusBillingAccess(ownerId:string,client:PlusBillingClient|null=supabase as PlusBillingClient|null){
 return plusBillingTransport(client).access(ownerId);
}
export function createPlusCheckout(requestId:string,client:PlusBillingClient|null=supabase as PlusBillingClient|null){
 return plusBillingTransport(client).checkout(requestId);
}
export function createPlusBillingPortal(requestId:string,client:PlusBillingClient|null=supabase as PlusBillingClient|null){
 return plusBillingTransport(client).portal(requestId);
}
