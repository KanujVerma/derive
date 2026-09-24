/** S-FREE-2 local Auth/Edge/catalog smoke. Refuses hosted Supabase. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local Supabase');
const makeClient = (key) => createClient(status.API_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = makeClient(status.SERVICE_ROLE_KEY);
const first = makeClient(status.ANON_KEY);
const second = makeClient(status.ANON_KEY);
let firstId, secondId, productId, variantId, formulaId, identifierId, secondFormulaId, secondIdentifierId;
let retinylVariantId, retinylFormulaId, retinylIdentifierId;
const invoke = async (client, body) => {
  const { data, error } = await client.functions.invoke('free-personal-fit', { body });
  return { data, error, status: error?.context?.status ?? 200 };
};
const profile = {
  goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'unsure',
  pregnancyStatus: 'no', sensitivitiesStatus: 'unanswered', knownSensitivities: [],
  treatmentStatus: 'unanswered', currentTreatments: [],
};

try {
  const a = await first.auth.signInAnonymously();
  const b = await second.auth.signInAnonymously();
  assert.ifError(a.error); assert.ifError(b.error);
  firstId = a.data.user.id; secondId = b.data.user.id;
  assert.equal((await invoke(first, { operation: 'get_profile' })).data.profile, null);
  const saved = await invoke(first, { operation: 'save_profile', profile });
  assert.ifError(saved.error);
  assert.equal(saved.data.profile.pregnancyStatus, 'no');
  assert.equal((await invoke(second, { operation: 'get_profile' })).data.profile, null);
  assert.equal((await first.from('free_skin_profiles').select('*')).error?.code, '42501');
  assert.deepEqual((await admin.from('skin_profiles').select('id').eq('user_id', firstId)).data, []);
  assert.deepEqual((await admin.from('memberships').select('id').eq('user_id', firstId)).data, []);
  assert.equal((await invoke(first, { operation: 'save_profile', profile: {
    ...profile, pregnancyStatus: 'maybe',
  } })).status, 400);

  const now = new Date().toISOString();
  const product = await admin.from('products').insert({
    brand: 'SFree2', name: `Verified moisturizer ${randomUUID()}`, category: 'moisturizer',
    is_catalog_standard: true, catalog_source_reference: 'https://manufacturer.example/fit',
    catalog_public_source_url: 'https://manufacturer.example/fit',
    catalog_observed_at: now, catalog_verified_at: now,
  }).select('id').single();
  assert.ifError(product.error); productId = product.data.id;
  const variant = await admin.from('product_variants').insert({
    product_id: productId, variant_name: 'Test formula', lifecycle_status: 'active',
    catalog_verification_status: 'verified', catalog_source_reference: 'https://manufacturer.example/fit',
    catalog_public_source_url: 'https://manufacturer.example/fit', catalog_observed_at: now,
  }).select('id').single();
  assert.ifError(variant.error); variantId = variant.data.id;

  const withoutVariant = await invoke(first, { operation: 'fit', productId });
  assert.ifError(withoutVariant.error);
  assert.equal(withoutVariant.data.fit.reason, 'formula_unverified');
  const withoutFormula = await invoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(withoutFormula.error);
  assert.equal(withoutFormula.data.fit.reason, 'formula_unverified');

  const formula = await admin.from('product_formula_versions').insert({
    variant_id: variantId, ingredients: ['Water', 'Glycerin'],
    normalized_ingredient_fingerprint: `water|glycerin|${randomUUID()}`,
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/fit',
    catalog_public_source_url: 'https://manufacturer.example/fit',
    observed_at: now, verification_status: 'verified',
  }).select('id').single();
  assert.ifError(formula.error); formulaId = formula.data.id;
  const withoutIdentifier = await invoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(withoutIdentifier.error);
  assert.equal(withoutIdentifier.data.fit.reason, 'formula_unverified');
  const identifier = await admin.from('product_identifiers').insert({
    variant_id: variantId, formula_version_id: formulaId,
    identifier_type: 'manufacturer_sku', identifier_value: `FIT-${randomUUID()}`,
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/fit',
    observed_at: now, verified_at: now,
  }).select('id').single();
  assert.ifError(identifier.error); identifierId = identifier.data.id;

  const result = await invoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(result.error);
  assert.equal(result.data.fit.label, 'COULD_WORK');
  assert.equal(result.data.fit.formulaVersionId, formulaId);
  assert.deepEqual(result.data.fit.sources, ['https://manufacturer.example/fit']);
  const retinylVariant = await admin.from('product_variants').insert({
    product_id: productId, variant_name: 'Retinyl formula', lifecycle_status: 'active',
    catalog_verification_status: 'verified', catalog_source_reference: 'https://manufacturer.example/fit',
    catalog_public_source_url: 'https://manufacturer.example/fit', catalog_observed_at: now,
  }).select('id').single();
  assert.ifError(retinylVariant.error); retinylVariantId = retinylVariant.data.id;
  const retinylFormula = await admin.from('product_formula_versions').insert({
    variant_id: retinylVariantId, ingredients: ['Water', 'Retinyl Propionate'],
    normalized_ingredient_fingerprint: `water|retinyl-propionate|${randomUUID()}`,
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/fit',
    observed_at: now, verification_status: 'verified',
  }).select('id').single();
  assert.ifError(retinylFormula.error); retinylFormulaId = retinylFormula.data.id;
  const retinylIdentifier = await admin.from('product_identifiers').insert({
    variant_id: retinylVariantId, formula_version_id: retinylFormulaId,
    identifier_type: 'manufacturer_sku', identifier_value: `FIT-${randomUUID()}`,
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/fit',
    observed_at: now, verified_at: now,
  }).select('id').single();
  assert.ifError(retinylIdentifier.error); retinylIdentifierId = retinylIdentifier.data.id;
  const pregnancyProfile = await invoke(first, { operation: 'save_profile', profile: {
    ...profile, pregnancyStatus: 'yes',
  } });
  assert.ifError(pregnancyProfile.error);
  const retinylFit = await invoke(first, { operation: 'fit', productId, variantId: retinylVariantId });
  assert.ifError(retinylFit.error);
  assert.equal(retinylFit.data.fit.reason, 'retinoid_pregnancy_context');
  assert.equal(retinylFit.data.fit.label, 'USE_WITH_CAUTION');
  assert.ifError((await invoke(first, { operation: 'save_profile', profile })).error);
  const secondResult = await invoke(second, { operation: 'fit', productId, variantId });
  assert.ifError(secondResult.error);
  assert.equal(secondResult.data.fit.reason, 'profile_missing');
  const mismatched = await invoke(first, { operation: 'fit', productId: randomUUID(), variantId });
  assert.equal(mismatched.status, 404);

  const sensitivity = await invoke(first, { operation: 'save_profile', profile: {
    ...profile, sensitivitiesStatus: 'reported', knownSensitivities: ['Glycerin'],
  } });
  assert.ifError(sensitivity.error);
  assert.equal((await invoke(first, { operation: 'fit', productId, variantId })).data.fit.reason,
    'reported_ingredient_sensitivity');
  const secondFormula = await admin.from('product_formula_versions').insert({
    variant_id: variantId, ingredients: ['Water', 'Other formula'],
    normalized_ingredient_fingerprint: `water|other|${randomUUID()}`,
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/other',
    observed_at: now, verification_status: 'verified',
  }).select('id').single();
  assert.ifError(secondFormula.error); secondFormulaId = secondFormula.data.id;
  const secondIdentifier = await admin.from('product_identifiers').insert({
    variant_id: variantId, formula_version_id: secondFormulaId,
    identifier_type: 'manufacturer_sku', identifier_value: `FIT-${randomUUID()}`,
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/other',
    observed_at: now, verified_at: now,
  }).select('id').single();
  assert.ifError(secondIdentifier.error); secondIdentifierId = secondIdentifier.data.id;
  const ambiguous = await invoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(ambiguous.error);
  assert.equal(ambiguous.data.fit.reason, 'formula_unverified');
  assert.equal(ambiguous.data.fit.label, 'NOT_ENOUGH_INFORMATION');
  const noAuth = await fetch(`${status.API_URL}/functions/v1/free-personal-fit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'get_profile' }),
  });
  assert.equal(noAuth.status, 401);
  console.log('S-FREE-2 local guest profile, strict validation, owner isolation and verified-formula fit passed');
} finally {
  if (retinylIdentifierId) await admin.from('product_identifiers').delete().eq('id', retinylIdentifierId);
  if (retinylFormulaId) await admin.from('product_formula_versions').delete().eq('id', retinylFormulaId);
  if (retinylVariantId) await admin.from('product_variants').delete().eq('id', retinylVariantId);
  if (secondIdentifierId) await admin.from('product_identifiers').delete().eq('id', secondIdentifierId);
  if (identifierId) await admin.from('product_identifiers').delete().eq('id', identifierId);
  if (secondFormulaId) await admin.from('product_formula_versions').delete().eq('id', secondFormulaId);
  if (formulaId) await admin.from('product_formula_versions').delete().eq('id', formulaId);
  if (variantId) await admin.from('product_variants').delete().eq('id', variantId);
  if (productId) await admin.from('products').delete().eq('id', productId);
  if (firstId) await admin.auth.admin.deleteUser(firstId);
  if (secondId) await admin.auth.admin.deleteUser(secondId);
}
