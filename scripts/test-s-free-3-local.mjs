/** S-FREE-3 local Auth/Edge/history smoke. Refuses hosted Supabase. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local Supabase');
const makeClient = (key) => createClient(status.API_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = makeClient(status.SERVICE_ROLE_KEY);
const first = makeClient(status.ANON_KEY);
const second = makeClient(status.ANON_KEY);
const invoke = async (client, body) => {
  const { data, error } = await client.functions.invoke('free-context', { body });
  return { data, error, status: error?.context?.status ?? 200 };
};
const fitInvoke = async (client, body) => client.functions.invoke('free-personal-fit', { body });
let firstId, secondId, productId, caseId, variantId, formulaId, identifierId;

try {
  const a = await first.auth.signInAnonymously();
  const b = await second.auth.signInAnonymously();
  assert.ifError(a.error); assert.ifError(b.error);
  firstId = a.data.user.id; secondId = b.data.user.id;
  assert.deepEqual((await invoke(first, { operation: 'list', section: 'products' })).data.items, []);
  assert.equal((await first.from('free_saved_products').select('*')).error?.code, '42501');
  assert.equal((await first.from('free_check_history').select('*')).error?.code, '42501');
  assert.equal((await first.from('free_product_experiences').select('*')).error?.code, '42501');

  const now = new Date().toISOString();
  const sourced = await admin.from('products').insert({
    brand: 'SFree3', name: `Sourced moisturizer ${randomUUID()}`, category: 'moisturizer',
    is_catalog_standard: true, catalog_source_reference: 'https://manufacturer.example/context',
    catalog_public_source_url: 'https://manufacturer.example/context',
    catalog_observed_at: now, catalog_verified_at: now,
  }).select('id,name').single();
  assert.ifError(sourced.error); productId = sourced.data.id;
  const variant = await admin.from('product_variants').insert({
    product_id: productId, variant_name: 'Test formula', lifecycle_status: 'active',
    catalog_verification_status: 'verified', catalog_source_reference: 'https://manufacturer.example/context',
    catalog_public_source_url: 'https://manufacturer.example/context', catalog_observed_at: now,
  }).select('id').single();
  assert.ifError(variant.error); variantId = variant.data.id;
  const formula = await admin.from('product_formula_versions').insert({
    variant_id: variantId, ingredients: ['Water', 'Glycerin'],
    normalized_ingredient_fingerprint: `water|glycerin|${randomUUID()}`,
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/context',
    catalog_public_source_url: 'https://manufacturer.example/context', observed_at: now,
    verification_status: 'verified',
  }).select('id').single();
  assert.ifError(formula.error); formulaId = formula.data.id;
  const identifier = await admin.from('product_identifiers').insert({
    variant_id: variantId, formula_version_id: formulaId, identifier_type: 'manufacturer_sku',
    identifier_value: `S3-${randomUUID()}`, source_authority: 'manufacturer',
    source_reference: 'https://manufacturer.example/context', observed_at: now, verified_at: now,
  }).select('id').single();
  assert.ifError(identifier.error); identifierId = identifier.data.id;
  const profile = {
    goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates',
    pregnancyStatus: 'no', sensitivitiesStatus: 'none_known', knownSensitivities: [],
    treatmentStatus: 'none', currentTreatments: [],
  };
  assert.ifError((await fitInvoke(first, { operation: 'save_profile', profile })).error);
  const fitBefore = await fitInvoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(fitBefore.error);
  assert.equal(fitBefore.data.fit.label, 'COULD_WORK');

  const saveRequest = { operation: 'save_product', requestId: randomUUID(),
    product: { productId }, state: 'using' };
  const saved = await invoke(first, saveRequest);
  assert.ifError(saved.error);
  assert.equal(saved.data.product.productId, productId);
  assert.equal(saved.data.product.name, sourced.data.name);
  assert.equal((await invoke(first, saveRequest)).data.product.id, saved.data.product.id);
  assert.equal((await invoke(first, { ...saveRequest, product: { name: 'Different product' } })).status, 409);
  assert.equal((await invoke(second, { operation: 'set_product_state', id: saved.data.product.id, state: 'stopped' })).status, 404);
  const updated = await invoke(first, { operation: 'set_product_state', id: saved.data.product.id, state: 'stopped' });
  assert.ifError(updated.error);
  assert.equal(updated.data.product.state, 'stopped');

  const manual = await invoke(first, { operation: 'save_product', requestId: randomUUID(),
    product: { name: 'Unknown wash', brand: 'User-supplied' }, state: 'considering' });
  assert.ifError(manual.error);
  assert.equal(manual.data.product.source, 'user_reported');
  assert.equal(manual.data.product.productId, null);
  assert.deepEqual((await invoke(second, { operation: 'list', section: 'products' })).data.items, []);
  const firstPage = await invoke(first, { operation: 'list', section: 'products', limit: 1 });
  assert.ifError(firstPage.error);
  assert.equal(firstPage.data.items.length, 1);
  assert.equal(firstPage.data.nextCursor, firstPage.data.items[0].id);
  assert.equal((await invoke(second, { operation: 'list', section: 'products', cursor: firstPage.data.nextCursor })).status, 404);
  const nextPage = await invoke(first, { operation: 'list', section: 'products', limit: 1, cursor: firstPage.data.nextCursor });
  assert.ifError(nextPage.error);
  assert.equal(nextPage.data.items.length, 1);
  assert.notEqual(nextPage.data.items[0].id, firstPage.data.items[0].id);
  assert.equal(nextPage.data.nextCursor, null);

  const checkReq = { operation: 'record_check', requestId: randomUUID(), productId };
  const check = await invoke(first, checkReq);
  assert.ifError(check.error);
  assert.equal(check.data.check.resolutionState, 'catalog_product');
  assert.equal((await invoke(first, checkReq)).data.check.id, check.data.check.id);
  const foreignCase = await admin.from('product_resolution_cases').insert({
    user_id: firstId, request_id: randomUUID(), consumer: 'scan',
    resolution_state: 'insufficient_evidence', next_action: 'manual_review',
    requires_founder_review: false, review_status: 'not_needed', evidence_snapshot: {},
  }).select('id').single();
  assert.ifError(foreignCase.error); caseId = foreignCase.data.id;
  assert.equal((await invoke(second, { operation: 'record_check', requestId: randomUUID(), caseId })).status, 404);
  const unknown = await invoke(first, { operation: 'record_check', requestId: randomUUID(), caseId });
  assert.ifError(unknown.error);
  assert.equal(unknown.data.check.resolutionState, 'insufficient_evidence');
  assert.equal(unknown.data.check.productId, null);

  const experienceReq = { operation: 'record_experience', requestId: randomUUID(),
    product: { productId }, kind: 'reacted', note: 'Stinging after use' };
  const experience = await invoke(first, experienceReq);
  assert.ifError(experience.error);
  assert.equal(experience.data.experience.kind, 'reacted');
  assert.equal((await invoke(first, experienceReq)).data.experience.id, experience.data.experience.id);
  const fitAfter = await fitInvoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(fitAfter.error);
  assert.equal(fitAfter.data.fit.label, 'USE_WITH_CAUTION');
  assert.equal(fitAfter.data.fit.reason, 'prior_product_reaction');
  assert.deepEqual((await invoke(second, { operation: 'list', section: 'experiences' })).data.items, []);
  assert.equal((await invoke(second, { operation: 'delete_entry', section: 'experiences', id: experience.data.experience.id })).status, 404);
  assert.equal((await invoke(first, { operation: 'delete_entry', section: 'experiences', id: experience.data.experience.id })).data.deleted, true);
  const fitRestored = await fitInvoke(first, { operation: 'fit', productId, variantId });
  assert.ifError(fitRestored.error);
  assert.equal(fitRestored.data.fit.label, 'COULD_WORK');
  assert.equal((await invoke(first, { operation: 'delete_product', id: saved.data.product.id })).data.deleted, true);

  const noAuth = await fetch(`${status.API_URL}/functions/v1/free-context`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'list', section: 'checks' }),
  });
  assert.equal(noAuth.status, 401);
  assert.deepEqual((await admin.from('memberships').select('id').eq('user_id', firstId)).data, []);
  assert.deepEqual((await admin.from('user_products').select('id').eq('user_id', firstId)).data, []);
  assert.ifError((await admin.auth.admin.deleteUser(firstId)).error);
  for (const table of ['free_saved_products', 'free_check_history', 'free_product_experiences']) {
    assert.deepEqual((await admin.from(table).select('id').eq('user_id', firstId)).data, []);
  }
  firstId = null;
  console.log('S-FREE-3 guest history, idempotency, paging, server catalog truth and isolation passed');
} finally {
  if (firstId) await admin.auth.admin.deleteUser(firstId);
  if (secondId) await admin.auth.admin.deleteUser(secondId);
  if (caseId) await admin.from('product_resolution_cases').delete().eq('id', caseId);
  if (identifierId) await admin.from('product_identifiers').delete().eq('id', identifierId);
  if (formulaId) await admin.from('product_formula_versions').delete().eq('id', formulaId);
  if (variantId) await admin.from('product_variants').delete().eq('id', variantId);
  if (productId) await admin.from('products').delete().eq('id', productId);
}
