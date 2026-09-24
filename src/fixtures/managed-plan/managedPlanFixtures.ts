import type { ManagedPlanSnapshot, ManagedPlanStatus } from '../../presentation/managed-plan/managedPlan';

/** Illustrative display states. Never use these as member data or entitlement evidence. */
export const managedPlanFixtures: Record<ManagedPlanStatus, ManagedPlanSnapshot> = {
  preparing: { status: 'preparing', illustrative: true, products: [], changes: [] },
  draft_review: { status: 'draft_review', illustrative: true, products: [], changes: [] },
  active: {
    status: 'active', illustrative: true,
    products: [
      { id: 'cleanser', name: 'Your current cleanser', timing: 'both', decision: 'keep', instruction: 'Use as directed in your published routine.' },
      { id: 'moisturizer', name: 'Your current moisturizer', timing: 'both', decision: 'keep' },
    ],
    changes: ['Keep your existing cleanser while your routine settles.'],
    progress: 'Your check-ins will show what has changed over time.',
    nextCheckIn: 'Next check-in date appears here',
  },
  adjustment_pending: {
    status: 'adjustment_pending', illustrative: true,
    products: [{ id: 'cleanser', name: 'Your current cleanser', timing: 'both', decision: 'keep' }],
    changes: ['A requested change is being reviewed.'],
  },
  check_in_due: {
    status: 'check_in_due', illustrative: true,
    products: [{ id: 'cleanser', name: 'Your current cleanser', timing: 'both', decision: 'keep' }],
    changes: [], nextCheckIn: 'Due now',
  },
  error: { status: 'error', illustrative: true, products: [], changes: [] },
};
