import type { AuthStatus } from '../../stores/authStore.ts';
import type { FreeAccessState } from '../../contracts/FreeAccess.ts';

export type ScannerEntry = 'auth' | 'loading' | 'error' | 'profile' | 'check';
/** A restored editor route must still complete the same first-session intro. */
export function needsScannerProfileRoute(segments: readonly string[], params: {
  p0b?: string; entry?: string; mode?: string;
}): boolean {
  return segments[0] !== 'personalize' || params.p0b !== '1' || params.entry !== '1'
    || Boolean(params.mode && params.mode !== 'profile');
}
/** Routing never grants access and never substitutes one owner's context for another. */
export function resolveScannerEntry(input: {
  authStatus: AuthStatus; ownerId: string | null;
  accessStatus: string; access: FreeAccessState | null;
  contextOwnerId: string | null; contextStatus: string; hasProfile: boolean;
  profileIntroHandled: boolean;
  /** Guest startup must finish before any private route can mount. */
  guestFirst?: boolean;
}): ScannerEntry {
  if (input.authStatus === 'SIGNED_OUT') return input.guestFirst ? 'loading' : 'auth';
  if (input.authStatus !== 'SIGNED_IN' || !input.ownerId) return 'loading';
  if (input.accessStatus === 'ERROR') return 'error';
  if (input.accessStatus !== 'READY' || input.access?.userId !== input.ownerId) return 'loading';
  if (input.contextOwnerId !== input.ownerId) return 'loading';
  if (input.contextStatus === 'error') return 'error';
  if (input.contextStatus !== 'ready') return 'loading';
  return input.hasProfile || input.profileIntroHandled ? 'check' : 'profile';
}
