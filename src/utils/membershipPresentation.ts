import type { BuildFlavor } from '../config/environment.ts';

/** Remote staging Founding Beta uses founder-activated access instead of in-app Stripe. */
export function usesConciergeMembershipAccess(buildFlavor: BuildFlavor): boolean {
  return buildFlavor === 'remote-staging';
}

export function shouldOfferStripeMembershipCheckout(buildFlavor: BuildFlavor): boolean {
  return !usesConciergeMembershipAccess(buildFlavor);
}

/** Stripe Billing Portal is the same concierge boundary as Checkout. */
export function shouldOfferStripeMembershipManagement(
  buildFlavor: BuildFlavor,
  remoteEnabled: boolean,
): boolean {
  return remoteEnabled && shouldOfferStripeMembershipCheckout(buildFlavor);
}

/** External TestFlight staging is a free beta. Price and provider features stay out of that build. */
export function usesFreeExternalBetaPresentation(buildFlavor: BuildFlavor): boolean {
  return usesConciergeMembershipAccess(buildFlavor);
}

export function showsProviderBetaFeatures(buildFlavor: BuildFlavor): boolean {
  return !usesFreeExternalBetaPresentation(buildFlavor);
}
