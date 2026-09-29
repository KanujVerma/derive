import type { AuthStatus } from '../../stores/authStore.ts';
import type { FreeAccessState } from '../../contracts/FreeAccess.ts';

export type ScannerEntry = 'auth' | 'loading' | 'error' | 'profile' | 'check';
/** Routing never grants access and never substitutes one owner's context for another. */
export function resolveScannerEntry(input: {
  authStatus: AuthStatus; ownerId: string | null;
  accessStatus: string; access: FreeAccessState | null;
  contextOwnerId: string | null; contextStatus: string; hasProfile: boolean;
  profileIntroHandled: boolean;
}): ScannerEntry {
  if (input.authStatus === 'SIGNED_OUT') return 'auth';
  if (input.authStatus !== 'SIGNED_IN' || !input.ownerId) return 'loading';
  if (input.accessStatus === 'ERROR') return 'error';
  if (input.accessStatus !== 'READY' || input.access?.userId !== input.ownerId) return 'loading';
  if (input.contextOwnerId !== input.ownerId) return 'loading';
  if (input.contextStatus === 'error') return 'error';
  if (input.contextStatus !== 'ready') return 'loading';
  return input.hasProfile || input.profileIntroHandled ? 'check' : 'profile';
}
