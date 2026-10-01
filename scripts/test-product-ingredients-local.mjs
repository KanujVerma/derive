/** Exact-local authenticated Edge + real free-provider diagnostic. No photos/profile/model keys. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { requestProductIngredients, productIngredientKey } from '../src/presentation/external-products/productIngredients.ts';

assert.equal(process.argv[2], '--local-live-free-sources');
const status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], {
  encoding: 'utf8', env: { ...process.env, DO_NOT_TRACK: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(status.DB_URL).port, '54322');
const id = 'e6000000-0000-4000-8000-000000000099', run = randomUUID();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let created = false;
const cases = [
  { barcode: '3606000537538', name: 'CeraVe Hydrating Facial Cleanser', brand: 'CeraVe', size: null },
  { barcode: '0871760002975', name: 'Sun Bum Face50 Premium Sunscreen', brand: 'Sun Bum', size: null },
  { barcode: '0053076192650', name: 'Nizoral Anti-Dandruff Shampoo', brand: 'Nizoral', size: null },
  { barcode: '0072140005467', name: 'Nivea Creme', brand: 'Nivea', size: null },
  { barcode: '0305210231597', name: 'Vaseline Rosy Lips', brand: 'Vaseline', size: null },
  { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 oz', brand: 'Old Spice', size: 'One 3oz. Stick' },
];
try {
  const password = randomUUID() + '!Aa9', email = `derive-ingredients-${run}@example.invalid`;
  const user = await admin.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { derive_ingredients_test: run } });
  assert.equal(user.error, null); created = true;
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
  const anon = await fetch(status.API_URL + '/functions/v1/private-product-ingredients', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cases[0]),
  });
  assert.equal(anon.status, 401);
  const forbidden = await client.functions.invoke('private-product-ingredients', { body: { ...cases[0], profile: { skin: 'dry' } } });
  assert.equal(forbidden.error?.context?.status, 400);
  for (const query of cases) {
    const started = Date.now();
    const result = await requestProductIngredients(query, id, () => id + ':' + productIngredientKey(query), client);
    assert.ok(result.evidence.every(e => e.formulaVerified === false && e.canonicalProductId === null));
    assert.ok(result.evidence.every(e => !/prebiotic soda/i.test(e.productName)));
    console.log(JSON.stringify({ name: query.name, barcode: query.barcode, status: result.status, sources: result.sources,
      evidence: result.evidence.map(e => ({ source: e.source, productName: e.productName, sourceUrl: e.sourceUrl,
        characters: e.ingredientsText.length, matchBasis: e.matchBasis })), milliseconds: Date.now() - started }));
  }
  // Published-label reference probe: diagnostic name lookup, NOT a claimed barcode/package match.
  const query = { barcode: '036000291452', name: 'CeraVe AM Facial Moisturizing Lotion SPF30', brand: 'CeraVe', size: null };
  const reference = await requestProductIngredients(query, id, () => id + ':' + productIngredientKey(query), client);
  assert.equal(reference.status, 'found', 'Known public-label reference must return ingredients');
  assert.equal(reference.evidence.find(e => e.source === 'dailymed')?.matchBasis, 'name_variant');
  console.log(JSON.stringify({ diagnostic: 'DailyMed_name_only_reference_not_barcode_verification', status: reference.status,
    evidence: reference.evidence.map(e => ({ source: e.source, productName: e.productName, characters: e.ingredientsText.length })) }));
  const products = await admin.from('free_saved_products').select('id', { head: true, count: 'exact' }).eq('user_id', id);
  assert.equal(products.error, null); assert.equal(products.count, 0);
  console.log('PASS: real local Auth/Edge/budget/free sources/client parse; unauthorized and profile-input rejection; no product persistence.');
} finally {
  if (created) {
    const before = await admin.auth.admin.getUserById(id);
    assert.equal(before.data.user?.user_metadata?.derive_ingredients_test, run);
    assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    assert.equal((await admin.auth.admin.getUserById(id)).error?.status, 404);
    console.log('PASS: exact tagged synthetic account removed and absence confirmed.');
  }
  client.auth.stopAutoRefresh(); admin.auth.stopAutoRefresh();
}
