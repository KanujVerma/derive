import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveShellLanding, resolveShellPresentation } from '../src/utils/shellPresentation.ts';
import { resolveLocalAccessRoute } from '../src/utils/localAccessRouting.ts';
import { useFreeAccessStore } from '../src/stores/freeAccessStore.ts';
import { ensureLocalAnonymousSession, resetAuthAdapter, setAuthAdapter, subscribeToAuth, type AuthAdapter } from '../src/services/authClient.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';
import { useAuthStore } from '../src/stores/authStore.ts';
import { getFreeAccountPresentation } from '../src/components/account/freeAccountPresentation.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const access = (userId: string, managedAccess = false) => ({
  userId, identityKind: managedAccess ? 'permanent' as const : 'anonymous' as const,
  freeProductAccess: true as const,
  managedMembershipStatus: managedAccess ? 'active' as const : 'none' as const,
  managedAccess,
});

test('Wave-1 mode only activates for development Remote with an exact local host', () => {
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: false, supabaseUrl: '' }), 'scanner_first_preview');
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true, supabaseUrl: `http://${host}:54321` }), 'local_free_integration');
  }
  for (const url of ['https://snojlbqovlawewwqbviz.supabase.co', 'https://localhost.evil.test', 'http://192.168.1.2:54321', 'not a url']) {
    assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true, supabaseUrl: url }), 'legacy');
  }
  assert.equal(resolveShellPresentation({ buildFlavor: 'remote-staging', remoteEnabled: true, supabaseUrl: 'http://localhost:54321' }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'production', remoteEnabled: true, supabaseUrl: 'http://localhost:54321' }), 'legacy');
});

test('Wave-1 server access controls landing and free route boundary', () => {
  assert.equal(resolveShellLanding('local_free_integration', 'free'), '/(tabs)/check');
  assert.equal(resolveShellLanding('local_free_integration', 'managed'), '/(tabs)/plan');
  assert.equal(resolveLocalAccessRoute(['index'], access('anon-a')), '/(tabs)/check');
  assert.equal(resolveLocalAccessRoute(['index'], access('member', true)), '/(tabs)/plan');
  for (const segments of [['(auth)', 'login'], ['membership'], ['(onboarding)', '1-welcome'], ['check-in'], ['refill'], ['orders'], ['founder'], ['(tabs)', 'ask'], ['(tabs)', 'progress']]) {
    assert.equal(resolveLocalAccessRoute(segments, access('anon-a')), '/(tabs)/check', segments.join('/'));
  }
  for (const segments of [['(tabs)', 'check'], ['(tabs)', 'my-stuff'], ['(tabs)', 'plan'], ['(tabs)', 'shop'], ['profile'], ['shop', 'scan']]) {
    assert.equal(resolveLocalAccessRoute(segments, access('anon-a')), null, segments.join('/'));
  }
  assert.equal(resolveLocalAccessRoute(['check-in'], access('member', true)), null);
});

test('Wave-1 access projection rejects stale identity and survives same-user refresh', () => {
  const store = useFreeAccessStore.getState();
  store.reset();
  const attemptA = store.start('anon-a');
  assert.equal(store.ready(access('anon-a'), attemptA), true);
  assert.equal(useFreeAccessStore.getState().access?.userId, 'anon-a');
  assert.equal(useFreeAccessStore.getState().start('anon-a'), attemptA);
  assert.equal(useFreeAccessStore.getState().status, 'READY');
  const attemptB = useFreeAccessStore.getState().start('anon-b');
  assert.equal(useFreeAccessStore.getState().access, null);
  assert.equal(useFreeAccessStore.getState().ready(access('anon-a'), attemptA), false);
  assert.equal(useFreeAccessStore.getState().ready(access('anon-a'), attemptB), false);
  assert.equal(useFreeAccessStore.getState().ready(access('anon-b'), attemptB), true);
  resetCustomerSessionData();
  assert.equal(useFreeAccessStore.getState().access, null);
});

test('Wave-1 silent Auth preserves a session and signs in anonymously only when absent', async () => {
  let existing: { id: string; email?: string } | null = { id: 'permanent', email: 'member@example.com' };
  let signIns = 0;
  const adapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: existing ? { user: existing } : null }, error: null }; },
    async signInAnonymously() { signIns++; return { data: { user: { id: 'anon-new' }, session: { user: { id: 'anon-new' } } }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  };
  resetCustomerSessionData();
  setAuthAdapter(adapter);
  try {
    assert.equal(await ensureLocalAnonymousSession(), 'permanent');
    assert.equal(signIns, 0);
    assert.equal(useAuthStore.getState().sessionEmail, 'member@example.com');
    existing = null;
    assert.equal(await ensureLocalAnonymousSession(), 'anon-new');
    assert.equal(signIns, 1);
    assert.equal(useAuthStore.getState().sessionUserId, 'anon-new');
    assert.equal(useAuthStore.getState().sessionEmail, null);
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('Wave-1 silent Auth fails closed on lookup or anonymous sign-in errors', async () => {
  const base: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: new Error('lookup failed') }; },
    async signInAnonymously() { throw new Error('must not call'); },
    async signOut() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  };
  resetCustomerSessionData();
  setAuthAdapter(base);
  try {
    await assert.rejects(ensureLocalAnonymousSession());
    assert.equal(useAuthStore.getState().sessionUserId, null);
    setAuthAdapter({ ...base, async getSession() { return { data: { session: null }, error: null }; }, async signInAnonymously() { return { data: { user: null, session: null }, error: new Error('disabled') }; } });
    await assert.rejects(ensureLocalAnonymousSession());
    assert.equal(useAuthStore.getState().sessionUserId, null);
  } finally { resetAuthAdapter(); resetCustomerSessionData(); }
});

test('Wave-1 auth events retain same-user access and purge it on a new UUID', () => {
  let event: (name: string, session: any) => void = () => {};
  const adapter: AuthAdapter = {
    async signInWithOtp() { return { data: {}, error: null }; },
    async verifyOtp() { return { data: { session: null, user: null }, error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
    async signOut() { return { error: null }; },
    onAuthStateChange(callback) { event = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  };
  resetCustomerSessionData();
  setAuthAdapter(adapter);
  const subscription = subscribeToAuth();
  try {
    event('SIGNED_IN', { user: { id: 'anon-a' } });
    const attempt = useFreeAccessStore.getState().start('anon-a');
    useFreeAccessStore.getState().ready(access('anon-a'), attempt);
    event('TOKEN_REFRESHED', { user: { id: 'anon-a' } });
    assert.equal(useFreeAccessStore.getState().access?.userId, 'anon-a');
    event('SIGNED_IN', { user: { id: 'anon-b' } });
    assert.equal(useAuthStore.getState().sessionUserId, 'anon-b');
    assert.equal(useFreeAccessStore.getState().access, null);
  } finally { subscription.unsubscribe(); resetAuthAdapter(); resetCustomerSessionData(); }
});

test('Wave-1 free Account distinguishes anonymous from permanent without a membership claim', () => {
  assert.deepEqual(getFreeAccountPresentation('anonymous'), {
    intro: 'Check products without entering an email.', showSignOut: false,
  });
  assert.deepEqual(getFreeAccountPresentation('permanent'), {
    intro: 'Signed in for product checks.', showSignOut: true,
  });
});

test('Wave-1 UI consumption keeps free flows apart from managed work', () => {
  const root = read('app/_layout.tsx');
  const check = read('src/components/check/CheckProductScreen.tsx');
  const plan = read('app/(tabs)/plan.tsx');
  const shop = read('app/(tabs)/shop.tsx');
  const account = read('src/components/account/FreeAccountShell.tsx');
  assert.match(root, /managedAccess/);
  assert.match(root, /local_free_integration/);
  assert.match(check, /searchPreviewCatalog/);
  assert.match(check, /resolveCatalogIdentity/);
  assert.match(check, /<PersonalFitSection/);
  assert.match(read('src/presentation/personalization/result.ts'), /Not personalized yet/);
  assert.match(check, /local_free_integration/);
  assert.doesNotMatch(check, /label="Can't find it\? Request review"/, 'free name fallback cannot promise founder review');
  assert.match(plan, /managedAccess/);
  assert.match(plan, /bootstrapReady/, 'managed routine startup waits for canonical bootstrap');
  assert.match(shop, /managedAccess/);
  assert.match(shop, /bootstrapReady/, 'managed Shop hydration waits for canonical bootstrap');
  assert.match(account, /Delete Derive data/);
  assert.match(account, /Privacy/);
  assert.match(account, /Support/);
  assert.doesNotMatch(account, /Founding Beta|membership|fake email/);
  assert.doesNotMatch(account, /product checks are available on this device/, 'Wave-1 has no saved check history');
});
