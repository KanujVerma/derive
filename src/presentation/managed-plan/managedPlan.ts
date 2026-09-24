export type ManagedPlanStatus = 'preparing' | 'draft_review' | 'active' | 'adjustment_pending' | 'check_in_due' | 'error';
export type ProductDecision = 'keep' | 'add' | 'remove' | 'change';

export interface ManagedPlanProduct {
  id: string;
  name: string;
  timing?: 'morning' | 'evening' | 'both';
  instruction?: string;
  decision: ProductDecision;
  reason?: string;
}

export interface ManagedPlanSnapshot {
  status: ManagedPlanStatus;
  /** Caller must mark fixture data; the UI shows an illustrative label. */
  illustrative?: boolean;
  products: readonly ManagedPlanProduct[];
  changes: readonly string[];
  progress?: string;
  nextCheckIn?: string;
  message?: string;
}

export interface ManagedPlanView extends ManagedPlanSnapshot {
  title: string;
  detail: string;
  showRoutine: boolean;
  showRetry: boolean;
  showCheckIn: boolean;
}

const statusCopy: Record<ManagedPlanStatus, { title: string; detail: string }> = {
  preparing: { title: 'Your plan is being prepared', detail: 'Your submitted information is being reviewed. Your routine will appear here when it is ready.' },
  draft_review: { title: 'Your plan is under review', detail: 'A draft is being checked before your routine is published.' },
  active: { title: 'Your managed plan', detail: 'Follow your current routine and see how it changes over time.' },
  adjustment_pending: { title: 'An adjustment is in progress', detail: 'Keep following your current published routine until an update is ready.' },
  check_in_due: { title: 'Time for a check-in', detail: 'Share how your routine is going so your plan can be reviewed.' },
  error: { title: 'Your plan could not load', detail: 'Try again to see the latest plan. Your routine has not been changed here.' },
};

export function deriveManagedPlanView(snapshot: ManagedPlanSnapshot): ManagedPlanView {
  const { title, detail } = statusCopy[snapshot.status];
  return {
    ...snapshot, title, detail,
    showRoutine: ['active', 'adjustment_pending', 'check_in_due'].includes(snapshot.status),
    showRetry: snapshot.status === 'error',
    showCheckIn: snapshot.status === 'check_in_due',
  };
}
