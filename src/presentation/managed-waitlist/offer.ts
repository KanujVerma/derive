/** Stable offer identity. Do not derive this from screen copy. */
export const MANAGED_WAITLIST_OFFER_VERSION = 'managed_waitlist_v1';
export const MANAGED_WAITLIST_PRICE_CENTS = 2500;

export const managedOffer = {
  name: 'Managed Skincare',
  tagline: 'Your skincare, handled.',
  price: '$25/month',
  commercialTerm: 'Products purchased separately',
  explanation: 'Derive builds your routine, follows how it\'s going, and adjusts it when something needs to change.',
  benefits: [
    'One clear morning and evening routine',
    'Know what to keep, add, pause, or replace',
    'Check-ins that help your routine adapt over time',
    'You approve meaningful changes before they go live',
  ],
  joinLabel: 'Join waitlist',
  joinNote: 'We\'ll let you know in Derive when early access opens. No payment today.',
  joinedTitle: 'You\'re on the waitlist',
  joinedNote: 'We\'ll let you know when Managed Skincare opens.',
  leaveLabel: 'Leave waitlist',
  error: 'Couldn\'t join the waitlist. Try again.',
} as const;
