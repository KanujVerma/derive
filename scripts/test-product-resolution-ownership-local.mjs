/** Disposable local-only regression: service-role resolver reads cannot expose another member's provisional product. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.match(status.API_URL, /^http:\/\/127\.0\.0\.1:\d+$/, 'Refuse hosted target');
const make = (key) => createClient(status.API_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = make(status.SERVICE_ROLE_KEY);
const first = make(status.ANON_KEY);
const second = make(status.ANON_KEY);
const users = [];
const products = [];
const variants = [];
const runId = randomUUID();
const now = new Date().toISOString();

try {
  for (const [index, client] of [first, second].entries()) {
    const email = `resolution-owner-${index}-${runId}@example.test`;
    const password = `OwnerTest-${randomUUID()}!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    users.push(created.data.user.id);
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    assert.ifError((await admin.from('memberships').insert({
      user_id: created.data.user.id, tier: 'founding_beta', status: 'active',
    })).error);
    const product = await admin.from('products').insert({
      brand: index === 0 ? 'Private Resolution Lab' : 'Private-Resolution Lab',
      name: `Owner Serum ${runId}`, category: 'serum',
      is_catalog_standard: false,
    }).select('id').single();
    assert.ifError(product.error);
    products.push(product.data.id);
    assert.ifError((await admin.from('user_products').insert({
      user_id: created.data.user.id, product_id: product.data.id, action: 'KEEP',
    })).error);
    const variant = await admin.from('product_variants').insert({
      product_id: product.data.id, variant_name: 'US Bottle', region_code: 'US',
    }).select('id').single();
    assert.ifError(variant.error);
    variants.push(variant.data.id);
    assert.ifError((await admin.from('product_identifiers').insert({
      variant_id: variant.data.id, identifier_type: 'gtin_12', identifier_value: '012345678905',
      source_authority: 'manufacturer', source_reference: `internal://owner-${index}`,
      observed_at: now, verified_at: now,
    })).error);
  }

  assert.deepEqual((await first.from('products').select('id').eq('id', products[1])).data, [],
    'Data API denies direct cross-owner product reads');
  const common = { consumer: 'scan', brand: 'Private Resolution Lab',
    productName: `Owner Serum ${runId}`, variantName: 'US Bottle', regionCode: 'US' };
  const typedRequest = { ...common, requestId: randomUUID() };
  const typed = await first.functions.invoke('resolve-product-identity', { body: typedRequest });
  assert.ifError(typed.error);
  assert.equal(typed.data.state, 'identified_formula_unverified');
  assert.equal(typed.data.product.productId, products[0]);
  assert.deepEqual(typed.data.candidates.map((candidate) => candidate.productId), [products[0]]);

  const barcode = await first.functions.invoke('resolve-product-identity', {
    body: { requestId: randomUUID(), consumer: 'scan', barcode: '012345678905' },
  });
  assert.ifError(barcode.error);
  assert.equal(barcode.data.state, 'identified_formula_unverified');
  assert.deepEqual(barcode.data.candidates.map((candidate) => candidate.productId), [products[0]]);

  const label = await first.functions.invoke('resolve-product-identity', {
    body: { requestId: randomUUID(), consumer: 'scan', labelText: `Private Resolution Lab Owner Serum ${runId}` },
  });
  assert.ifError(label.error);
  assert.equal(label.data.state, 'ambiguous_candidates');
  assert.ok(label.data.candidates.length > 0);
  assert.deepEqual([...new Set(label.data.candidates.map((candidate) => candidate.productId))], [products[0]]);

  const replay = await first.functions.invoke('resolve-product-identity', { body: typedRequest });
  assert.ifError(replay.error);
  assert.deepEqual(replay.data.truthSnapshot, typed.data.truthSnapshot);
  assert.deepEqual(replay.data.candidates.map((candidate) => candidate.productId), [products[0]]);
  assert.equal(replay.data.candidates[0].brand, 'Private Resolution Lab');

  const other = await second.functions.invoke('resolve-product-identity', { body: typedRequest });
  assert.ifError(other.error);
  assert.equal(other.data.product.productId, products[1]);
  assert.notEqual(other.data.caseId, typed.data.caseId);
  console.log('Product resolution owner isolation: typed, barcode, label, replay, cross-account cases PASS');
} finally {
  for (const userId of users) await admin.auth.admin.deleteUser(userId);
  for (const variantId of variants) await admin.from('product_identifiers').delete().eq('variant_id', variantId);
  for (const variantId of variants) await admin.from('product_variants').delete().eq('id', variantId);
  for (const productId of products) await admin.from('products').delete().eq('id', productId);
}
