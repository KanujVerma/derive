/** Opt-in local SDK/Edge persistence drill. Never resets a database or changes Auth settings. */
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { createPasswordAccount, ensureFreeScannerSession, resetAuthAdapter, setAuthAdapter, signInWithPassword } from '../src/services/authClient.ts';
import { deleteCurrentAccount } from '../src/services/accountDeletion.ts';
import { resetCustomerSessionData } from '../src/services/sessionReset.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const requireFact = (ok, code) => { if (!ok) throw new Error(code); };
const SAFE_FAILURE_CODES = new Set([
  'LOCAL_BACKEND_REQUIRED', 'LOCAL_KEYS_REQUIRED', 'MIGRATION_READBACK_REQUIRED',
  'LOCAL_MIGRATIONS_MUST_MATCH_SOURCE', 'LOCAL_PROJECT_CONFIG_REQUIRED',
  'LOCAL_EDGE_ACCESS_STATE_FAILED', 'LOCAL_EDGE_PERSONAL_CONTEXT_FAILED',
  'LOCAL_EDGE_RESOLVE_PRODUCT_IDENTITY_FAILED', 'LOCAL_EDGE_FREE_CONTEXT_FAILED',
  'GUEST_ACCESS_MISMATCH', 'GUEST_MANAGED_SHORTCUT_NOT_DENIED',
  'INITIAL_CONTEXT_MISMATCH', 'PROFILE_SAVE_FAILED', 'UNKNOWN_FIXTURE_MISMATCH', 'CHECK_HISTORY_SAVE_FAILED',
  'RESTART_CREATED_ANOTHER_OWNER', 'CLOUD_PROFILE_NOT_RELOADED', 'CLOUD_HISTORY_NOT_RELOADED',
  'GUEST_REPLACEMENT_GUARD_FAILED', 'GUARD_REPLACED_OWNER', 'SEPARATE_INSTALL_SHARED_OWNER',
  'FOREIGN_PROFILE_REVISION_EXPOSED', 'FOREIGN_CONTEXT_EXPOSED', 'FOREIGN_CHECK_RECORDED',
  'CUSTOMER_DELETION_FAILED', 'DELETED_OWNER_REMAINS', 'DELETION_RETAINS_SESSION', 'DELETED_PROFILE_REMAINS',
  'STORAGE_RESET_REUSES_OWNER', 'STORAGE_RESET_RECOVERS_OLD_DATA', 'FIXTURE_CLEANUP_FAILED',
  'FIXTURE_OWNER_READBACK_FAILED', 'FIXTURE_CLEANUP_OWNER_MISMATCH', 'FIXTURE_CLEANUP_UNCONFIRMED',
]);

export function assertLocalGuestBackend(status) {
  let url;
  try { url = new URL(status?.API_URL); } catch { throw new Error('LOCAL_BACKEND_REQUIRED'); }
  requireFact(url.protocol === 'http:' && url.hostname === '127.0.0.1'
    && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
    && Boolean(url.port), 'LOCAL_BACKEND_REQUIRED');
  requireFact(typeof status.ANON_KEY === 'string' && status.ANON_KEY.length > 20
    && typeof status.SERVICE_ROLE_KEY === 'string' && status.SERVICE_ROLE_KEY.length > 20, 'LOCAL_KEYS_REQUIRED');
}

export function assertLocalMigrationVersions(sourceVersions, databaseVersions) {
  requireFact(Array.isArray(sourceVersions) && sourceVersions.length > 0
    && Array.isArray(databaseVersions) && sourceVersions.every(value => /^\d+$/.test(value))
    && databaseVersions.every(value => /^\d+$/.test(value)), 'MIGRATION_READBACK_REQUIRED');
  requireFact(new Set(sourceVersions).size === sourceVersions.length
    && new Set(databaseVersions).size === databaseVersions.length
    && JSON.stringify([...sourceVersions].sort()) === JSON.stringify([...databaseVersions].sort()),
  'LOCAL_MIGRATIONS_MUST_MATCH_SOURCE');
}

/** Async storage survives reconstruction of the SDK client, not physical device loss. */
export function createGuestTestStorage() {
  const values = new Map();
  return { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
    clear: () => values.clear() };
}

export function assertGuestFixtureOwner(owner, remoteUser, runId) {
  requireFact(UUID.test(owner?.id ?? '') && remoteUser?.id === owner.id
    && remoteUser.is_anonymous === true
    && remoteUser.user_metadata?.derive_guest_smoke_run === runId, 'FIXTURE_CLEANUP_OWNER_MISMATCH');
}

export async function runScannerGuestLocalSmoke(status, { verifyMigrations }) {
  assertLocalGuestBackend(status);
  requireFact(typeof verifyMigrations === 'function', 'MIGRATION_READBACK_REQUIRED');
  await verifyMigrations(); // Refuse mutations until the actual local ledger matches this source.
  const runId = randomUUID(), owners = [], clients = [], checks = [];
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const makeClient = storage => {
    const client = createClient(status.API_URL, status.ANON_KEY, { auth: {
      storage, storageKey: 'derive-guest-sdk-drill', autoRefreshToken: false, persistSession: true,
      detectSessionInUrl: false } });
    clients.push(client); return client;
  };
  const adapterFor = client => ({
    signInWithOtp: input => client.auth.signInWithOtp(input),
    verifyOtp: (email, token) => client.auth.verifyOtp({ email, token, type: 'email' }),
    getSession: () => client.auth.getSession(),
    signInAnonymously: async () => {
      const result = await client.auth.signInAnonymously({ options: { data: { derive_guest_smoke_run: runId } } });
      if (UUID.test(result.data?.user?.id ?? '')) owners.push({ id: result.data.user.id, client, deleted: false });
      return result;
    },
    signUp: input => client.auth.signUp(input),
    signInWithPassword: input => client.auth.signInWithPassword(input),
    signOut: options => client.auth.signOut(options),
    onAuthStateChange: callback => client.auth.onAuthStateChange(callback),
  });
  const call = async (client, name, body) => {
    const response = await client.functions.invoke(name, { body });
    return { data: response.data, status: response.error?.context?.status ?? (response.error ? 500 : 200) };
  };
  const good = async (client, name, body) => {
    const result = await call(client, name, body);
    if (result.status !== 200) {
      const failure = new Error(`LOCAL_EDGE_${name.toUpperCase().replaceAll('-', '_')}_FAILED`);
      failure.httpStatus = result.status;
      throw failure;
    }
    return result.data;
  };
  const bootstrap = async client => {
    setAuthAdapter(adapterFor(client));
    return ensureFreeScannerSession('hosted_free_integration');
  };
  const verifyOwner = async owner => {
    const remote = await admin.auth.admin.getUserById(owner.id);
    if (remote.error?.status === 404) return false;
    requireFact(!remote.error, 'FIXTURE_OWNER_READBACK_FAILED');
    assertGuestFixtureOwner(owner, remote.data.user, runId); return true;
  };
  try {
    const storage = createGuestTestStorage(), first = makeClient(storage);
    const firstId = await bootstrap(first);
    const access = await good(first, 'access-state', {});
    requireFact(access.userId === firstId && access.identityKind === 'anonymous'
      && access.freeProductAccess === true && access.managedAccess === false
      && access.managedMembershipStatus === 'none', 'GUEST_ACCESS_MISMATCH');
    const managedClaim = await first.rpc('claim_external_beta_access');
    requireFact(Boolean(managedClaim.error), 'GUEST_MANAGED_SHORTCUT_NOT_DENIED');
    checks.push('anonymous_owner_free_access_managed_denial');

    const context = await good(first, 'personal-context', { operation: 'get_context' });
    requireFact(context.ownerId === firstId && context.profile === null && context.revision === 0, 'INITIAL_CONTEXT_MISMATCH');
    const profile = { intent: 'unanswered', primaryGoal: null, secondaryGoals: [], skinBehavior: 'unanswered', reactivity: 'unanswered',
      reproductive: { pregnancy: 'withheld', nursing: 'withheld', tryingToConceive: 'withheld' },
      sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } };
    const saved = await good(first, 'personal-context', { operation: 'save_profile', requestId: randomUUID(), baseRevision: 0, profile });
    requireFact(saved.revision?.ownerId === firstId && UUID.test(saved.revision?.id ?? ''), 'PROFILE_SAVE_FAILED');
    const resolved = await good(first, 'resolve-product-identity', { consumer: 'scan', requestId: randomUUID(), brand: 'Synthetic guest QA', productName: runId });
    requireFact(UUID.test(resolved.caseId ?? '') && resolved.state === 'insufficient_evidence', 'UNKNOWN_FIXTURE_MISMATCH');
    const recorded = await good(first, 'free-context', { operation: 'record_check', requestId: randomUUID(), caseId: resolved.caseId });
    requireFact(UUID.test(recorded.check?.id ?? ''), 'CHECK_HISTORY_SAVE_FAILED');

    // Simulate a fresh app process: discard app projections, retain only the SDK storage.
    resetCustomerSessionData();
    const restarted = makeClient(storage);
    requireFact(await bootstrap(restarted) === firstId && owners.length === 1, 'RESTART_CREATED_ANOTHER_OWNER');
    const reloaded = await good(restarted, 'personal-context', { operation: 'get_context' });
    requireFact(reloaded.ownerId === firstId && reloaded.profile?.id === saved.revision.id
      && isDeepStrictEqual(reloaded.profile.data, profile), 'CLOUD_PROFILE_NOT_RELOADED');
    const history = await good(restarted, 'free-context', { operation: 'list', section: 'checks' });
    requireFact(history.items?.length === 1 && history.items[0].id === recorded.check.id, 'CLOUD_HISTORY_NOT_RELOADED');
    checks.push('sdk_reconstruction_retains_uuid_cloud_profile_and_history');

    const replacement = await signInWithPassword('derive-guest-qa@example.invalid', 'unused-secret');
    const signup = await createPasswordAccount({ firstName: 'Guest', lastName: 'QA', email: 'derive-guest-qa@example.invalid', password: 'Unused-qa-password-92!' });
    requireFact(replacement.code === 'GUEST_SESSION_ACTIVE' && signup.code === 'GUEST_UPGRADE_REQUIRED', 'GUEST_REPLACEMENT_GUARD_FAILED');
    requireFact((await restarted.auth.getSession()).data.session?.user.id === firstId, 'GUARD_REPLACED_OWNER');
    checks.push('ordinary_account_replacement_preserves_guest');

    const other = makeClient(createGuestTestStorage()), otherId = await bootstrap(other);
    requireFact(otherId !== firstId, 'SEPARATE_INSTALL_SHARED_OWNER');
    requireFact((await call(other, 'personal-context', { operation: 'get_revision', revisionId: saved.revision.id })).status === 404,
      'FOREIGN_PROFILE_REVISION_EXPOSED');
    const otherContext = await good(other, 'personal-context', { operation: 'get_context' });
    const otherHistory = await good(other, 'free-context', { operation: 'list', section: 'checks' });
    requireFact(otherContext.ownerId === otherId && otherContext.profile === null && otherHistory.items?.length === 0, 'FOREIGN_CONTEXT_EXPOSED');
    requireFact((await call(other, 'free-context', { operation: 'record_check', requestId: randomUUID(), caseId: resolved.caseId })).status === 404,
      'FOREIGN_CHECK_RECORDED');
    checks.push('separate_guest_owner_revision_and_history_isolation');

    setAuthAdapter(adapterFor(restarted));
    requireFact((await deleteCurrentAccount(restarted)).success === true, 'CUSTOMER_DELETION_FAILED');
    const firstOwner = owners.find(owner => owner.id === firstId);
    requireFact(firstOwner && !(await verifyOwner(firstOwner)), 'DELETED_OWNER_REMAINS'); firstOwner.deleted = true;
    requireFact((await restarted.auth.getSession()).data.session === null, 'DELETION_RETAINS_SESSION');
    const absent = await admin.from('personal_context_revisions').select('id').eq('user_id', firstId);
    requireFact(!absent.error && absent.data.length === 0, 'DELETED_PROFILE_REMAINS');
    checks.push('customer_deletion_clears_cloud_data_and_device_session');

    storage.clear(); resetCustomerSessionData();
    const resetInstall = makeClient(storage), resetId = await bootstrap(resetInstall);
    requireFact(resetId !== firstId && resetId !== otherId, 'STORAGE_RESET_REUSES_OWNER');
    const empty = await good(resetInstall, 'personal-context', { operation: 'get_context' });
    const emptyHistory = await good(resetInstall, 'free-context', { operation: 'list', section: 'checks' });
    requireFact(empty.ownerId === resetId && empty.profile === null && empty.revision === 0 && emptyHistory.items.length === 0,
      'STORAGE_RESET_RECOVERS_OLD_DATA');
    checks.push('reset_storage_creates_distinct_empty_owner');
  } finally {
    let cleanupFailed = false;
    for (const owner of owners.filter(value => !value.deleted)) {
      try {
        if (!(await verifyOwner(owner))) { owner.deleted = true; continue; }
        // No files are uploaded by this drill. Attempt normal customer deletion first.
        const deleted = await deleteCurrentAccount(owner.client);
        if (!deleted.success) {
          await verifyOwner(owner);
          const fallback = await admin.auth.admin.deleteUser(owner.id);
          requireFact(!fallback.error, 'FIXTURE_CLEANUP_FAILED');
        }
        requireFact(!(await verifyOwner(owner)), 'FIXTURE_CLEANUP_UNCONFIRMED'); owner.deleted = true;
      } catch { cleanupFailed = true; }
    }
    for (const client of clients) client.auth.stopAutoRefresh();
    resetAuthAdapter(); resetCustomerSessionData();
    requireFact(!cleanupFailed, 'FIXTURE_CLEANUP_FAILED');
  }
  return { scope: 'LOCAL_REAL_SDK_AND_EDGE_GUEST_PERSISTENCE_NOT_PHYSICAL_OR_HOSTED_ACCEPTANCE',
    passed: true, checks, fixtureOwnersCreated: owners.length, cleanupComplete: owners.every(owner => owner.deleted),
    limitations: ['Memory-backed asynchronous SDK storage models a restart; it does not prove iPhone AsyncStorage.',
      'No hosted Auth activation, CAPTCHA, refresh-expiry, photos, account linking or positive catalog coverage tested.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--run-local') {
    console.log(JSON.stringify({ passed: false, code: 'EXPLICIT_LOCAL_RUN_REQUIRED' })); process.exitCode = 2;
  } else {
    try {
      const workdir = resolve(process.env.SCANNER_GUEST_LOCAL_WORKDIR ?? ROOT);
      const status = JSON.parse(execFileSync(process.env.SUPABASE_CLI ?? 'supabase', ['status', '--workdir', workdir, '-o', 'json'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const verifyMigrations = async () => {
        const projectId = readFileSync(resolve(workdir, 'supabase/config.toml'), 'utf8').match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
        requireFact(Boolean(projectId), 'LOCAL_PROJECT_CONFIG_REQUIRED');
        const source = readdirSync(resolve(ROOT, 'supabase/migrations')).filter(name => /^\d+_.+\.sql$/.test(name)).map(name => name.split('_')[0]);
        const ledger = execFileSync('docker', ['exec', `supabase_db_${projectId}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
          'select version from supabase_migrations.schema_migrations order by version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        assertLocalMigrationVersions(source, ledger.trim().split(/\r?\n/).filter(Boolean));
      };
      console.log(JSON.stringify(await runScannerGuestLocalSmoke(status, { verifyMigrations })));
    } catch (error) {
      // Do not serialize SDK errors, CLI status, keys, tokens or sensitive profile payloads.
      const known = SAFE_FAILURE_CODES.has(error?.message);
      console.log(JSON.stringify({ passed: false, code: known ? error.message : 'LOCAL_GUEST_DRILL_FAILED_NO_RAW_ERRORS',
        ...(known && Number.isInteger(error.httpStatus) && error.httpStatus >= 100 && error.httpStatus <= 599
          ? { httpStatus: error.httpStatus } : {}) })); process.exitCode = 1;
    }
  }
}
