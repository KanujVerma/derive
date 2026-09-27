export interface ContributionExperience {
  canPrepareRequest: boolean;
  primaryAction: 'try_another_way' | 'help_add_product';
  explanation: string;
  reviewActionLabel: string;
}

export function describeContributionExperience(availability: 'unavailable' | 'available'): ContributionExperience {
  if (availability === 'unavailable') return {
    canPrepareRequest: false,
    primaryAction: 'try_another_way',
    explanation: 'Asking Derive to add products is not available yet. You can try another way to check this product.',
    reviewActionLabel: 'Review product details',
  };
  return {
    canPrepareRequest: true,
    primaryAction: 'help_add_product',
    explanation: 'Tell us the brand and product name. You can add more details if you have them.',
    reviewActionLabel: 'Review product details',
  };
}
