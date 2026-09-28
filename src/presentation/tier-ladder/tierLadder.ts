import type { ProductEventProperties } from '../product-analytics';

export interface TierLadderInput {
  /** True only when the host has a real, approved Managed intent path. */
  managedInterestEnabled: boolean;
  source: ProductEventProperties<'managed_interest'>['source'];
}

export interface TierSummary {
  id: 'derive' | 'plus' | 'managed';
  name: string;
  summary: string;
  detail: string;
  status: string | null;
}

export interface ManagedInterestAction {
  event: 'managed_interest';
  properties: ProductEventProperties<'managed_interest'>;
  label: string;
}

export interface TierLadderView {
  tiers: readonly TierSummary[];
  managedInterestAction: ManagedInterestAction | null;
}

/** Presentation only. A future composition owner supplies verified availability and tracks intent. */
export function buildTierLadderView(input: TierLadderInput): TierLadderView {
  return {
    tiers: [
      {
        id: 'derive', name: 'Derive', summary: 'Personalized product intelligence',
        detail: 'Check a product with supported facts and guidance when evidence and your context allow it.',
        status: 'Free',
      },
      {
        id: 'plus', name: 'Derive Plus', summary: 'More self-service insight across products',
        detail: 'Compare products and see how they fit together when these tools become available.',
        status: 'In development',
      },
      {
        id: 'managed', name: 'Managed Skincare', summary: 'A routine managed for you',
        detail: 'A routine built and adjusted over time using check-ins.',
        status: input.managedInterestEnabled ? 'Early Access' : 'Coming later',
      },
    ],
    managedInterestAction: input.managedInterestEnabled
      ? { event: 'managed_interest', properties: { source: input.source }, label: "I'm interested" }
      : null,
  };
}
