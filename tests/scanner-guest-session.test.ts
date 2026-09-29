import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ensureFreeScannerSession, resetAuthAdapter, setAuthAdapter, type AuthAdapter } from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { useFreeAccessStore } from '../src/stores/freeAccessStore.ts';
import { resolvePublicEnvironment } from '../src/config/environment.ts';
import { resolveScannerEntry } from '../src/presentation/scanner-release/entry.ts';

const adapter = (patch: Partial<AuthAdapter> = {}): AuthAdapter => ({
  async signInWithOtp() { throw new Error('Not used'); },
  async verifyOtp() { throw new Error('Not used'); },
  async getSession() { return { data: { session: null }, error: null }; },
  async signOut() { return { error: null }; },
  onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  ...patch,
});
const guest = { id: 'guest-a', is_anonymous: true };
const created = { data: { user: guest, session: { user: guest } }, error: null };
const release = { buildFlavor: 'production', useRemoteService: 'true',
  supabaseUrl: 'https://snojlbqovlawewwqbviz.supabase.co',
  supabasePublishableKey: 'sb_publishable_' + 'a'.repeat(22) + '_' + 'b'.repeat(8), scannerReleaseEnabled: 'true' };

test('hosted guests are separately opted in; legacy, Mock and other projects cannot enable them', () => {
  assert.equal(resolvePublicEnvironment(release).scannerGuestEnabled, undefined);
  assert.equal(resolvePublicEnvironment({ ...release, scannerGuestEnabled: 'true' }).scannerGuestEnabled, true);
  for (const patch of [{ scannerReleaseEnabled: '' }, { buildFlavor: 'development' },
    { supabaseUrl: 'https://other.supabase.co' }, { useRemoteService: 'false' }, { scannerGuestEnabled: 'yes' }]) {
    assert.throws(() => resolvePublicEnvironment({ ...release, scannerGuestEnabled: 'true', ...patch }));
  }
});

test('guest startup never mounts login or private routes before the owner is established', () => {
  const input = { authStatus: 'SIGNED_OUT' as const, ownerId: null, accessStatus: 'UNRESOLVED', access: null,
    contextOwnerId: null, contextStatus: 'idle', hasProfile: false, profileIntroHandled: false };
  assert.equal(resolveScannerEntry(input), 'auth');
  assert.equal(resolveScannerEntry({ ...input, guestFirst: true }), 'loading');
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(root, /const guestBootstrap = localFreeIntegration \|\| hostedGuest/);
  assert.match(root, /if \(!guestBootstrap\) void getCurrentSession\(\)/);
  assert.match(root, /if \(!guestBootstrap \|\| authError/);
  assert.match(root, /freeIntegration && authError/);
});

test('first-launch callers share one guest creation; restart restores the same stored owner', async () => {
  let count = 0;
  let stored: { user: typeof guest } | null = null;
  setAuthAdapter(adapter({
    async getSession() { return { data: { session: stored }, error: null }; },
    async signInAnonymously() { count++; stored = created.data.session; return created; },
  }));
  try {
    resetCustomerSessionData();
    const calls = Array.from({ length: 5 }, () => ensureFreeScannerSession('hosted_free_integration'));
    assert(calls.every(call => call === calls[0]));
    assert.deepEqual(await Promise.all(calls), Array(5).fill('guest-a'));
    assert.equal(count, 1);
    resetCustomerSessionData();
    assert.equal(await ensureFreeScannerSession('hosted_free_integration'), 'guest-a');
    assert.equal(count, 1);
    assert.equal(useAuthStore.getState().sessionEmail, null);
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('existing permanent owners are not downgraded or replaced', async () => {
  setAuthAdapter(adapter({
    async getSession() { return { data: { session: { user: { id: 'permanent', email: 'a@example.test', is_anonymous: false } } }, error: null }; },
    async signInAnonymously() { throw new Error('Must not create'); },
  }));
  try {
    assert.equal(await ensureFreeScannerSession('hosted_free_integration'), 'permanent');
    assert.equal(useAuthStore.getState().sessionEmail, 'a@example.test');
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('uncertain or malformed stored sessions never become new guests or discard the owner', async () => {
  for (const value of [{ data: null, error: null }, { data: {}, error: null },
    { data: { session: undefined }, error: null }, { data: { session: { user: {} } }, error: null },
    { data: { session: { user: { id: ' ' } } }, error: null },
    { data: { session: null }, error: new Error('Offline') }]) {
    useAuthStore.getState().setSession('prior-owner', null);
    setAuthAdapter(adapter({
      async getSession() { return value as any; },
      async signInAnonymously() { throw new Error('Must not create'); },
    }));
    await assert.rejects(ensureFreeScannerSession('hosted_free_integration'));
    assert.equal(useAuthStore.getState().sessionUserId, 'prior-owner');
  }
  resetAuthAdapter(); resetCustomerSessionData();
});

test('failed signup can retry explicitly; mismatched or non-guest creation responses fail closed', async () => {
  const invalid = [
    { data: { user: null, session: null }, error: new Error('Rate limited') },
    { data: { user: guest, session: { user: { ...guest, id: 'other' } } }, error: null },
    { data: { user: { ...guest, is_anonymous: false }, session: { user: guest } }, error: null },
    { data: { user: guest, session: { user: { id: guest.id } } }, error: null },
  ];
  try {
    for (const response of invalid) {
      resetCustomerSessionData();
      setAuthAdapter(adapter({ async signInAnonymously() { return response; } }));
      await assert.rejects(ensureFreeScannerSession('hosted_free_integration'));
      assert.equal(useAuthStore.getState().sessionUserId, null);
    }
    setAuthAdapter(adapter({ async signInAnonymously() { return created; } }));
    assert.equal(await ensureFreeScannerSession('hosted_free_integration'), 'guest-a');
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('non-scanner shells cannot create guests, even during an in-flight scanner startup', async () => {
  setAuthAdapter(adapter({ async signInAnonymously() { return created; } }));
  try {
    const pending = ensureFreeScannerSession('hosted_free_integration');
    await assert.rejects(ensureFreeScannerSession('legacy'));
    await assert.rejects(ensureFreeScannerSession('scanner_first_preview'));
    assert.equal(await pending, 'guest-a');
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('a different guest owner clears the old access projection', async () => {
  useAuthStore.getState().setSession('old-owner', null);
  const attempt = useFreeAccessStore.getState().start('old-owner');
  useFreeAccessStore.getState().ready({ userId: 'old-owner', identityKind: 'anonymous', freeProductAccess: true,
    managedMembershipStatus: 'none', managedAccess: false }, attempt);
  setAuthAdapter(adapter({ async signInAnonymously() { return created; } }));
  try {
    await ensureFreeScannerSession('hosted_free_integration');
    assert.equal(useFreeAccessStore.getState().access, null);
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});
