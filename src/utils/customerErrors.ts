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
  | 'general'
  | 'auth'
  | 'auth_invalid_email'
  | 'auth_invalid_otp'
  | 'auth_invalid_name'
  | 'auth_invalid_password'
  | 'auth_send_code'
  | 'auth_signin'
  | 'auth_signout'
  | 'auth_signup'
  | 'auth_signup_unconfirmed'
  | 'auth_password_signin'
  | 'auth_delete_account'
  | 'beta_access'
  | 'bootstrap'
  | 'routine';

export const CUSTOMER_ERROR_MESSAGES: Record<CustomerFacingOperation, string> = {
  onboarding: "We couldn't finish setting up your routine. Your setup is still here. Please try again.",
  ask: 'Unable to get an answer right now. Please try again.',
  scan: "We couldn't evaluate this product right now. Please try again.",
  checkin: "We couldn't submit your check-in. Your answers are still here. Please try again.",
  refill: "We couldn't submit your refill request. Please try again.",
  general: 'Something went wrong on our end. Please try again.',
  auth: "We couldn't sign you in right now. Please try again.",
  auth_invalid_email: 'Enter a valid email address.',
  auth_invalid_otp: "That code didn't work. Check it and try again.",
  auth_invalid_name: 'Enter your first and last name.',
  auth_invalid_password: 'Password must be at least 8 characters.',
  auth_send_code: "We couldn't send a code right now. Please try again.",
  auth_signin: "We couldn't sign you in right now. Please try again.",
  auth_signout: "We couldn't sign you out right now. Please try again.",
  auth_signup: "We couldn't create your account right now. Please try again.",
  auth_signup_unconfirmed: "We couldn't finish creating your account. Please try again.",
  auth_password_signin: "Email or password didn't work. Check your details and try again.",
  auth_delete_account: "We couldn't delete your account right now. Please try again.",
  beta_access: "We couldn't finish opening your beta access automatically. Please try again.",
  bootstrap: "We couldn't finish loading your account. Please try again.",
  routine: "We couldn't refresh your routine right now. Please try again.",
};

/**
 * Returns customer-safe, deterministic error copy for a given domain operation.
 * Guarantees that raw backend/technical errors (e.g. 'RemoteDeriveService.* failed')
 * are never presented directly to the user.
 */
export function getCustomerErrorMessage(operation: CustomerFacingOperation): string {
  return CUSTOMER_ERROR_MESSAGES[operation] || CUSTOMER_ERROR_MESSAGES.general;
}
