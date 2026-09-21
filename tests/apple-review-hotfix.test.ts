import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_FUNCTION,
  deleteCurrentAccount,
  type AccountDeletionInvoker,
} from '../src/services/accountDeletion.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { CUSTOMER_ERROR_MESSAGES } from '../src/utils/customerErrors.ts';
import {
  shouldOfferStripeMembershipCheckout,
  shouldOfferStripeMembershipManagement,
  usesConciergeMembershipAccess,
} from '../src/utils/membershipPresentation.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { useUserStore } from '../src/stores/userStore.ts';
import { useRoutineStore } from '../src/stores/routineStore.ts';
import { useOnboardingStore } from '../src/stores/onboardingStore.ts';
import { useBootstrapStore } from '../src/stores/bootstrapStore.ts';

function client(options: {
  data?: unknown;
  error?: { name?: string; message?: string } | null;
  throwInvoke?: boolean;
  signOutError?: boolean;
}): { invoker: AccountDeletionInvoker; calls: Array<{ name: string; body: unknown }>; signedOut: boolean } {
  const calls: Array<{ name: string; body: unknown }> = [];
  const state = { signedOut: false };
  const invoker: AccountDeletionInvoker = {
    functions: {
      async invoke(name, invokeOptions) {
        calls.push({ name, body: invokeOptions.body });
        if (options.throwInvoke) throw new Error('FunctionsFetchError: storage path leaked');
        return { data: options.data ?? null, error: options.error ?? null };
      },
    },
    auth: {
      async signOut() {
        state.signedOut = true;
        if (options.signOutError) throw new Error('session already missing');
        return { error: null };
      },
    },
  };
  return { invoker, calls, get signedOut() { return state.signedOut; } };
}

test('Build 7: remote-staging hides Stripe membership management and production keeps it', () => {
  assert.equal(usesConciergeMembershipAccess('remote-staging'), true);
  assert.equal(shouldOfferStripeMembershipManagement('remote-staging', true), false);
  assert.equal(shouldOfferStripeMembershipCheckout('remote-staging'), false);
  assert.equal(shouldOfferStripeMembershipManagement('production', true), true);
  assert.equal(shouldOfferStripeMembershipManagement('development', true), true);
  assert.equal(shouldOfferStripeMembershipManagement('production', false), false);

  const profile = fs.readFileSync(path.resolve('app/profile/index.tsx'), 'utf8');
  const membership = fs.readFileSync(path.resolve('app/membership/index.tsx'), 'utf8');
  const combined = `${profile}\n${membership}`;
  assert.ok(profile.includes('shouldOfferStripeMembershipManagement'));
  assert.ok(profile.includes('Delete Account'));
  assert.ok(profile.includes('Delete your account?'));
  assert.ok(profile.includes("This can't be undone."));
  assert.ok(profile.includes('createMembershipPortalSession'));
  assert.ok(!combined.toLowerCase().includes('zelle'));
  assert.ok(!combined.toLowerCase().includes('venmo'));
  assert.ok(!combined.toLowerCase().includes('cash app'));
});

test('Build 7: deletion uses the existing authenticated function contract', async () => {
  const success = client({ data: { deleted: true } });
  resetCustomerSessionData();
  useAuthStore.getState().setSession('usr_delete', 'member@derive.skin');
  useUserStore.getState().setUser('usr_delete', 'member@derive.skin', 'Member');
  useRoutineStore.getState().loadArthurDemoRoutine();
  useOnboardingStore.getState().loadArthurDemoState();
  useOnboardingStore.getState().completeOnboarding();

  const result = await deleteCurrentAccount(success.invoker);
  assert.equal(result.success, true);
  assert.equal(success.calls.length, 1);
  assert.equal(success.calls[0].name, ACCOUNT_DELETION_FUNCTION);
  assert.deepEqual(success.calls[0].body, { confirmation: ACCOUNT_DELETION_CONFIRMATION });
  assert.equal(success.signedOut, true);
  assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
  assert.equal(useAuthStore.getState().sessionUserId, null);
  assert.equal(useUserStore.getState().userId, '');
  assert.equal(useRoutineStore.getState().routine, null);
  assert.equal(useOnboardingStore.getState().isCompleted, false);
  assert.equal(useBootstrapStore.getState().bootstrapState, null);
});

test('Build 7: uncertain deletion fails closed and preserves local state', async () => {
  const cases = [
    client({ data: { deleted: false }, error: { name: 'FunctionsHttpError', message: 'DELETION_FAILED storage path' } }),
    client({ data: {}, error: null }),
    client({ data: null, error: null }),
    client({ throwInvoke: true }),
  ];

  for (const current of cases) {
    resetCustomerSessionData();
    useAuthStore.getState().setSession('usr_keep', 'keep@derive.skin');
    useUserStore.getState().setUser('usr_keep', 'keep@derive.skin', 'Keep Member');
    useRoutineStore.getState().loadArthurDemoRoutine();
    const result = await deleteCurrentAccount(current.invoker);
    assert.equal(result.success, false);
    assert.equal(result.error, CUSTOMER_ERROR_MESSAGES.auth_delete_account);
    assert.equal(result.error?.includes('DELETION_FAILED'), false);
    assert.equal(result.error?.includes('storage'), false);
    assert.equal(result.error?.includes('FunctionsHttpError'), false);
    assert.equal(useAuthStore.getState().status, 'SIGNED_IN');
    assert.equal(useAuthStore.getState().sessionUserId, 'usr_keep');
    assert.equal(useUserStore.getState().fullName, 'Keep Member');
    assert.notEqual(useRoutineStore.getState().routine, null);
    assert.equal(current.signedOut, false);
  }

  const missing = await deleteCurrentAccount(null);
  assert.equal(missing.success, false);
  assert.equal(missing.error, CUSTOMER_ERROR_MESSAGES.auth_delete_account);
  resetCustomerSessionData();
});

test('Build 7: confirmed deletion still clears local state when provider sign-out fails', async () => {
  const current = client({ data: { deleted: true }, signOutError: true });
  resetCustomerSessionData();
  useAuthStore.getState().setSession('usr_gone', 'gone@derive.skin');
  const result = await deleteCurrentAccount(current.invoker);
  assert.equal(result.success, true);
  assert.equal(current.signedOut, true);
  assert.equal(useAuthStore.getState().status, 'SIGNED_OUT');
  resetCustomerSessionData();
});

test('Build 7: account deletion does not log secrets or change the server function', () => {
  const source = fs.readFileSync(path.resolve('src/services/accountDeletion.ts'), 'utf8');
  const server = fs.readFileSync(path.resolve('supabase/functions/delete-customer-account/index.ts'), 'utf8');
  assert.ok(source.includes("confirmation: ACCOUNT_DELETION_CONFIRMATION"));
  assert.ok(!source.includes('service_role'));
  assert.ok(!source.includes("membershipStatus: 'active'"));
  for (const line of source.split('\n')) {
    if (!line.includes('console.')) continue;
    assert.ok(!/\b(password|access_token|refresh_token)\b/.test(line), line);
  }
  assert.ok(server.includes('DELETE_MY_DERIVE_ACCOUNT'));
  assert.equal(fs.readFileSync(path.resolve('supabase/functions/delete-customer-account/index.ts'), 'utf8'), server);
});
