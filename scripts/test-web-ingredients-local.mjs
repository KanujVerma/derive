/** Existing exact-local Auth and live public-product diagnostic. Never resets the phone database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { requestWebProductIngredients, webProductIngredientKey } from '../src/presentation/external-products/webProductIngredients.ts';

assert.equal(process.argv[2], '--local-live-web');
const status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(status.DB_URL).port, '54322');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = 'e6000000-0000-4000-8000-000000000099';
const run = randomUUID(); const created = [];
const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 oz',
  brand: 'Old Spice', size: 'One 3oz. Stick' };
const endpoint = status.API_URL + '/functions/v1/private-web-product-ingredients';
try {
  for (const id of [owner, randomUUID()]) {
    const email = `derive-web-${id}-${run}@example.invalid`; const password = randomUUID() + '!Aa9';
    const user = await admin.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { derive_web_smoke: run } });
    assert.equal(user.error, null); created.push(id);
    assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
    if (id !== owner) {
      const denied = await client.functions.invoke('private-web-product-ingredients', { body: query });
      assert.equal(denied.error?.context?.status, 403);
    } else {
      const invalid = await client.functions.invoke('private-web-product-ingredients', { body: { ...query, profile: {} } });
      assert.equal(invalid.error?.context?.status, 400);
      const started = Date.now();
      const result = await requestWebProductIngredients(query, owner, () => owner + ':' + webProductIngredientKey(query), client);
      console.log(JSON.stringify({ diagnostic: 'real_web_ingredient_lookup', status: result.status, milliseconds: Date.now() - started,
        evidence: result.status === 'found' ? result.evidence : undefined }));
      if (result.status === 'found') assert.equal(result.evidence.formulaVerified, false);
    }
  }
  const anonymous = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: status.ANON_KEY },
    body: JSON.stringify(query) });
  assert.equal(anonymous.status, 401);
  const saved = await admin.from('free_saved_products').select('id', { head: true, count: 'exact' }).eq('user_id', owner);
  assert.equal(saved.error, null); assert.equal(saved.count, 0);
  console.log('PASS local Auth, exact tester fence, forged context rejection and client response validation. Ingredient coverage is reported separately.');
} finally {
  for (const id of created) {
    const existing = await admin.auth.admin.getUserById(id);
    assert.equal(existing.data.user?.user_metadata?.derive_web_smoke, run);
    assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    assert.equal((await admin.auth.admin.getUserById(id)).error?.status, 404);
  }
  client.auth.stopAutoRefresh(); admin.auth.stopAutoRefresh();
  console.log('Removed the exact tagged synthetic users. Existing phone data was unchanged.');
}
