import { useAuthStore } from '../stores/authStore';
import { useBootstrapStore } from '../stores/bootstrapStore';
import { useUserStore } from '../stores/userStore';
import { isRemoteServiceEnabled } from '../services/DeriveService';
import { resolveShopAudience } from './types';

/** One presentation boundary for Shop, product detail, and Scan. */
export function useShopAudience() {
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const bootstrapUserId = useBootstrapStore((state) => state.resolvedUserId);
  const bootstrapReady = useBootstrapStore((state) => state.status === 'READY');
  const bootstrapMembershipStatus = useBootstrapStore((state) => state.bootstrapState?.membershipStatus);
  const mockUserId = useUserStore((state) => state.userId);
  const mockMembershipStatus = useUserStore((state) => state.membershipStatus);
  return resolveShopAudience({
    remote: isRemoteServiceEnabled(),
    sessionUserId,
    bootstrapUserId,
    bootstrapReady,
    bootstrapMembershipStatus,
    mockUserId,
    mockMembershipStatus,
  });
}
