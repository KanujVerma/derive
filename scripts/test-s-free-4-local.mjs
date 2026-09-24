/** S-FREE-4 local Auth/Storage/Edge integration. Refuses a hosted target. */
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
const bucket = 'customer-product-evidence';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const invoke = async (client, name, body) => {
  const { data, error } = await client.functions.invoke(name, { body });
  return { data, error, status: error?.context?.status ?? 200 };
};
let firstId, secondId, productId;
const uploaded = [];

try {
  const a = await first.auth.signInAnonymously();
  const b = await second.auth.signInAnonymously();
  assert.ifError(a.error); assert.ifError(b.error);
  firstId = a.data.user.id; secondId = b.data.user.id;
  const unauthenticated = await fetch(`${status.API_URL}/functions/v1/prepare-free-product-evidence`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await invoke(first, 'prepare-free-product-evidence', {
    requestId: randomUUID(), role: 'front_label', mimeType: 'image/svg+xml',
  })).status, 400);
  const input = { requestId: randomUUID(), role: 'front_label', mimeType: 'image/png' };
  const target = await invoke(first, 'prepare-free-product-evidence', input);
  assert.ifError(target.error);
  assert.equal(target.data.bucket, bucket);
  assert.equal(target.data.maxBytes, 10485760);
  assert.match(target.data.storagePath, new RegExp(`^${firstId}/free_scan/front_label/[0-9a-f-]{36}[.]png$`));
  assert.equal((await invoke(first, 'prepare-free-product-evidence', input)).data.storagePath, target.data.storagePath);
  assert.equal((await invoke(first, 'prepare-free-product-evidence', { ...input, role: 'ingredients' })).status, 409);
  assert.equal((await first.rpc('issue_free_product_evidence_grant', {
    p_user_id: firstId, p_request_id: randomUUID(), p_role: 'front_label', p_mime_type: 'image/png',
  })).error?.code, '42501');
  assert.equal((await first.from('free_product_evidence_grants').select('id')).data?.length, 1);
  assert.deepEqual((await second.from('free_product_evidence_grants').select('id')).data, []);

  const unissued = `${firstId}/free_scan/front_label/${randomUUID()}.png`;
  assert.ok((await first.storage.from(bucket).upload(unissued, png, { contentType: 'image/png' })).error,
    'a guessed owner path is not sufficient');
  assert.ok((await second.storage.from(bucket).upload(target.data.storagePath, png, { contentType: 'image/png' })).error,
    'another guest cannot use this grant');
  assert.ok((await first.storage.from(bucket).upload(`${firstId}/front_label/${randomUUID()}.png`, png,
    { contentType: 'image/png' })).error, 'free guest cannot use managed path');
  const beforeUpload = await invoke(first, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', evidencePhotos: [{ storagePath: target.data.storagePath, role: 'front_label' }],
  });
  assert.equal(beforeUpload.status, 409);
  assert.ifError((await first.storage.from(bucket).upload(target.data.storagePath, png,
    { contentType: 'image/png', upsert: false })).error);
  uploaded.push(target.data.storagePath);
  const result = await invoke(first, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', evidencePhotos: [{ storagePath: target.data.storagePath, role: 'front_label' }],
  });
  assert.ifError(result.error);
  assert.equal(result.data.state, 'insufficient_evidence');
  assert.equal(result.data.requiresFounderReview, false);
  assert.equal(result.data.product, undefined);
  const now = new Date().toISOString();
  const productName = `Photo candidate ${randomUUID()}`;
  const product = await admin.from('products').insert({
    brand: 'SFree4', name: productName, category: 'cleanser', is_catalog_standard: true,
    catalog_source_reference: 'https://manufacturer.example/photo',
    catalog_public_source_url: 'https://manufacturer.example/photo',
    catalog_observed_at: now, catalog_verified_at: now,
  }).select('id').single();
  assert.ifError(product.error); productId = product.data.id;
  const candidate = await invoke(first, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', evidencePhotos: [{
      storagePath: target.data.storagePath, role: 'front_label', extractedText: `SFree4 ${productName}`,
    }],
  });
  assert.ifError(candidate.error);
  assert.equal(candidate.data.state, 'ambiguous_candidates');
  assert.equal(candidate.data.candidates[0]?.productId, productId);
  assert.equal(candidate.data.product, undefined);
  assert.equal(candidate.data.requiresFounderReview, false);
  assert.equal((await invoke(second, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'scan', evidencePhotos: [{ storagePath: target.data.storagePath, role: 'front_label' }],
  })).status, 400);
  assert.equal((await invoke(first, 'resolve-product-identity', {
    requestId: randomUUID(), consumer: 'shelf', brand: 'Any', productName: 'Thing',
  })).status, 403);
  const paidCaseRequestId = randomUUID();
  assert.ifError((await admin.from('product_resolution_cases').insert({
    user_id: firstId, request_id: paidCaseRequestId, consumer: 'shelf',
    resolution_state: 'insufficient_evidence', next_action: 'manual_review',
    requires_founder_review: false, review_status: 'not_needed', evidence_snapshot: {},
  })).error);
  assert.equal((await invoke(first, 'resolve-product-identity', {
    requestId: paidCaseRequestId, consumer: 'scan', brand: 'Any', productName: 'Thing',
  })).status, 409, 'free Scan must not replay an earlier Shelf case');

  for (let i = 0; i < 5; i++) {
    assert.ifError((await invoke(first, 'prepare-free-product-evidence', {
      requestId: randomUUID(), role: 'ingredients', mimeType: 'image/png',
    })).error);
  }
  assert.equal((await invoke(first, 'prepare-free-product-evidence', {
    requestId: randomUUID(), role: 'packaging', mimeType: 'image/png',
  })).status, 429);
  const deleteResult = await invoke(first, 'delete-customer-account', { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' });
  assert.ifError(deleteResult.error);
  assert.deepEqual((await admin.from('free_product_evidence_grants').select('id').eq('user_id', firstId)).data, []);
  const listed = await admin.storage.from(bucket).list(`${firstId}/free_scan/front_label`);
  assert.ifError(listed.error);
  assert.ok(!listed.data.some((item) => item.name === target.data.storagePath.split('/').at(-1)));
  firstId = null;
  console.log('S-FREE-4 guest grant, Storage RLS, private resolution, quota and deletion passed');
} finally {
  if (firstId) {
    if (uploaded.length) await admin.storage.from(bucket).remove(uploaded);
    await admin.auth.admin.deleteUser(firstId);
  }
  if (secondId) await admin.auth.admin.deleteUser(secondId);
  if (productId) await admin.from('products').delete().eq('id', productId);
}
