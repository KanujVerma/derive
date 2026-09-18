import { useAuthStore } from '../stores/authStore.ts';
import { useUserStore } from '../stores/userStore.ts';
import { useRoutineStore } from '../stores/routineStore.ts';
import { useScanContextStore } from '../stores/scanContextStore.ts';
import { useOnboardingStore } from '../stores/onboardingStore.ts';

/**
 * Resets all customer session data, caches, and active state across stores.
 * Must be invoked on remote sign-out or when changing authenticated identities
 * to prevent data leakage across distinct user sessions.
 */
export function resetCustomerSessionData(): void {
  useAuthStore.getState().setSignedOut();
  useUserStore.getState().logout();
  useRoutineStore.getState().resetRoutine();
  useScanContextStore.getState().clearScanContext();
  useOnboardingStore.getState().resetOnboarding();
}

