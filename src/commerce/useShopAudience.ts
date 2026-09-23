import { useAuthStore } from '../stores/authStore';
import { useBootstrapStore } from '../stores/bootstrapStore';
import { useUserStore } from '../stores/userStore';
import { isRemoteServiceEnabled } from '../services/DeriveService';
import { resolveShopAudience } from './types';
import { publicEnvironment } from '../config/environment';
import { resolveShellPresentation, resolveShellShopAudience } from '../utils/shellPresentation';

/** One presentation boundary for Shop, product detail, and Scan. */
export function useShopAudience() {
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const bootstrapUserId = useBootstrapStore((state) => state.resolvedUserId);
  const bootstrapReady = useBootstrapStore((state) => state.status === 'READY');
  const bootstrapMembershipStatus = useBootstrapStore((state) => state.bootstrapState?.membershipStatus);
  const mockUserId = useUserStore((state) => state.userId);
  const mockMembershipStatus = useUserStore((state) => state.membershipStatus);
  const remoteEnabled = isRemoteServiceEnabled();
  const audience = resolveShopAudience({
    remote: remoteEnabled,
    sessionUserId,
    bootstrapUserId,
    bootstrapReady,
    bootstrapMembershipStatus,
    mockUserId,
    mockMembershipStatus,
  });
  return resolveShellShopAudience(
    resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled }),
    audience,
  );
}
