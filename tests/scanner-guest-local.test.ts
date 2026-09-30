import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalGuestBackend, assertLocalMigrationVersions, createGuestTestStorage, assertGuestFixtureOwner, runScannerGuestLocalSmoke } from '../scripts/test-scanner-guest-local.mjs';

const local = { API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'public-fixture-key'.repeat(2), SERVICE_ROLE_KEY: 'private-fixture-key'.repeat(2) };

test('guest persistence drill rejects hosted, ambiguous and credential-bearing endpoints', () => {
  assert.doesNotThrow(() => assertLocalGuestBackend(local));
  for (const url of ['https://snojlbqovlawewwqbviz.supabase.co', 'http://localhost:54321', 'http://127.0.0.1.evil:54321',
    'https://127.0.0.1:54321', 'http://secret@127.0.0.1:54321', 'http://127.0.0.1:54321/path', 'http://127.0.0.1:54321?override=1']) {
    assert.throws(() => assertLocalGuestBackend({ ...local, API_URL: url }));
  }
});

test('local ledger must exactly match source before any guest mutation', async () => {
  assert.doesNotThrow(() => assertLocalMigrationVersions(['20260922170000', '20260929070000'], ['20260929070000', '20260922170000']));
  for (const ledger of [[], ['20260922170000'], ['20260922170000', '20260929070000', '20260930000000'], ['20260922170000', '20260922170000']]) {
    assert.throws(() => assertLocalMigrationVersions(['20260922170000', '20260929070000'], ledger));
  }
  let verified = false;
  await assert.rejects(runScannerGuestLocalSmoke({ ...local, API_URL: 'https://other.supabase.co' }, {
    verifyMigrations: async () => { verified = true; },
  }), /LOCAL_BACKEND_REQUIRED/);
  assert.equal(verified, false);
  await assert.rejects(runScannerGuestLocalSmoke(local, { verifyMigrations: async () => { throw new Error('ledger unavailable'); } }), /ledger unavailable/);
});

test('asynchronous SDK storage retains values but distinct installations do not share them', async () => {
  const first = createGuestTestStorage(), second = createGuestTestStorage();
  await first.setItem('session', 'opaque-fixture');
  assert.equal(await first.getItem('session'), 'opaque-fixture');
  assert.equal(await second.getItem('session'), null);
  await first.removeItem('session'); assert.equal(await first.getItem('session'), null);
  await first.setItem('session', 'opaque-fixture'); first.clear(); assert.equal(await first.getItem('session'), null);
});

test('cleanup requires exact created UUID, anonymous identity and private run tag', () => {
  const id = '11111111-1111-4111-8111-111111111111', runId = '22222222-2222-4222-8222-222222222222';
  const owner = { id }, user = { id, is_anonymous: true, user_metadata: { derive_guest_smoke_run: runId } };
  assert.doesNotThrow(() => assertGuestFixtureOwner(owner, user, runId));
  for (const patch of [{ id: runId }, { is_anonymous: false }, { user_metadata: {} }, { user_metadata: { derive_guest_smoke_run: 'other' } }]) {
    assert.throws(() => assertGuestFixtureOwner(owner, { ...user, ...patch }, runId));
  }
});
