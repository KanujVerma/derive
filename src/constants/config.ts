/**
 * Derive Brand & Service Configuration
 * Centralized to keep the brand identity configurable and uncoupled from code logic.
 */

export const config = {
  appName: 'Derive',
  brandTagline: 'Your skincare, handled.',
  shortDescription: 'Managed personal skincare with human oversight and continuous guidance.',
  betaPriceMonthly: 129,
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
