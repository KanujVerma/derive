import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicEnvironment } from '../src/config/environment.ts';
import { isFreeIntegrationShell, resolveShellPresentation } from '../src/utils/shellPresentation.ts';
import { needsScannerProfileRoute, resolveScannerEntry } from '../src/presentation/scanner-release/entry.ts';
import { useScannerEntryStore } from '../src/stores/scannerEntryStore.ts';
import { resolvePlanPresentation } from '../src/presentation/managed-plan/planComposition.ts';

const hosted = 'https://snojlbqovlawewwqbviz.supabase.co';
const configuration = { buildFlavor: 'production', useRemoteService: 'true', supabaseUrl: hosted,
  supabasePublishableKey: 'sb_publishable_' + 'a'.repeat(22) + '_' + 'b'.repeat(8), scannerReleaseEnabled: 'true' };

test('scanner release is explicit, exact-project, Remote and publishable-only', () => {
  assert.equal(resolvePublicEnvironment(configuration).scannerReleaseEnabled, true);
  for (const patch of [{ buildFlavor: 'development' }, { useRemoteService: 'false' },
    { supabaseUrl: 'https://other.supabase.co' }, { supabasePublishableKey: '' },
    { supabasePublishableKey: 'sb_secret_bad' }]) {
    assert.throws(() => resolvePublicEnvironment({ ...configuration, ...patch }));
  }
  assert.equal(resolveShellPresentation({ buildFlavor: 'production', remoteEnabled: true, supabaseUrl: hosted }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'production', remoteEnabled: true, supabaseUrl: hosted, scannerReleaseEnabled: true }), 'hosted_free_integration');
  assert.equal(isFreeIntegrationShell('hosted_free_integration'), true);
  assert.equal(isFreeIntegrationShell('scanner_first_preview'), false);
  assert.deepEqual(resolvePlanPresentation({ shell: 'hosted_free_integration', managedAccess: false, fixtureStatus: 'active' }), { kind: 'free' });
  assert.deepEqual(resolvePlanPresentation({ shell: 'hosted_free_integration', managedAccess: true, fixtureStatus: 'active' }), { kind: 'free' });
});

test('private scanner public configuration parses the presentation flag strictly', () => {
  assert.equal(resolvePublicEnvironment({ privateUpcTestEnabled: 'true' }).privateUpcTestEnabled, true);
  assert.equal(resolvePublicEnvironment({ privateUpcTestEnabled: 'false' }).privateUpcTestEnabled, undefined);
  assert.throws(() => resolvePublicEnvironment({ privateUpcTestEnabled: 'yes' }));
});

test('hosted private scanner presentation requires every development-only boundary', () => {
  const privateTest = { buildFlavor: 'development' as const, remoteEnabled: true,
    supabaseUrl: hosted, developmentRuntime: true, privateUpcTestEnabled: true };
  assert.equal(resolveShellPresentation(privateTest), 'hosted_free_integration');
  for (const patch of [{ developmentRuntime: false }, { privateUpcTestEnabled: false },
    { supabaseUrl: 'https://other.supabase.co' }, { supabaseUrl: hosted + '/' },
    { supabaseUrl: hosted + '/functions/v1' },
    { buildFlavor: 'remote-staging' as const }, { buildFlavor: 'production' as const }]) {
    assert.equal(resolveShellPresentation({ ...privateTest, ...patch }), 'legacy');
  }
  assert.equal(resolveShellPresentation({ ...privateTest, remoteEnabled: false }), 'scanner_first_preview');
  assert.equal(resolveShellPresentation({ ...privateTest, developmentRuntime: false,
    scannerReleaseEnabled: true }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: hosted, privateUpcTestEnabled: true }), 'legacy',
  'a public flag alone cannot substitute for the actual development runtime');
});

test('hosted private scanner keeps permanent sign-in and owner-bound entry requirements', () => {
  const shell = resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: hosted, developmentRuntime: true, privateUpcTestEnabled: true });
  assert.equal(shell, 'hosted_free_integration');
  assert.notEqual(shell, 'local_free_integration', 'no local anonymous signup path');
  assert.equal(resolveScannerEntry({ ...ready, authStatus: 'SIGNED_OUT' }), 'auth');
  assert.equal(resolveScannerEntry({ ...ready, accessStatus: 'ERROR' }), 'error');
  assert.equal(resolveScannerEntry({ ...ready, contextOwnerId: 'owner-b' }), 'loading');
  assert.equal(resolveScannerEntry({ ...ready, hasProfile: true }), 'check');
});

const ready = { authStatus: 'SIGNED_IN' as const, ownerId: 'owner-a', accessStatus: 'READY',
  access: { userId: 'owner-a', identityKind: 'permanent' as const, freeProductAccess: true as const,
    managedMembershipStatus: 'none' as const, managedAccess: false },
  contextOwnerId: 'owner-a', contextStatus: 'ready', hasProfile: false, profileIntroHandled: false };

test('scanner entry loads real owner context before optional profile and Check', () => {
  assert.equal(resolveScannerEntry({ ...ready, authStatus: 'SIGNED_OUT' }), 'auth');
  assert.equal(resolveScannerEntry({ ...ready, contextOwnerId: 'owner-b' }), 'loading');
  assert.equal(resolveScannerEntry({ ...ready, access: { ...ready.access, userId: 'owner-b' } }), 'loading');
  assert.equal(resolveScannerEntry({ ...ready, accessStatus: 'ERROR' }), 'error');
  assert.equal(resolveScannerEntry({ ...ready, contextStatus: 'error' }), 'error');
  assert.equal(resolveScannerEntry(ready), 'profile');
  assert.equal(resolveScannerEntry({ ...ready, hasProfile: true }), 'check');
  assert.equal(resolveScannerEntry({ ...ready, profileIntroHandled: true }), 'check');
});

test('profile skip is session-only and fenced against stale owners', () => {
  const store = useScannerEntryStore.getState();
  store.setOwner('owner-a'); store.markProfileIntroHandled('owner-a');
  assert.equal(useScannerEntryStore.getState().profileIntroHandled, true);
  store.setOwner('owner-a');
  assert.equal(useScannerEntryStore.getState().profileIntroHandled, true);
  store.setOwner('owner-b'); store.markProfileIntroHandled('owner-a');
  assert.equal(useScannerEntryStore.getState().profileIntroHandled, false);
  store.setOwner(null);
});

test('restored or deep-linked editors are normalized to the real optional intro', () => {
  assert.equal(needsScannerProfileRoute(['personalize'], {}), true);
  assert.equal(needsScannerProfileRoute(['personalize'], { p0b: '1', entry: '1', mode: 'routine' }), true);
  assert.equal(needsScannerProfileRoute(['personalize'], { p0b: '1', entry: '1' }), false);
  assert.equal(needsScannerProfileRoute(['personalize'], { p0b: '1', entry: '1', mode: 'profile' }), false);
  assert.equal(needsScannerProfileRoute(['(tabs)', 'check'], {}), true);
});
