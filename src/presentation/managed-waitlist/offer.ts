/** Stable offer identity. Do not derive this from screen copy. */
export const MANAGED_WAITLIST_OFFER_VERSION = 'managed_waitlist_v1';
export const MANAGED_WAITLIST_PRICE_CENTS = 2500;

export const managedOffer = {
  eyebrow: 'Early Access',
  name: 'Managed Skincare',
  tagline: 'Your skincare, handled.',
  price: '$25/month',
  commercialTerm: 'Products purchased separately',
  sectionLabel: 'What Derive handles',
  benefits: [
    { title: 'Your routine', body: 'Morning and evening plan' },
    { title: 'Your products', body: 'What to keep, add, pause, or replace' },
    { title: 'Ongoing adjustments', body: 'Check-ins guide changes.\nYou approve meaningful updates.' },
  ],
  joinLabel: 'Join waitlist',
  joinNote: 'No payment today.\nWe\'ll let you know when early access opens.',
  joinedTitle: 'You\'re on the waitlist',
  joinedNote: 'We\'ll let you know when Managed Skincare opens.',
  leaveLabel: 'Leave waitlist',
  error: 'Couldn\'t join right now. Try again.',
} as const;
