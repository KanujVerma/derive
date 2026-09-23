/** S-FREE-1 local HTTP/Auth/RLS smoke. Never targets a hosted project. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local Supabase');
const url = status.API_URL;
const makeClient = (key) => createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = makeClient(status.SERVICE_ROLE_KEY);
const guest = makeClient(status.ANON_KEY);
const otherGuest = makeClient(status.ANON_KEY);
const permanent = makeClient(status.ANON_KEY);
let guestId, otherId, permanentId, productId, provisionalId, variantId, privateVariantId;
let guestDeleted = false;

async function invoke(client, name, body = {}) {
  const { data, error } = await client.functions.invoke(name, { body });
  return { data, error, status: error?.context?.status ?? 200 };
}

try {
  const first = await guest.auth.signInAnonymously();
  assert.ifError(first.error);
  assert.equal(first.data.user.is_anonymous, true);
  guestId = first.data.user.id;
  const second = await otherGuest.auth.signInAnonymously();
  assert.ifError(second.error);
  otherId = second.data.user.id;

  const email = `s-free-1-${randomUUID()}@example.test`;
  const password = `Sfree1-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  permanentId = created.data.user.id;
  assert.ifError((await permanent.auth.signInWithPassword({ email, password })).error);

  const profile = await admin.from('profiles').select('email').eq('id', guestId).single();
  assert.ifError(profile.error);
  assert.equal(profile.data.email, null);
  assert.deepEqual((await admin.from('memberships').select('id').eq('user_id', guestId)).data, []);

  const guestAccess = await invoke(guest, 'access-state');
  assert.ifError(guestAccess.error);
  assert.deepEqual(guestAccess.data, {
    userId: guestId, identityKind: 'anonymous', freeProductAccess: true,
    managedMembershipStatus: 'none', managedAccess: false,
  });
  const permanentAccess = await invoke(permanent, 'access-state');
  assert.ifError(permanentAccess.error);
  assert.equal(permanentAccess.data.identityKind, 'permanent');
  assert.equal(permanentAccess.data.managedAccess, false);
  const guestClaim = await guest.rpc('claim_external_beta_access');
  assert.ok(guestClaim.error, 'guest cannot invoke the staging beta shortcut');
  assert.deepEqual((await admin.from('memberships').select('id').eq('user_id', guestId)).data, []);

  const now = new Date().toISOString();
  const sourced = await admin.from('products').insert({
    brand: 'SFree1', name: `Sourced Wash ${randomUUID()}`, category: 'cleanser',
    is_catalog_standard: true, catalog_source_reference: 'https://manufacturer.example/wash',
    catalog_public_source_url: 'https://manufacturer.example/wash',
    catalog_observed_at: now, catalog_verified_at: now,
  }).select('id,name').single();
  assert.ifError(sourced.error);
  productId = sourced.data.id;
  const provisional = await admin.from('products').insert({
    brand: 'SFree1Private', name: `Provisional ${randomUUID()}`,
    category: 'cleanser', is_catalog_standard: false,
  }).select('id').single();
  assert.ifError(provisional.error);
  provisionalId = provisional.data.id;

  const search = await invoke(guest, 'catalog-products', { operation: 'search', query: sourced.data.name, limit: 10 });
  assert.ifError(search.error);
  assert.equal(search.data.items[0]?.productId, productId);
  const detail = await invoke(guest, 'catalog-products', { operation: 'detail', productId });
  assert.ifError(detail.error);
  assert.equal(detail.data.product.productId, productId);
  assert.equal(detail.data.product.sourceReference, 'https://manufacturer.example/wash');
  assert.equal((await invoke(guest, 'catalog-products', { operation: 'detail', productId: provisionalId })).status, 404);
  const noSession = await fetch(`${url}/functions/v1/catalog-products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'search', query: 'SFree1' }),
  });
  assert.equal(noSession.status, 401);
  for (const name of ['access-state', 'resolve-product-identity']) {
    const unauthenticated = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(unauthenticated.status, 401, `${name} requires a real Auth session`);
  }
  assert.deepEqual((await guest.from('products').select('id').eq('id', productId)).data, []);
  assert.deepEqual((await guest.from('products').select('id').eq('id', provisionalId)).data, []);
  assert.equal((await guest.from('products').select('catalog_source_reference').eq('id', productId)).error?.code, '42501');

  const typed = await invoke(guest, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', brand: 'SFree1', productName: sourced.data.name,
  });
  assert.ifError(typed.error);
  assert.equal(typed.data.state, 'identified_formula_unverified');
  assert.equal(typed.data.product.productId, productId);

  const variant = await admin.from('product_variants').insert({
    product_id: productId, variant_name: 'Test bottle', region_code: 'US',
    catalog_verification_status: 'verified', catalog_source_reference: 'https://manufacturer.example/bottle',
    catalog_public_source_url: 'https://manufacturer.example/bottle', catalog_observed_at: now,
  }).select('id').single();
  assert.ifError(variant.error);
  variantId = variant.data.id;
  const privateVariant = await admin.from('product_variants').insert({
    product_id: productId, variant_name: `Unverified ${randomUUID()}`, region_code: 'US',
    catalog_verification_status: 'provisional',
  }).select('id').single();
  assert.ifError(privateVariant.error);
  privateVariantId = privateVariant.data.id;
  const publicDetail = await invoke(guest, 'catalog-products', { operation: 'detail', productId });
  assert.ifError(publicDetail.error);
  assert.ok(publicDetail.data.product.variants.some((row) => row.variantId === variantId));
  assert.ok(!publicDetail.data.product.variants.some((row) => row.variantId === privateVariantId));
  assert.ifError((await admin.from('product_identifiers').insert({
    variant_id: variantId, identifier_type: 'gtin_12', identifier_value: '036000291452',
    source_authority: 'manufacturer', source_reference: 'https://manufacturer.example/barcode',
    observed_at: now, verified_at: now,
  })).error);

  const barcode = await invoke(guest, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', barcode: '036000291452',
  });
  assert.ifError(barcode.error);
  assert.equal(barcode.data.state, 'identified_formula_unverified');
  const unknown = await invoke(guest, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', brand: 'Unknown', productName: `No Match ${randomUUID()}`,
  });
  assert.ifError(unknown.error);
  assert.equal(unknown.data.state, 'insufficient_evidence');
  assert.equal(unknown.data.requiresFounderReview, false);
  assert.deepEqual((await admin.from('founder_review_tasks').select('id').eq('user_id', guestId)).data, []);
  assert.deepEqual((await otherGuest.from('product_resolution_cases').select('id').eq('user_id', guestId)).data, []);
  assert.deepEqual((await permanent.from('product_resolution_cases').select('id').eq('user_id', guestId)).data, []);
  assert.deepEqual((await guest.from('profiles').select('id').eq('id', permanentId)).data, []);

  const photo = await invoke(guest, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', evidencePhotos: [{
      storagePath: `${guestId}/front_label/example.jpg`, role: 'front_label',
    }],
  });
  assert.equal(photo.status, 403);
  const photoBody = photo.error?.context ? await photo.error.context.json() : photo.data;
  assert.equal(photoBody?.code, 'PHOTO_EVIDENCE_MANAGED_ONLY');

  for (const [name, body] of [
    ['prepare-onboarding', {}], ['onboard-customer', {}], ['propose-routine', {}],
    ['scan-product', { productName: 'Wash' }],
    ['ask-derive', { userId: guestId, question: 'Which cleanser should I use?' }],
    ['infer-ingredient-signals', {}], ['submit-checkin', {}],
    ['create-membership-checkout', { requestId: randomUUID() }],
    ['create-membership-portal', {}], ['founder-operations', {}],
  ]) {
    const result = await invoke(guest, name, body);
    assert.equal(result.status, 403, `${name} must deny a guest before managed execution`);
  }

  assert.ifError((await admin.from('memberships').insert({
    user_id: permanentId, tier: 'founding_beta', status: 'active',
  })).error);
  const managedAccess = await invoke(permanent, 'access-state');
  assert.ifError(managedAccess.error);
  assert.equal(managedAccess.data.managedMembershipStatus, 'active');
  assert.equal(managedAccess.data.managedAccess, true);

  const evidencePath = `${guestId}/front_label/orphan-${randomUUID()}.jpg`;
  assert.ifError((await admin.storage.from('customer-product-evidence').upload(
    evidencePath, new Blob(['test-private-evidence'], { type: 'image/jpeg' }),
    { contentType: 'image/jpeg' },
  )).error);
  const crossDelete = await invoke(guest, 'delete-customer-account', {
    confirmation: 'DELETE_MY_DERIVE_ACCOUNT', userId: otherId,
  });
  assert.equal(crossDelete.status, 400);

  const deletion = await invoke(guest, 'delete-customer-account', { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' });
  assert.ifError(deletion.error);
  guestDeleted = true;
  assert.ok((await admin.auth.admin.getUserById(guestId)).error);
  assert.deepEqual((await admin.from('product_resolution_cases').select('id').eq('user_id', guestId)).data, []);
  assert.deepEqual((await admin.from('profiles').select('id').eq('id', guestId)).data, []);
  const remainingEvidence = await admin.storage.from('customer-product-evidence').list(`${guestId}/front_label`);
  assert.ifError(remainingEvidence.error);
  assert.deepEqual(remainingEvidence.data, []);
  console.log('S-FREE-1 local anonymous Auth, free facts, managed denial, RLS, deletion: PASS');
} finally {
  if (guestId && !guestDeleted) await admin.auth.admin.deleteUser(guestId);
  if (otherId) await admin.auth.admin.deleteUser(otherId);
  if (permanentId) await admin.auth.admin.deleteUser(permanentId);
  if (variantId) {
    await admin.from('product_identifiers').delete().eq('variant_id', variantId);
    await admin.from('product_variants').delete().eq('id', variantId);
  }
  if (privateVariantId) await admin.from('product_variants').delete().eq('id', privateVariantId);
  if (provisionalId) await admin.from('products').delete().eq('id', provisionalId);
  if (productId) await admin.from('products').delete().eq('id', productId);
}
