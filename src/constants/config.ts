/**
 * Derive Brand & Service Configuration
 * Centralized to keep the brand identity configurable and uncoupled from code logic.
 */

export const config = {
  appName: 'Derive',
  brandTagline: 'Your skincare, handled.',
  shortDescription: 'Managed personal skincare with continuous routine guidance and final quality check before activation.',
  /** Customer-facing Founding Beta display price (USD / month). Display/config only — Stripe/S5 owns charged money. */
  betaPriceMonthly: 25,
  currency: 'USD',
  founderSupportEmail: 'concierge@derive.skin',
  founderReviewWindowHours: 12,
  webCheckoutUrl: 'https://checkout.derive.skin/founding-beta',
  
  // Storage buckets
  storageBuckets: {
    skinPhotos: 'private-skin-photos',
    shelfPhotos: 'private-shelf-photos',
    productCatalog: 'public-products',
  },

  // Onboarding parameters
  onboarding: {
    targetMinutes: 5,
    maxFollowUpQuestions: 3,
  },
};
