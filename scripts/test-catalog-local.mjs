/** Local HTTP/auth/search smoke for the shared catalog Edge API. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const cli = process.env.SUPABASE_CLI || 'supabase';
const status = JSON.parse(execFileSync(cli, ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
const url = status.API_URL;
assert.equal(url, 'http://127.0.0.1:54321', 'Local catalog test must not target hosted Supabase');
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const member = createClient(url, status.ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `catalog-${randomUUID()}@example.test`;
const password = `CatalogTest-${randomUUID()}!`;
let userId;
let catalogProductId;
let provisionalId;
let variantId;

try {
  const ingest = execFileSync(process.execPath, [
    '--experimental-strip-types', 'scripts/catalog-ingest.mjs',
    '--file', 'docs/catalog-seeds/cerave-renewing-sa-cleanser.json', '--local', '--apply',
  ], { encoding: 'utf8', env: { ...process.env, SUPABASE_CLI: cli }, stdio: ['ignore','pipe','pipe'] });
  const lines = ingest.trim().split('\n');
  catalogProductId = JSON.parse(lines.at(-1)).result.productId;
  assert.ok(catalogProductId);

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  const signedIn = await member.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  assert.equal(signedIn.data.user.id, userId);

  const noAuth = await fetch(`${url}/functions/v1/catalog-products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'search', query: 'CeraVe' }),
  });
  assert.equal(noAuth.status, 401);

  const found = await member.functions.invoke('catalog-products', {
    body: { operation: 'search', query: 'CeraVe SA Cleanser', limit: 10 },
  });
  assert.ifError(found.error);
  assert.equal(found.data.items[0].productId, catalogProductId);
  assert.equal(found.data.items[0].formulaState, 'unverified');
  assert.equal(found.data.items[0].isCatalogStandard, true);
  assert.equal(found.data.items[0].variantCount, 0);
  assert.ok(!JSON.stringify(found.data).includes('user_id'));
  assert.ok(!JSON.stringify(found.data).includes('full_ingredients'));

  const details = await member.functions.invoke('catalog-products', {
    body: { operation: 'detail', productId: catalogProductId },
  });
  assert.ifError(details.error);
  assert.equal(details.data.product.productId, catalogProductId);
  assert.deepEqual(details.data.product.variants, []);
  assert.equal(details.data.product.formulaState, 'unverified');
  assert.equal(details.data.product.sourceReference, 'https://www.cerave.com/skincare/cleansers/renewing-sa-cleanser');


  const addedVariant = await admin.from('product_variants').insert({
    product_id: catalogProductId, variant_name: 'Test US bottle', region_code: 'US',
  }).select('id').single();
  assert.ifError(addedVariant.error);
  variantId = addedVariant.data.id;
  const addedFormula = await admin.from('product_formula_versions').insert({
    variant_id: variantId, ingredients: ['Water', 'Glycerin'], normalized_ingredient_fingerprint: 'water|glycerin',
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/test-formula',
    observed_at: '2026-09-22T00:00:00Z', verification_status: 'verified',
  }).select('id').single();
  assert.ifError(addedFormula.error);
  const addedIdentifier = await admin.from('product_identifiers').insert({
    variant_id: variantId, formula_version_id: addedFormula.data.id,
    identifier_type: 'gtin_12', identifier_value: '036000291452',
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/test-gtin',
    observed_at: '2026-09-22T00:00:00Z', verified_at: '2026-09-22T00:00:00Z',
  });
  assert.ifError(addedIdentifier.error);
  const verifiedDetail = await member.functions.invoke('catalog-products', {
    body: { operation: 'detail', productId: catalogProductId, variantId },
  });
  assert.ifError(verifiedDetail.error);
  assert.equal(verifiedDetail.data.product.variants[0].formulaState, 'verified');
  assert.equal(verifiedDetail.data.product.formulaState, 'verified_variant_available');
  assert.deepEqual(verifiedDetail.data.product.variants[0].formula.ingredients, ['Water', 'Glycerin']);
  assert.equal(verifiedDetail.data.product.variants[0].formula.provenanceType, 'manufacturer');
  assert.equal(verifiedDetail.data.product.variants[0].formula.sourceReference, null);
  assert.equal(verifiedDetail.data.product.variants[0].sourceReference, null);

  const secondFormula = await admin.from('product_formula_versions').insert({
    variant_id: variantId, ingredients: ['Water', 'Niacinamide'], normalized_ingredient_fingerprint: 'water|niacinamide',
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/test-reformulation',
    observed_at: '2026-09-22T01:00:00Z', verification_status: 'verified',
  }).select('id').single();
  assert.ifError(secondFormula.error);
  const secondIdentifier = await admin.from('product_identifiers').insert({
    variant_id: variantId, formula_version_id: secondFormula.data.id,
    identifier_type: 'gtin_12', identifier_value: '036000291452',
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/test-reformulation-gtin',
    observed_at: '2026-09-22T01:00:00Z', verified_at: '2026-09-22T01:00:00Z',
  });
  assert.ifError(secondIdentifier.error);
  const ambiguousDetail = await member.functions.invoke('catalog-products', {
    body: { operation: 'detail', productId: catalogProductId, variantId },
  });
  assert.ifError(ambiguousDetail.error);
  assert.equal(ambiguousDetail.data.product.variants[0].formulaState, 'multiple_versions');
  assert.equal(ambiguousDetail.data.product.formulaState, 'multiple_versions');
  assert.equal(ambiguousDetail.data.product.variants[0].formula, undefined);
  const ambiguousSearch = await member.functions.invoke('catalog-products', {
    body: { operation: 'search', query: 'CeraVe SA Cleanser', limit: 10 },
  });
  assert.ifError(ambiguousSearch.error);
  assert.equal(ambiguousSearch.data.items[0].formulaState, 'multiple_versions');

  const provisional = await admin.from('products').insert({
    brand: 'Private Test', name: `Provisional ${randomUUID()}`, category: 'serum',
    is_catalog_standard: false, key_actives: [], full_ingredients: [],
  }).select('id').single();
  assert.ifError(provisional.error);
  provisionalId = provisional.data.id;
  const hidden = await member.functions.invoke('catalog-products', {
    body: { operation: 'search', query: 'Private Test', limit: 10 },
  });
  assert.ifError(hidden.error);
  assert.deepEqual(hidden.data.items, []);
  const hiddenDetail = await member.functions.invoke('catalog-products', {
    body: { operation: 'detail', productId: provisionalId },
  });
  assert.ok(hiddenDetail.error);
  assert.equal(hiddenDetail.error.context?.status, 404);

  console.log('Catalog local Auth, alias, verified and ambiguous formula detail, provisional denial: PASS');
} finally {
  if (userId) assert.ifError((await admin.auth.admin.deleteUser(userId)).error);
  if (provisionalId) assert.ifError((await admin.from('products').delete().eq('id', provisionalId)).error);
  if (catalogProductId) {
    if (variantId) {
      assert.ifError((await admin.from('product_identifiers').delete().eq('variant_id', variantId)).error);
      assert.ifError((await admin.from('product_formula_versions').delete().eq('variant_id', variantId)).error);
      assert.ifError((await admin.from('product_variants').delete().eq('id', variantId)).error);
    }
    assert.ifError((await admin.from('product_search_aliases').delete().eq('product_id', catalogProductId)).error);
    assert.ifError((await admin.from('products').delete().eq('id', catalogProductId)).error);
  }
}
