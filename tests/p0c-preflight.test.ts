import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { EXPECTED_PROJECT_REF, HOSTED_GATES, SOURCE_FILES, preflightHostedFreeReadiness } from '../scripts/preflight-hosted-free-readiness.mjs';

const PRIVATE = 'PRIVATE_CUSTOMER_OR_CREDENTIAL_NEVER_OUTPUT';
const fixtures: Record<string, string> = {
  [SOURCE_FILES.config]: '[auth]\nenable_anonymous_sign_ins = true\n[functions.delete-customer-account]\nverify_jwt = true\n[functions.access-state]\nverify_jwt = true\n',
  [SOURCE_FILES.auth]: 'ensureLocalAnonymousSession activeAdapter.getSession() activeAdapter.signInAnonymously()',
  [SOURCE_FILES.shell]: "input.buildFlavor !== 'development'; return 'legacy'; local_free_integration",
  [SOURCE_FILES.identity]: 'user.is_anonymous === true; user.is_anonymous === false; IDENTITY_UNAVAILABLE',
  [SOURCE_FILES.access]: 'authenticate(req); identityKind === "permanent" && managedMembershipStatus === "active"',
  [SOURCE_FILES.deletion]: 'auth.getUser(); skinVerification.paths.length > 0; productVerification.paths.length > 0; auth.admin.deleteUser(user.id)',
  [SOURCE_FILES.photoGrant]: "pg_advisory_xact_lock FREE_EVIDENCE_DAILY_LIMIT interval '24 hours') >= 6 to service_role",
  [SOURCE_FILES.reset]: 'useFreeAccessStore.getState().reset(); setSignedOut(); clearInFlightHydrations()',
};

function reader(overrides: Record<string, string> = {}) {
  return async (path: string) => {
    const text = { ...fixtures, ...overrides }[path];
    if (text === undefined) throw new Error(PRIVATE);
    return `${text}\n# ${PRIVATE}`;
  };
}

test('all present source markers still leave every hosted gate unknown and activation blocked', async () => {
  const result = await preflightHostedFreeReadiness({ readText: reader() });
  assert.equal(result.expectedHostedProjectRef, EXPECTED_PROJECT_REF);
  assert.equal(result.source.readableFileCount, 8);
  assert.equal(result.source.head, null);
  assert.equal(result.source.inspectedSourcesMatchHead, null);
  assert.equal(result.localSourceShapes.privatePhotoGrantResourceGuard, 'STATIC_PRESENT');
  assert.equal(result.localSourceShapes.storageFirstDeletionShape, 'STATIC_PRESENT');
  assert.equal(result.hosted.inspected, false);
  assert.deepEqual(result.hosted.gates.map((gate: { id: string }) => gate.id), [...HOSTED_GATES]);
  assert(result.hosted.gates.every((gate: { status: string }) => gate.status === 'UNKNOWN'));
  assert.equal(result.activation.ready, false);
  assert.equal(result.activation.status, 'BLOCKED');
  assert(result.releaseBlockers.includes('GUEST_UPGRADE_API_NOT_FOUND_IN_INSPECTED_AUTH_MODULE'));
  assert.equal(result.limitations.uploadGrantsAreNotCompletedCheckAllowance, true);
  assert.equal(result.limitations.existingAccountPolicy, 'KEEP_EXISTING_ACCOUNT_DO_NOT_AUTO_MERGE');
});

test('no environment, raw source, customer text, error or credential value enters the result', async () => {
  const result = await preflightHostedFreeReadiness({ readText: reader() });
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
  const failed = await preflightHostedFreeReadiness({ readText: async () => { throw new Error(PRIVATE); } });
  assert.equal(JSON.stringify(failed).includes(PRIVATE), false);
  assert.equal(failed.source.readableFileCount, 0);
  assert.equal(failed.localSourceShapes.storageFirstDeletionShape, 'UNKNOWN');
  assert.equal(failed.localSourceShapes.localAnonymousSignupConfigured, null);
  assert.equal(failed.activation.ready, false);
});

test('changed or incomplete code markers become not confirmed, never a hosted pass', async () => {
  const result = await preflightHostedFreeReadiness({ readText: reader({
    [SOURCE_FILES.shell]: "return 'local_free_integration';",
    [SOURCE_FILES.deletion]: 'auth.admin.deleteUser(user.id)',
    [SOURCE_FILES.photoGrant]: 'FREE_EVIDENCE_DAILY_LIMIT',
  }) });
  assert.equal(result.localSourceShapes.localOnlyShellGate, 'STATIC_NOT_CONFIRMED');
  assert.equal(result.localSourceShapes.storageFirstDeletionShape, 'STATIC_NOT_CONFIRMED');
  assert.equal(result.localSourceShapes.privatePhotoGrantResourceGuard, 'STATIC_NOT_CONFIRMED');
  assert.equal(result.activation.ready, false);
});

test('config shape differentiates false, missing, commented and ambiguous declarations', async () => {
  const falseResult = await preflightHostedFreeReadiness({ readText: reader({ [SOURCE_FILES.config]: '[auth]\nenable_anonymous_sign_ins = false # local\n' }) });
  assert.equal(falseResult.localSourceShapes.localAnonymousSignupConfigured, false);
  const unknownConfigs = [
    '[auth]\n# enable_anonymous_sign_ins = true\n',
    '[auth.email]\nenable_anonymous_sign_ins = true\n',
    '[auth]\nenable_anonymous_sign_ins = "true"\n',
    '[auth]\nenable_anonymous_sign_ins = true\nenable_anonymous_sign_ins = false\n',
    '[auth]\nenable_anonymous_sign_ins = true\nenable_anonymous_sign_ins = "false"\n',
  ];
  for (const config of unknownConfigs) {
    const result = await preflightHostedFreeReadiness({ readText: reader({ [SOURCE_FILES.config]: config }) });
    assert.equal(result.localSourceShapes.localAnonymousSignupConfigured, null);
    assert.equal(result.activation.ready, false);
  }
});

test('oversized source fails closed and the inventory reads only its fixed committed paths', async () => {
  const paths: string[] = [];
  const result = await preflightHostedFreeReadiness({ readText: async (path: string) => {
    paths.push(path);
    return path === SOURCE_FILES.auth ? 'x'.repeat(2 * 1024 * 1024 + 1) : fixtures[path];
  } });
  assert.deepEqual(paths, Object.values(SOURCE_FILES));
  assert.equal(result.source.readableFileCount, 7);
  assert.equal(result.localSourceShapes.persistedSessionBeforeGuestCreation, 'UNKNOWN');
  const script = readFileSync(new URL('../scripts/preflight-hosted-free-readiness.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\bfetch\s*\(|\bwriteFile\b|\bprocess\.env\b|\bshell\s*:\s*(?:true|false)/);
  assert.doesNotMatch(Object.values(SOURCE_FILES).join(' '), /\.env|keychain|credentials/i);
});

test('real committed source has expected static shapes but cannot certify hosted release', async () => {
  const result = await preflightHostedFreeReadiness({ cwd: new URL('..', import.meta.url).pathname });
  assert.equal(result.source.inspectedSourcesMatchHead, true);
  assert.equal(result.localSourceShapes.localAnonymousSignupConfigured, true);
  assert.equal(result.localSourceShapes.localDeleteGatewayJwtConfigured, true);
  assert.equal(result.localSourceShapes.privatePhotoGrantResourceGuard, 'STATIC_PRESENT');
  assert.equal(result.localSourceShapes.storageFirstDeletionShape, 'STATIC_PRESENT');
  assert.equal(result.localSourceShapes.localAuthCaptchaConfigured, null);
  assert(result.releaseBlockers.includes('HOSTED_SCANNER_SHELL_STILL_LOCAL_ONLY_IN_INSPECTED_SOURCE'));
  assert.equal(result.activation.ready, false);
});

test('CLI returns safe inventory and intentional nonzero blocked readiness without credentials', () => {
  const result = spawnSync(process.execPath, ['scripts/preflight-hosted-free-readiness.mjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: PRIVATE, EXPO_PUBLIC_SUPABASE_URL: PRIVATE },
  });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.activation.ready, false);
  assert.equal(result.stdout.includes(PRIVATE), false);
});
