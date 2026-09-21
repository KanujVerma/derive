import type { BuildFlavor } from '../config/environment.ts';

/** Remote staging Founding Beta uses founder-activated access instead of in-app Stripe. */
export function usesConciergeMembershipAccess(buildFlavor: BuildFlavor): boolean {
  return buildFlavor === 'remote-staging';
}

export function shouldOfferStripeMembershipCheckout(buildFlavor: BuildFlavor): boolean {
  return !usesConciergeMembershipAccess(buildFlavor);
}
