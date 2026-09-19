import { useRoutineStore } from '../stores/routineStore.ts';
import { useScanContextStore } from '../stores/scanContextStore.ts';
import { useOnboardingStore } from '../stores/onboardingStore.ts';

/** Clear managed skincare projections while retaining Auth and billing identity. */
export function clearManagedClientState(): void {
  useRoutineStore.getState().resetRoutine();
  useScanContextStore.getState().clearScanContext();
  useOnboardingStore.getState().resetOnboarding();
}
