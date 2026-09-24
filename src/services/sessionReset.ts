import { useAuthStore } from '../stores/authStore.ts';
import { useUserStore } from '../stores/userStore.ts';
import { useBootstrapStore } from '../stores/bootstrapStore.ts';
import { clearInFlightBootstrapRefreshes, clearInFlightHydrations, clearInFlightProposals } from './deriveClient.ts';
import { clearManagedClientState } from './memberCache.ts';
import { useFreeAccessStore } from '../stores/freeAccessStore.ts';

/**
 * Resets all customer session data, caches, and active state across stores.
 * Must be invoked on remote sign-out or when changing authenticated identities
 * to prevent data leakage across distinct user sessions.
 */
export function resetCustomerSessionData(): void {
  useAuthStore.getState().setSignedOut();
  useFreeAccessStore.getState().reset();
  useUserStore.getState().logout();
  clearManagedClientState();
  useBootstrapStore.getState().resetBootstrap();
  clearInFlightHydrations();
  clearInFlightProposals();
  clearInFlightBootstrapRefreshes();
}
