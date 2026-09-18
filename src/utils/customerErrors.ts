/**
 * Customer-Safe Error Mapping
 *
 * Separates internal technical error details (e.g. Supabase errors, Edge Function names,
 * PostgREST codes, network stack traces) from customer-visible error copy.
 *
 * Provides deterministic, empathetic, operation-appropriate messaging in Direction A Mineral voice.
 * Internal technical error details should only be emitted to controlled developer logs (e.g. console.warn).
 */

export type CustomerFacingOperation =
  | 'onboarding'
  | 'ask'
  | 'scan'
  | 'checkin'
  | 'refill'
  | 'general';

export const CUSTOMER_ERROR_MESSAGES: Record<CustomerFacingOperation, string> = {
  onboarding: "We couldn't finish setting up your routine. Your setup is still here. Please try again.",
  ask: 'Unable to get an answer right now. Please try again.',
  scan: "We couldn't evaluate this product right now. Please try again.",
  checkin: "We couldn't submit your check-in. Your answers are still here. Please try again.",
  refill: "We couldn't submit your refill request. Please try again.",
  general: 'Something went wrong on our end. Please try again.',
};

/**
 * Returns customer-safe, deterministic error copy for a given domain operation.
 * Guarantees that raw backend/technical errors (e.g. 'RemoteDeriveService.* failed')
 * are never presented directly to the user.
 */
export function getCustomerErrorMessage(operation: CustomerFacingOperation): string {
  return CUSTOMER_ERROR_MESSAGES[operation] || CUSTOMER_ERROR_MESSAGES.general;
}
