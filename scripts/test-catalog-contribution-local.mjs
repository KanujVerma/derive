/** Local-only Auth/Storage/Edge contribution smoke; never targets hosted. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Refuse a non-local Supabase target');
const make = (key) => createClient(status.API_URL, key,
  { auth: { autoRefreshToken: false, persistSession: false } });
const admin = make(status.SERVICE_ROLE_KEY);
const first = make(status.ANON_KEY);
const second = make(status.ANON_KEY);
const call = async (client, body) => {
  const { data, error } = await client.functions.invoke('catalog-contribution', { body });
  return { data, status: error?.context?.status ?? 200 };
};
const consent = { version: 1, purpose: 'catalog_review', accepted: true };
const makeRequest = (requestId, name = 'Example Lotion', evidence = []) => ({
  version: 1, intent: 'help_add_product', requestId,
  product: { brand: 'Example', name }, ...(evidence.length ? { evidence } : {}),
});
let firstId, secondId, uploadedPath;
try {
  const a = await first.auth.signInAnonymously();
  const b = await second.auth.signInAnonymously();
  assert.ifError(a.error); assert.ifError(b.error);
  firstId = a.data.user.id; secondId = b.data.user.id;
  const request = makeRequest(randomUUID());
  assert.equal((await call(first, { operation: 'submit', contribution: request })).status, 400,
    'submitting without affirmative purpose-bound consent fails');
  const original = await call(first, { operation: 'submit', contribution: request, consent });
  assert.equal(original.status, 200);
  assert.equal(original.data.contribution.status, 'submitted');
  const id = original.data.contribution.id;
  assert.equal((await call(first, { operation: 'submit', contribution: request, consent })).data.contribution.id, id,
    'retry reuses the same row');
  assert.equal((await call(first, { operation: 'submit', contribution: makeRequest(request.requestId, 'Other'), consent })).status, 409,
    'changed replay is rejected');
  assert.equal((await call(second, { operation: 'status', requestId: request.requestId })).data.contribution, null,
    'another account cannot locate the submission');
  assert.deepEqual((await second.from('catalog_contributions').select('id').eq('id', id)).data, [],
    'RLS hides the submitted row');
  assert.equal((await call(second, { operation: 'withdraw', id })).status, 404,
    'another account cannot withdraw it');
  assert.ok((await first.from('catalog_contributions').insert({ id: randomUUID(), user_id: firstId })).error,
    'the client cannot directly write proposal rows');

  const grantRequest = { requestId: randomUUID(), role: 'front_label', mimeType: 'image/png' };
  const prepared = await first.functions.invoke('prepare-free-product-evidence', { body: grantRequest });
  assert.ifError(prepared.error); uploadedPath = prepared.data.storagePath;
  const grant = await admin.from('free_product_evidence_grants').select('id')
    .eq('user_id', firstId).eq('request_id', grantRequest.requestId).single();
  assert.ifError(grant.error);
  const evidenceRequest = makeRequest(randomUUID(), 'Private Photo Lotion',
    [{ evidenceId: grant.data.id, role: 'front_label' }]);
  assert.equal((await call(first, { operation: 'submit', contribution: evidenceRequest, consent })).status, 409,
    'a grant without an uploaded object is not accepted');
  assert.equal((await call(second, { operation: 'submit', contribution: evidenceRequest, consent })).status, 409,
    'the other owner cannot attach the grant');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  assert.ifError((await first.storage.from('customer-product-evidence').upload(uploadedPath, png,
    { contentType: 'image/png', upsert: false })).error);
  const withEvidence = await call(first, { operation: 'submit', contribution: evidenceRequest, consent });
  assert.equal(withEvidence.status, 200, 'uploaded owner-bound evidence is accepted');
  assert.doesNotMatch(JSON.stringify(withEvidence.data), /storagePath|free_scan|customer-product-evidence/,
    'the response does not reveal private paths');
  const withdrawn = await call(first, { operation: 'withdraw', id });
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.data.contribution.status, 'withdrawn');
  assert.equal((await call(first, { operation: 'submit', contribution: request, consent })).data.contribution.status,
    'withdrawn', 'replay cannot restore withdrawn details');
  const tombstone = await admin.from('catalog_contributions').select('payload,candidate_key,request_fingerprint')
    .eq('id', id).single();
  assert.ifError(tombstone.error);
  assert.deepEqual(tombstone.data, { payload: null, candidate_key: null, request_fingerprint: null },
    'withdrawal scrubs details and private evidence references');
  const deletion = await first.functions.invoke('delete-customer-account',
    { body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' } });
  assert.ifError(deletion.error); firstId = null;
  assert.deepEqual((await admin.from('catalog_contributions').select('id').eq('id', id)).data, [],
    'Auth deletion cascades the contribution tombstone');
  console.log('Catalog contribution: consent, replay, RLS, private evidence, withdrawal and deletion passed');
} finally {
  if (uploadedPath) await admin.storage.from('customer-product-evidence').remove([uploadedPath]);
  if (firstId) await admin.auth.admin.deleteUser(firstId);
  if (secondId) await admin.auth.admin.deleteUser(secondId);
}
