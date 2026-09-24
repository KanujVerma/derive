import type { MyStuffViewModel } from '../../presentation/my-stuff/myStuffPresentation.ts';

/** Anonymous runtime fallback until the owner-bound free context read contract lands. */
export const anonymousEmptyMyStuff: MyStuffViewModel = {
  profile: null,
  products: [],
  checks: [],
  experiences: [],
};

export const personalizedMyStuff: MyStuffViewModel = {
  ...anonymousEmptyMyStuff,
  profile: { concerns: ['Dryness', 'Uneven tone'], skinFeel: 'Dry' },
};

export const productsMyStuff: MyStuffViewModel = {
  ...anonymousEmptyMyStuff,
  products: [
    { id: 'product-cleanser', name: 'Gentle Cleanser', brand: 'Example Brand', state: 'using' },
    { id: 'product-sunscreen', name: 'Daily SPF', brand: 'Example Brand', state: 'considering' },
    { id: 'product-serum', name: 'Renewing Serum', brand: 'Example Brand', state: 'stopped' },
  ],
};

export const historyMyStuff: MyStuffViewModel = {
  ...anonymousEmptyMyStuff,
  checks: [
    { id: 'check-cleanser', productName: 'Gentle Cleanser', checkedAt: 'Sep 21', outcome: 'checked' },
    { id: 'check-sunscreen', productName: 'Daily SPF', checkedAt: 'Sep 18', outcome: 'checked' },
  ],
};

export const reactionsMyStuff: MyStuffViewModel = {
  ...anonymousEmptyMyStuff,
  experiences: [
    { id: 'experience-tolerated', productName: 'Gentle Cleanser', kind: 'tolerated', note: 'Comfortable after washing' },
    { id: 'experience-reacted', productName: 'Renewing Serum', kind: 'reacted', note: 'Stinging after use' },
    { id: 'experience-liked', productName: 'Daily SPF', kind: 'liked', note: 'Comfortable finish' },
  ],
};

export const mixedMyStuff: MyStuffViewModel = {
  profile: personalizedMyStuff.profile,
  products: productsMyStuff.products,
  checks: historyMyStuff.checks,
  experiences: [
    ...reactionsMyStuff.experiences,
    { id: 'experience-finished', productName: 'Gentle Cleanser', kind: 'finished', notedAt: 'Sep 20' },
  ],
};
