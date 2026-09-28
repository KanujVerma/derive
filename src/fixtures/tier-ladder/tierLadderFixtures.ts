import type { TierLadderInput } from '../../presentation/tier-ladder/tierLadder';

/** Illustrative states only. They do not grant access or save customer intent. */
export const tierLadderFixtures = {
  preview: { managedInterestEnabled: false, source: 'plan' },
  managedInterestOpen: { managedInterestEnabled: true, source: 'plan' },
} as const satisfies Record<string, TierLadderInput>;
