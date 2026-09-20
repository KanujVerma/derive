import type { Routine } from '../types/schema.ts';
import type { PlanHydrationStatus } from '../stores/routineStore.ts';

export type ShopHomeState =
  | 'loading'
  | 'error'
  | 'preparing'
  | 'review'
  | 'needs_products'
  | 'covered'
  | 'empty';

interface ShopHomeInput {
  hydrationStatus: PlanHydrationStatus;
  routineStatus: Routine['status'] | null;
  isRoutineBeingPrepared: boolean;
  isPlanUnderReview: boolean;
  neededCount: number;
}

/** A covered Shop requires a resolved, published plan, never an empty cache. */
export function resolveShopHomeState(input: ShopHomeInput): ShopHomeState {
  if (input.hydrationStatus === 'idle' || input.hydrationStatus === 'loading') return 'loading';
  if (input.hydrationStatus === 'error') return 'error';
  if (input.isRoutineBeingPrepared) return 'preparing';
  if (input.isPlanUnderReview || (input.routineStatus && input.routineStatus !== 'published')) {
    return 'review';
  }
  if (input.routineStatus === 'published') {
    return input.neededCount > 0 ? 'needs_products' : 'covered';
  }
  return 'empty';
}
