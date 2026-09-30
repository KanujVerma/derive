#!/usr/bin/env node
/** Offline/read-only source inventory. Never enables hosted access or certifies security. */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const EXPECTED_PROJECT_REF = 'snojlbqovlawewwqbviz';

// Fixed committed-source paths only. No .env, credentials, customer files or hosted probes.
export const SOURCE_FILES = Object.freeze({
  config: 'supabase/config.toml',
  auth: 'src/services/authClient.ts',
  shell: 'src/utils/shellPresentation.ts',
  identity: 'supabase/functions/_shared/access.ts',
  access: 'supabase/functions/access-state/index.ts',
  deletion: 'supabase/functions/delete-customer-account/index.ts',
  photoGrant: 'supabase/migrations/20260924020000_s_free_4_product_evidence.sql',
  reset: 'src/services/sessionReset.ts',
});

export const HOSTED_GATES = Object.freeze([
  'exact_project_revision_and_migration_readback',
  'anonymous_signup_disabled_until_activation',
  'signup_abuse_controls_and_challenge_recovery',
  'free_endpoint_rate_limits_and_monitoring',
  'least_privilege_guest_owner_and_managed_denial',
  'same_identity_upgrade_and_existing_account_no_merge',
  'session_loss_and_account_switch_recovery',
  'storage_first_deletion_and_concurrent_write_fencing',
  'retention_policy_cleanup_dry_run_and_retry',
  'private_storage_and_provider_privacy_review',
  'privacy_safe_operational_alerts_and_rollback',
  'physical_customer_release_acceptance',
]);

async function boundedSource(readText, path) {
  try {
    const text = await readText(path);
    return typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= MAX_SOURCE_BYTES ? text : null;
  } catch { return null; }
}

// This is a deliberately narrow shape reader, not a general TOML interpreter.
function booleanSetting(text, section, key) {
  if (text === null) return null;
  let active = false;
  let found;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (header) { active = header[1] === section; continue; }
    if (/^\s*\[/.test(line)) { active = false; continue; }
    if (!active) continue;
    const assignmentKey = line.match(/^\s*([a-z_]+)\s*=/)?.[1];
    if (assignmentKey !== key) continue;
    const setting = line.match(/^\s*([a-z_]+)\s*=\s*(true|false)\s*(?:#.*)?$/);
    if (!setting) return null;
    if (found !== undefined) return null; // Duplicate/ambiguous declarations are unknown.
    found = setting[2] === 'true';
  }
  return found ?? null;
}

function sourceShape(text, required) {
  if (text === null) return 'UNKNOWN';
  return required.every((pattern) => pattern.test(text)) ? 'STATIC_PRESENT' : 'STATIC_NOT_CONFIRMED';
}

async function sourceState(cwd) {
  let head = null;
  try {
    const { stdout } = await exec('git', ['rev-parse', 'HEAD'], {
      cwd, timeout: 5000, maxBuffer: 4096, encoding: 'utf8',
    });
    head = /^[a-f\d]{40}$/i.test(stdout.trim()) ? stdout.trim().toLowerCase() : null;
  } catch { /* No raw command error is returned. */ }
  let inspectedSourcesMatchHead = null;
  try {
    await exec('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'diff', '--quiet', 'HEAD', '--', ...Object.values(SOURCE_FILES)], {
      cwd, timeout: 5000, maxBuffer: 4096, encoding: 'utf8',
    });
    inspectedSourcesMatchHead = true;
  } catch (error) {
    if (error?.code === 1) inspectedSourcesMatchHead = false;
  }
  return { head, inspectedSourcesMatchHead };
}

/** Tests may inject source reads. Neither source markers nor caller assertions prove hosted controls. */
export async function preflightHostedFreeReadiness(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const readText = options.readText ?? ((path) => readFile(resolve(cwd, path), 'utf8'));
  const entries = await Promise.all(Object.entries(SOURCE_FILES).map(async ([name, path]) =>
    [name, await boundedSource(readText, path)]));
  const sources = Object.fromEntries(entries);
  const shapes = {
    localAnonymousSignupConfigured: booleanSetting(sources.config, 'auth', 'enable_anonymous_sign_ins'),
    localDeleteGatewayJwtConfigured: booleanSetting(sources.config, 'functions.delete-customer-account', 'verify_jwt'),
    localAccessGatewayJwtConfigured: booleanSetting(sources.config, 'functions.access-state', 'verify_jwt'),
    localAuthCaptchaConfigured: booleanSetting(sources.config, 'auth.captcha', 'enabled'),
    localOnlyShellGate: sourceShape(sources.shell, [/input\.buildFlavor !== 'development'/, /return 'legacy'/, /local_free_integration/]),
    persistedSessionBeforeGuestCreation: sourceShape(sources.auth, [/ensureFreeScannerSession/, /adapter\.getSession\(\)/, /adapter\.signInAnonymously\(\)/, /existing\.data\.session !== null/]),
    guestUpgradeApiInInspectedAuthModule: sourceShape(sources.auth, [/\.(?:updateUser|linkIdentity)\(/]),
    verifiedAnonymousIdentity: sourceShape(sources.identity, [/user\.is_anonymous === true/, /user\.is_anonymous === false/, /IDENTITY_UNAVAILABLE/]),
    managedIdentitySeparation: sourceShape(sources.access, [/authenticate\(req\)/, /identityKind === "permanent" && managedMembershipStatus === "active"/]),
    ownerCacheReset: sourceShape(sources.reset, [/useFreeAccessStore\.getState\(\)\.reset\(\)/, /setSignedOut\(\)/, /clearInFlightHydrations\(\)/]),
    privatePhotoGrantResourceGuard: sourceShape(sources.photoGrant, [/pg_advisory_xact_lock/, /FREE_EVIDENCE_DAILY_LIMIT/, /interval '24 hours'\) >= 6/, /to service_role/]),
    storageFirstDeletionShape: sourceShape(sources.deletion, [/auth\.getUser\(\)/, /skinVerification\.paths\.length > 0/, /productVerification\.paths\.length > 0/, /auth\.admin\.deleteUser\(user\.id\)/]),
  };
  const state = options.readText ? { head: null, inspectedSourcesMatchHead: null } : await sourceState(cwd);
  return {
    schemaVersion: 1,
    scope: 'OFFLINE_SOURCE_INVENTORY_NOT_SECURITY_OR_RELEASE_PROOF',
    source: { ...state, inspectedFileCount: entries.length, readableFileCount: entries.filter(([, text]) => text !== null).length },
    expectedHostedProjectRef: EXPECTED_PROJECT_REF,
    localSourceShapes: shapes,
    releaseBlockers: [
      ...(shapes.localOnlyShellGate === 'STATIC_PRESENT' ? ['HOSTED_SCANNER_SHELL_STILL_LOCAL_ONLY_IN_INSPECTED_SOURCE'] : []),
      ...(shapes.guestUpgradeApiInInspectedAuthModule === 'STATIC_NOT_CONFIRMED' ? ['GUEST_UPGRADE_API_NOT_FOUND_IN_INSPECTED_AUTH_MODULE'] : []),
      'HOSTED_OPERATIONAL_AND_PHYSICAL_EVIDENCE_NOT_REVIEWED',
    ],
    limitations: {
      staticMarkersCanAppearInComments: true,
      codePresenceDoesNotProveRuntimeEnforcement: true,
      localConfigDoesNotDescribeHostedConfig: true,
      uploadGrantsAreNotCompletedCheckAllowance: true,
      existingAccountPolicy: 'KEEP_EXISTING_ACCOUNT_DO_NOT_AUTO_MERGE',
    },
    hosted: {
      inspected: false,
      gates: HOSTED_GATES.map((id) => ({ id, status: 'UNKNOWN', evidence: 'REVIEWED_EXACT_PROJECT_READBACK_REQUIRED' })),
    },
    activation: { ready: false, status: 'BLOCKED', reason: 'HOSTED_RUNTIME_AND_PHYSICAL_EVIDENCE_NOT_VERIFIED' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(`${JSON.stringify(await preflightHostedFreeReadiness(), null, 2)}\n`);
    // A successful inventory is not successful release readiness. Nonzero intentionally fails closed.
    process.exitCode = 2;
  } catch {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, activation: { ready: false, status: 'BLOCKED' } })}\n`);
    process.exitCode = 2;
  }
}
