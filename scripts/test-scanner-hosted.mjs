/** Opt-in, exact-project disposable-owner drill. Never resets, seeds catalog or changes Auth. */
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROJECT = 'snojlbqovlawewwqbviz';
const URL_BASE = `https://${PROJECT}.supabase.co`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const requireFact = (ok, code) => { if (!ok) throw new Error(code); };
export function assertRunApproval(input) {
  requireFact(input?.project === PROJECT && input.approved === true, 'APPROVAL_REQUIRED');
  requireFact(/^[a-f\d]{40}$/.test(input.source ?? '') && input.actualSource === input.source
    && input.dirty === false, 'CLEAN_EXACT_SOURCE_REQUIRED');
  requireFact(/^sha256:[a-f\d]{64}$/.test(input.backupReference ?? ''), 'BACKUP_REFERENCE_REQUIRED');
}
export function assertSignupSettings(value) {
  requireFact(value?.disable_signup === false && value.mailer_autoconfirm === true
    && value.external?.email === true, 'SIGNUP_CONFIGURATION_NOT_ACCEPTED');
}
export function fixtureEmail(runId, index) {
  requireFact(UUID.test(runId) && [0, 1].includes(index), 'INVALID_FIXTURE');
  return `derive-scanner-qa-${runId}-${index}@example.invalid`;
}
export function assertCleanupOwner(owner, remoteUser, runId) {
  requireFact(UUID.test(owner?.id ?? '') && remoteUser?.id === owner.id
    && remoteUser.email === fixtureEmail(runId, owner.index), 'CLEANUP_OWNER_MISMATCH');
}

async function readBounded(response) {
  requireFact(Boolean(response.body), 'EMPTY_RESPONSE');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; requireFact(size <= 262144, 'RESPONSE_TOO_LARGE'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('INVALID_RESPONSE'); }
}

export async function runScannerHostedSmoke(input, dependencies) {
  assertRunApproval(input);
  const { publicKey, adminKey, fetch: request, writeReceipt } = dependencies;
  requireFact(typeof publicKey === 'string' && publicKey.length > 20
    && typeof adminKey === 'string' && adminKey.length > 20, 'KEYS_UNAVAILABLE');
  const runId = randomUUID(), owners = [], checks = [];
  let stage = 'settings', failed = false;
  const receipt = () => ({ scope: 'HOSTED_SYNTHETIC_OWNER_API_DRILL_NOT_RELEASE_ACCEPTANCE',
    project: PROJECT, source: input.source, backupReference: input.backupReference,
    runId, observedAt: new Date().toISOString(), stage, failed, checks: [...checks],
    remainingFixtureOwners: owners.filter(owner => !owner.deleted).map(owner => ({ id: owner.id, index: owner.index })),
    limitations: ['No catalog insert, positive product-coverage claim, image upload, email delivery, UI, native binary or physical acceptance.'] });
  const emit = () => writeReceipt(receipt());
  const call = async (path, body, token, method = 'POST') => {
    requireFact(/^\/(auth\/v1\/(settings|signup|token\?grant_type=password|admin\/users\/[a-f\d-]+)|functions\/v1\/[a-z-]+|rest\/v1\/product_resolution_cases\?id=eq\.[a-f\d-]+&select=id)$/.test(path), 'UNSAFE_PATH');
    const response = await request(`${URL_BASE}${path}`, { method,
      headers: { apikey: publicKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(20000) });
    return { status: response.status, body: await readBounded(response) };
  };
  const good = async (name, body, owner) => {
    const result = await call(`/functions/v1/${name}`, body, owner.token);
    requireFact(result.status === 200, 'FUNCTION_FAILED'); return result.body;
  };
  emit(); // Record recovery tag before any Auth write; only synthetic IDs are ever persisted.
  try {
    const settings = await call('/auth/v1/settings', undefined, undefined, 'GET');
    requireFact(settings.status === 200, 'SETTINGS_UNAVAILABLE'); assertSignupSettings(settings.body);
    stage = 'unauthenticated';
    const denied = await call('/functions/v1/access-state', {}, undefined);
    requireFact(denied.status === 401, 'UNAUTHENTICATED_NOT_DENIED'); checks.push('unauthenticated_denied');
    const manualDenied = await call('/functions/v1/personal-decision', {}, undefined);
    requireFact(manualDenied.status === 401, 'MANUAL_AUTH_NOT_DENIED'); checks.push('manual_auth_denied');
    for (let index = 0; index < 2; index++) {
      stage = `signup_${index}`;
      const email = fixtureEmail(runId, index), password = `Qa-${randomUUID()}!`;
      const signup = await call('/auth/v1/signup', { email, password }, undefined);
      requireFact(signup.status === 200 && UUID.test(signup.body?.user?.id ?? '')
        && signup.body.user.email === email, 'SIGNUP_FAILED');
      const owner = { id: signup.body.user.id, index, token: signup.body.access_token, deleted: false };
      owners.push(owner); emit();
      requireFact(typeof owner.token === 'string' && owner.token.length > 20, 'SIGNUP_SESSION_MISSING');
      const login = await call('/auth/v1/token?grant_type=password', { email, password }, undefined);
      requireFact(login.status === 200 && login.body?.user?.id === owner.id
        && typeof login.body.access_token === 'string', 'PASSWORD_LOGIN_FAILED'); owner.token = login.body.access_token;
      const access = await good('access-state', {}, owner);
      requireFact(access.userId === owner.id && access.identityKind === 'permanent'
        && access.freeProductAccess === true && access.managedAccess === false
        && access.managedMembershipStatus === 'none', 'FREE_ACCESS_MISMATCH');
    }
    checks.push('permanent_signup_password_login_free_access');
    const [first, second] = owners;
    stage = 'context';
    const context = await good('personal-context', { operation: 'get_context' }, first);
    requireFact(context.ownerId === first.id && context.profile === null && context.revision === 0, 'INITIAL_CONTEXT_MISMATCH');
    const profile = { intent: 'unanswered', primaryGoal: null, secondaryGoals: [], skinBehavior: 'unanswered', reactivity: 'unanswered',
      reproductive: { pregnancy: 'withheld', nursing: 'withheld', tryingToConceive: 'withheld' },
      sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } };
    const saveInput = { operation: 'save_profile', requestId: randomUUID(), baseRevision: context.revision, profile };
    const saved = await good('personal-context', saveInput, first);
    const replay = await good('personal-context', saveInput, first);
    requireFact(saved.revision?.ownerId === first.id && replay.revision?.id === saved.revision.id && replay.replayed === true, 'CONTEXT_REPLAY_MISMATCH');
    const forbidden = await call('/functions/v1/personal-context', { operation: 'get_revision', revisionId: saved.revision.id }, second.token);
    requireFact(forbidden.status === 404, 'CROSS_OWNER_CONTEXT_EXPOSED');
    checks.push('context_owner_revision_replay');
    stage = 'unknown_check';
    const resolution = await good('resolve-product-identity', { consumer: 'scan', requestId: randomUUID(), brand: 'Synthetic QA', productName: runId }, first);
    requireFact(UUID.test(resolution.caseId ?? '') && resolution.state === 'insufficient_evidence'
      && !resolution.product && resolution.truthSnapshot?.formula === null
      && UUID.test(resolution.truthSnapshot?.snapshotId ?? ''), 'UNKNOWN_PROMOTED');
    const decisionInput = { operation: 'evaluate', requestId: randomUUID(), caseId: resolution.caseId,
      snapshotId: resolution.truthSnapshot.snapshotId };
    const decision = await good('personal-decision', decisionInput, first);
    const decisionReplay = await good('personal-decision', decisionInput, first);
    requireFact(decision.runtime === 'authoritative' && decision.ownerId === first.id
      && decision.contextRevision === saved.revision.revision && UUID.test(decision.assessmentId ?? '')
      && decision.packet?.action?.kind === 'NOT_ENOUGH_INFORMATION'
      && decisionReplay.assessmentId === decision.assessmentId && decisionReplay.replayed === true, 'UNKNOWN_DECISION_MISMATCH');
    const foreignDecision = await call('/functions/v1/personal-decision', { ...decisionInput, requestId: randomUUID() }, second.token);
    requireFact(foreignDecision.status === 404, 'CROSS_OWNER_DECISION_EXPOSED');
    checks.push('authoritative_unknown_decision_replay_owner_isolation');
    const foreignCase = await call(`/rest/v1/product_resolution_cases?id=eq.${resolution.caseId}&select=id`, undefined, second.token, 'GET');
    requireFact(foreignCase.status === 200 && Array.isArray(foreignCase.body) && foreignCase.body.length === 0, 'CROSS_OWNER_CASE_EXPOSED');
    const foreignSave = await call('/functions/v1/free-context', { operation: 'record_check', requestId: randomUUID(), caseId: resolution.caseId }, second.token);
    requireFact(foreignSave.status === 404, 'CROSS_OWNER_CHECK_SAVED');
    const saveCheck = { operation: 'record_check', requestId: randomUUID(), caseId: resolution.caseId };
    const one = await good('free-context', saveCheck, first), two = await good('free-context', saveCheck, first);
    requireFact(UUID.test(one.check?.id ?? '') && one.check.id === two.check?.id, 'CHECK_REPLAY_MISMATCH');
    const history = await good('free-context', { operation: 'list', section: 'checks' }, first);
    const otherHistory = await good('free-context', { operation: 'list', section: 'checks' }, second);
    requireFact(history.items?.length === 1 && otherHistory.items?.length === 0, 'CHECK_HISTORY_MISMATCH');
    checks.push('unknown_abstention_explicit_history_owner_isolation');
    stage = 'link_recovery';
    const recovered = await good('resolve-product-link', { requestId: randomUUID(), url: 'https://www.amazon.com/dp/B00ABC1234' }, first);
    requireFact(recovered.status === 'needs_details' && recovered.nextAction === 'search_or_photo', 'LINK_RECOVERY_MISMATCH');
    checks.push('retailer_link_honest_recovery');
    stage = 'customer_deletion';
    for (const owner of owners) {
      const remote = await call(`/auth/v1/admin/users/${owner.id}`, undefined, adminKey, 'GET');
      requireFact(remote.status === 200, 'CLEANUP_OWNER_UNAVAILABLE'); assertCleanupOwner(owner, remote.body, runId);
      await good('delete-customer-account', { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' }, owner);
      const absent = await call(`/auth/v1/admin/users/${owner.id}`, undefined, adminKey, 'GET');
      requireFact(absent.status === 404, 'CUSTOMER_DELETION_FAILED'); owner.deleted = true; emit();
    }
    checks.push('customer_deletion'); stage = 'complete';
  } catch { failed = true; }
  finally {
    // These owners have no uploaded Storage objects. Fallback removes only users created by this run.
    for (const owner of owners.filter(value => !value.deleted)) {
      try {
        const remote = await call(`/auth/v1/admin/users/${owner.id}`, undefined, adminKey, 'GET');
        if (remote.status === 404) { owner.deleted = true; continue; }
        requireFact(remote.status === 200, 'CLEANUP_OWNER_UNAVAILABLE'); assertCleanupOwner(owner, remote.body, runId);
        const removed = await call(`/auth/v1/admin/users/${owner.id}`, undefined, adminKey, 'DELETE');
        requireFact(removed.status === 200, 'CLEANUP_FAILED'); owner.deleted = true;
      } catch { failed = true; }
    }
    emit();
  }
  return receipt();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--dry-run') {
    console.log(JSON.stringify({ status: 'NOT_RUN', project: PROJECT, creates: 'Two synthetic permanent owners',
      touches: 'Only their context/cases/history; no catalog or uploaded photos', requires: 'Separate founder approval, recoverable backup, clean exact-head green source and deployed scanner functions',
      limitations: 'No network contacted or keys loaded; not hosted acceptance.' }));
  } else {
    try {
      requireFact(args.length === 7 && args[0] === '--run-approved' && args[1] === '--source'
        && args[3] === '--backup-reference' && args[5] === '--output', 'INVALID_ARGUMENTS');
      const git = values => execFileSync('git', values, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const input = { project: PROJECT, approved: true, source: args[2], actualSource: git(['rev-parse', 'HEAD']),
        dirty: Boolean(git(['status', '--porcelain'])), backupReference: args[4] };
      assertRunApproval(input);
      // Reserve the private receipt without overwriting an existing file before loading credentials or creating users.
      writeFileSync(args[6], JSON.stringify({ status: 'RESERVED_NOT_RUN', project: PROJECT, source: input.source }), { flag: 'wx', mode: 0o600 });
      const keys = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', PROJECT, '--output', 'json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const publicKey = keys.find(row => row.name === 'anon')?.api_key;
      const adminKey = keys.find(row => row.name === 'service_role')?.api_key;
      const receipt = await runScannerHostedSmoke(input, { publicKey, adminKey, fetch,
        writeReceipt: value => writeFileSync(args[6], JSON.stringify(value, null, 2), { mode: 0o600 }) });
      console.log(JSON.stringify({ status: receipt.failed ? 'FAILED' : 'BOUNDED_HOSTED_API_PROVEN', stage: receipt.stage,
        checks: receipt.checks, cleanupComplete: receipt.remainingFixtureOwners.length === 0, receiptPath: args[6], limitations: receipt.limitations }));
      if (receipt.failed) process.exitCode = 2;
    } catch { console.error('Hosted scanner drill was not completed; no raw CLI/API error or secret is emitted. Inspect the private receipt if reserved.'); process.exitCode = 2; }
  }
}
