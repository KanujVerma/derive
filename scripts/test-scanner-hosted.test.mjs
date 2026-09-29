import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT, assertRunApproval, assertSignupSettings, fixtureEmail, assertCleanupOwner, runScannerHostedSmoke } from './test-scanner-hosted.mjs';
const sha = 'a'.repeat(40), runId = '11111111-1111-4111-8111-111111111111';
const approved = { project: PROJECT, approved: true, source: sha, actualSource: sha, dirty: false, backupReference: `sha256:${'b'.repeat(64)}` };
test('exact project, clean pinned source and backup reference are required', () => {
  assert.doesNotThrow(() => assertRunApproval(approved));
  for (const patch of [{ project: 'other' }, { approved: false }, { dirty: true }, { source: '' }, { actualSource: 'c'.repeat(40) }, { backupReference: '' }]) {
    assert.throws(() => assertRunApproval({ ...approved, ...patch }));
  }
});
test('confirmation-required or malformed signup configuration is not bypassed', () => {
  assert.doesNotThrow(() => assertSignupSettings({ disable_signup: false, mailer_autoconfirm: true, external: { email: true } }));
  for (const value of [null, {}, { disable_signup: false, mailer_autoconfirm: false, external: { email: true } }, { disable_signup: true, mailer_autoconfirm: true, external: { email: true } }]) assert.throws(() => assertSignupSettings(value));
});
test('cleanup refuses another owner, email, run, or arbitrary fixture index', () => {
  const owner = { id: runId, index: 0 }, remote = { id: runId, email: fixtureEmail(runId, 0) };
  assert.doesNotThrow(() => assertCleanupOwner(owner, remote, runId));
  for (const value of [{ ...remote, id: 'other' }, { ...remote, email: 'customer@example.com' }, { ...remote, email: fixtureEmail(runId, 1) }]) assert.throws(() => assertCleanupOwner(owner, value, runId));
  assert.throws(() => fixtureEmail('invalid', 0)); assert.throws(() => fixtureEmail(runId, 2));
});
test('failed settings stops before Auth mutation and receipts omit raw secrets/errors', async () => {
  const paths = [], receipts = [];
  const result = await runScannerHostedSmoke(approved, { publicKey: 'public-secret-marker'.repeat(2), adminKey: 'private-secret-marker'.repeat(2),
    fetch: async (url, options) => { paths.push([url, options.method]); return new Response(JSON.stringify({ disable_signup: false, mailer_autoconfirm: false, external: { email: true }, private: 'private-response-marker' }), { status: 200 }); },
    writeReceipt: value => receipts.push(value) });
  assert.equal(result.failed, true); assert.deepEqual(paths, [[`https://${PROJECT}.supabase.co/auth/v1/settings`, 'GET']]);
  assert.deepEqual(result.remainingFixtureOwners, []); assert.doesNotMatch(JSON.stringify(receipts), /secret-marker|response-marker|access_token|password/);
});

test('bounded responses and fixed-origin no-redirect requests fail before Auth mutation', async () => {
  const calls = [];
  const result = await runScannerHostedSmoke(approved, {
    publicKey: 'public-marker'.repeat(3), adminKey: 'admin-marker'.repeat(3),
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(url, `https://${PROJECT}.supabase.co/auth/v1/settings`);
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ text: 'x'.repeat(262145) }), { status: 200 });
    }, writeReceipt: () => {},
  });
  assert.equal(result.failed, true); assert.equal(calls.length, 1);
  assert.deepEqual(result.remainingFixtureOwners, []);
});

function fakeHosted({ deletionFails = false, wrongCleanupEmail = false } = {}) {
  const users = new Map(), receipts = [], paths = [];
  const ownerIds = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
  const revisionId = '44444444-4444-4444-8444-444444444444', caseId = '55555555-5555-4555-8555-555555555555';
  let saved = false, history = false, adminDeletes = 0;
  const fetch = async (url, options) => {
    const path = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : null;
    const token = options.headers.Authorization?.replace('Bearer ', '');
    const ownerId = token === 'owner-a-secret-token-marker' ? ownerIds[0] : ownerIds[1];
    paths.push([path, options.method]);
    const respond = (value, status = 200) => new Response(JSON.stringify(value), { status });
    if (path === '/auth/v1/settings') return respond({ disable_signup: false, mailer_autoconfirm: true, external: { email: true } });
    if (path === '/auth/v1/signup') {
      const id = ownerIds[users.size]; users.set(id, { id, email: body.email });
      return respond({ user: users.get(id), access_token: id === ownerIds[0] ? 'owner-a-secret-token-marker' : 'owner-b-secret-token-marker' });
    }
    if (path === '/auth/v1/token') {
      const user = [...users.values()].find(value => value.email === body.email);
      return respond({ user, access_token: user.id === ownerIds[0] ? 'owner-a-secret-token-marker' : 'owner-b-secret-token-marker' });
    }
    if (path.startsWith('/auth/v1/admin/users/')) {
      const id = path.split('/').at(-1);
      if (!users.has(id)) return respond({}, 404);
      if (options.method === 'DELETE') { adminDeletes++; users.delete(id); return respond({}); }
      return respond({ ...users.get(id), ...(wrongCleanupEmail ? { email: 'real-customer@example.com' } : {}) });
    }
    if (path === '/functions/v1/access-state') return token
      ? respond({ userId: ownerId, identityKind: 'permanent', freeProductAccess: true, managedAccess: false, managedMembershipStatus: 'none' }) : respond({}, 401);
    if (path === '/functions/v1/personal-context') {
      if (body.operation === 'get_context') return respond({ ownerId, profile: null, revision: 0 });
      if (body.operation === 'get_revision') return respond({}, 404);
      const replayed = saved; saved = true; return respond({ revision: { id: revisionId, ownerId, revision: 1 }, replayed });
    }
    if (path === '/functions/v1/resolve-product-identity') return respond({ caseId, state: 'insufficient_evidence', truthSnapshot: { formula: null, snapshotId: revisionId } });
    if (path === '/functions/v1/personal-decision') {
      if (!token) return respond({}, 401);
      if (ownerId !== ownerIds[0]) return respond({}, 404);
      return respond({ runtime: 'authoritative', ownerId, contextRevision: 1, assessmentId: revisionId,
        packet: { action: { kind: 'NOT_ENOUGH_INFORMATION' } }, replayed: true });
    }
    if (path === '/rest/v1/product_resolution_cases') return respond([]);
    if (path === '/functions/v1/free-context') {
      if (body.operation === 'record_check') {
        if (ownerId !== ownerIds[0]) return respond({}, 404);
        history = true; return respond({ check: { id: revisionId } });
      }
      return respond({ items: history && ownerId === ownerIds[0] ? [{}] : [] });
    }
    if (path === '/functions/v1/resolve-product-link') return respond({ status: 'needs_details', nextAction: 'search_or_photo' });
    if (path === '/functions/v1/delete-customer-account') {
      if (deletionFails) return respond({ privateError: 'raw-secret-error-marker' }, 503);
      users.delete(ownerId); return respond({ deleted: true });
    }
    throw new Error('Unexpected network destination');
  };
  return { dependencies: { publicKey: 'public-key-marker'.repeat(2), adminKey: 'admin-key-marker'.repeat(2), fetch, writeReceipt: value => receipts.push(value) },
    users, receipts, paths, getAdminDeletes: () => adminDeletes };
}
test('mocked full drill exercises exact owner lifecycle without storing tokens or payloads', async () => {
  const fake = fakeHosted(), result = await runScannerHostedSmoke(approved, fake.dependencies);
  assert.equal(result.failed, false); assert.equal(result.stage, 'complete'); assert.equal(result.checks.length, 8);
  assert.equal(fake.users.size, 0); assert.equal(fake.getAdminDeletes(), 0); assert.deepEqual(result.remainingFixtureOwners, []);
  assert.doesNotMatch(JSON.stringify(fake.receipts), /secret-token|key-marker|"password"|primaryGoal|pregnancy/);
});
test('failed customer deletion stays failed even after bounded fallback cleanup', async () => {
  const fake = fakeHosted({ deletionFails: true }), result = await runScannerHostedSmoke(approved, fake.dependencies);
  assert.equal(result.failed, true); assert.equal(result.stage, 'customer_deletion'); assert.equal(fake.getAdminDeletes(), 2);
  assert.equal(fake.users.size, 0); assert.ok(!result.checks.includes('customer_deletion'));
  assert.doesNotMatch(JSON.stringify(fake.receipts), /raw-secret-error-marker/);
});
test('remote cleanup mismatch never deletes a customer or widens cleanup scope', async () => {
  const fake = fakeHosted({ wrongCleanupEmail: true }), result = await runScannerHostedSmoke(approved, fake.dependencies);
  assert.equal(result.failed, true); assert.equal(fake.getAdminDeletes(), 0); assert.equal(fake.users.size, 2);
  assert.equal(result.remainingFixtureOwners.length, 2);
});
