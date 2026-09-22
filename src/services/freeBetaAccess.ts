import { supabase } from './supabase.ts';
import { getCustomerErrorMessage } from '../utils/customerErrors.ts';
import type { BuildFlavor } from '../config/environment.ts';
import type { CustomerBootstrapState } from '../domain/types.ts';

export const EXTERNAL_BETA_CLAIM_FUNCTION = 'claim_external_beta_access';

async function defaultClaim(): Promise<{ data: unknown; error: { name?: string } | null }> {
  if (!supabase) return { data: null, error: { name: 'MissingClient' } };
  const result = await supabase.rpc(EXTERNAL_BETA_CLAIM_FUNCTION);
  return { data: result.data, error: result.error };
}

let claimOverride: (() => Promise<{ data: unknown; error: { name?: string } | null }>) | null = null;

export function setExternalBetaClaimClientForTests(
  client: { rpc(name: string): Promise<{ data: unknown; error: { name?: string } | null }> } | null,
): void {
  claimOverride = client ? () => client.rpc(EXTERNAL_BETA_CLAIM_FUNCTION) : null;
}

export function resetExternalBetaClaimClientForTests(): void {
  claimOverride = null;
}

export function shouldAutoClaimExternalBeta(input: {
  buildFlavor: BuildFlavor;
  remoteEnabled: boolean;
  sessionUserId: string | null;
  state: CustomerBootstrapState;
}): boolean {
  return input.buildFlavor === 'remote-staging'
    && input.remoteEnabled
    && input.state.profileExists
    && input.state.membershipStatus === 'none'
    && input.sessionUserId === input.state.userId;
}

export async function claimExternalBetaAccess(): Promise<{ success: boolean; error?: string }> {
  if (!supabase && !claimOverride) {
    return { success: false, error: getCustomerErrorMessage('beta_access') };
  }
  try {
    const { data, error } = claimOverride ? await claimOverride() : await defaultClaim();
    const result = data && typeof data === 'object'
      ? (data as { result?: unknown }).result
      : null;
    if (error || (result !== 'granted' && result !== 'already_active' && result !== 'unchanged')) {
      console.warn('claimExternalBetaAccess backend error:', error?.name || 'claim_unconfirmed');
      return { success: false, error: getCustomerErrorMessage('beta_access') };
    }
    return { success: true };
  } catch (err: unknown) {
    console.warn('claimExternalBetaAccess exception:', err instanceof Error ? err.name : 'unknown_error');
    return { success: false, error: getCustomerErrorMessage('beta_access') };
  }
}

export async function elevateRemoteStagingBetaAccess(input: {
  buildFlavor: BuildFlavor;
  remoteEnabled: boolean;
  sessionUserId: string | null;
  state: CustomerBootstrapState;
  claim?: () => Promise<{ success: boolean }>;
  reread: () => Promise<CustomerBootstrapState>;
  isCurrent: () => boolean;
}): Promise<
  | { status: 'unchanged'; state: CustomerBootstrapState }
  | { status: 'active'; state: CustomerBootstrapState }
  | { status: 'stale' }
  | { status: 'failed' }
> {
  if (!shouldAutoClaimExternalBeta(input)) {
    return { status: 'unchanged', state: input.state };
  }
  if (!input.isCurrent()) return { status: 'stale' };
  const claim = input.claim ?? claimExternalBetaAccess;
  const claimed = await claim();
  if (!input.isCurrent()) return { status: 'stale' };
  if (!claimed.success) return { status: 'failed' };
  const refreshed = await input.reread();
  if (!input.isCurrent() || refreshed.userId !== input.state.userId) return { status: 'stale' };
  if (refreshed.membershipStatus !== 'active') return { status: 'failed' };
  return { status: 'active', state: refreshed };
}
