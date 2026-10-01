/** Exact-local Auth/Edge privacy-gate diagnostic. No real users, saved profiles, provider calls or API keys. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.argv[2], '--local-privacy-gate');
const status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], {
  encoding: 'utf8', env: { ...process.env, DO_NOT_TRACK: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(status.DB_URL).port, '54322');
const id = 'e6000000-0000-4000-8000-000000000099', run = randomUUID();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const endpoint = status.API_URL + '/functions/v1/private-ingredient-explanation';
const body = { productName: 'Synthetic gentle cleanser', ingredientsText: 'Water, Glycerin, Fragrance',
  category: 'skincare', contextSharingConsent: true };
let created = false;
try {
  const password = randomUUID() + '!Aa9', email = `derive-explanation-${run}@example.invalid`;
  const user = await admin.auth.admin.createUser({ id, email, password, email_confirm: true,
    user_metadata: { derive_explanation_test: run } });
  assert.equal(user.error, null); created = true;
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null); assert.ok(signed.data.session?.access_token);
  const headers = { 'Content-Type': 'application/json', apikey: status.ANON_KEY,
    Authorization: `Bearer ${signed.data.session.access_token}` };
  const unauthorized = await fetch(endpoint, { method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: status.ANON_KEY }, body: JSON.stringify(body) });
  assert.equal(unauthorized.status, 401);
  for (const invalid of [{ ...body, profile: { skinBehavior: 'dry_tight' } }, { ...body, userId: id },
    { ...body, contextSharingConsent: false }]) {
    const denied = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(invalid) });
    assert.equal(denied.status, 400);
  }
  const malformed = await fetch(endpoint, { method: 'POST', headers, body: '{bad json' });
  assert.equal(malformed.status, 400);
  const blocked = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal(blocked.status, 503);
  assert.deepEqual(await blocked.json(), { status: 'personalization_disabled' });
  const profiles = await admin.from('free_skin_profiles').select('user_id', { head: true, count: 'exact' }).eq('user_id', id);
  assert.equal(profiles.error, null); assert.equal(profiles.count, 0);
  const products = await admin.from('free_saved_products').select('id', { head: true, count: 'exact' }).eq('user_id', id);
  assert.equal(products.error, null); assert.equal(products.count, 0);
  console.log('PASS: real local Auth/Edge rejects anonymous, malformed and forged-context requests; allowed synthetic tester remains privacy-disabled without profiles/products or provider usage.');
} finally {
  if (created) {
    const before = await admin.auth.admin.getUserById(id);
    assert.equal(before.data.user?.user_metadata?.derive_explanation_test, run);
    assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    assert.equal((await admin.auth.admin.getUserById(id)).error?.status, 404);
    console.log('PASS: exact tagged synthetic account removed and absence confirmed.');
  }
  client.auth.stopAutoRefresh(); admin.auth.stopAutoRefresh();
}
