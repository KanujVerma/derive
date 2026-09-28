/** Disposable local-only guest deletion drill: pagination, fail-closed retry, both buckets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const workdirArgs = process.env.P0C_LOCAL_SUPABASE_WORKDIR
  ? ['--workdir', process.env.P0C_LOCAL_SUPABASE_WORKDIR] : [];
const status = JSON.parse(execFileSync('supabase', ['status', ...workdirArgs, '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
const apiUrl = new URL(status.API_URL);
assert.equal(apiUrl.protocol, 'http:', 'Refuse a non-local Supabase project');
assert.equal(apiUrl.hostname, '127.0.0.1', 'Refuse a non-local Supabase project');
const makeClient = (key) => createClient(status.API_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = makeClient(status.SERVICE_ROLE_KEY);
const guest = makeClient(status.ANON_KEY);
const neighbor = makeClient(status.ANON_KEY);
const skinBucket = 'customer-skin-photos';
const productBucket = 'customer-product-evidence';
let guestId;
let neighborId;
let guestDeleted = false;
let corruptMetadataId;

async function upload(bucket, path) {
  const result = await admin.storage.from(bucket).upload(
    path, new Blob(['local synthetic image'], { type: 'image/jpeg' }),
    { contentType: 'image/jpeg', upsert: false },
  );
  assert.ifError(result.error);
}

async function list(bucket, prefix) {
  const result = await admin.storage.from(bucket).list(prefix, { limit: 100 });
  assert.ifError(result.error);
  return result.data ?? [];
}

async function collectPaths(bucket, prefix) {
  const paths = [];
  let offset = 0;
  while (true) {
    const result = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    assert.ifError(result.error);
    const entries = result.data ?? [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null || entry.id === undefined) paths.push(...await collectPaths(bucket, path));
      else paths.push(path);
    }
    if (entries.length < 100) break;
    offset += entries.length;
  }
  return paths;
}

async function deleteGuest() {
  const response = await guest.functions.invoke('delete-customer-account', {
    body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' },
  });
  return {
    status: response.error?.context?.status ?? 200,
    body: response.error?.context ? await response.error.context.json() : response.data,
  };
}

try {
  const signedGuest = await guest.auth.signInAnonymously();
  const signedNeighbor = await neighbor.auth.signInAnonymously();
  assert.ifError(signedGuest.error);
  assert.ifError(signedNeighbor.error);
  guestId = signedGuest.data.user.id;
  neighborId = signedNeighbor.data.user.id;
  assert.notEqual(guestId, neighborId);

  const skinPaths = Array.from({ length: 101 }, (_, index) =>
    `${guestId}/front/paged-${String(index).padStart(3, '0')}-${randomUUID()}.jpg`);
  for (const path of skinPaths) await upload(skinBucket, path);
  const nestedSkinPath = `${guestId}/front/nested/${randomUUID()}.jpg`;
  const productPath = `${guestId}/free_scan/front_label/${randomUUID()}.jpg`;
  const neighborSkinPath = `${neighborId}/front/${randomUUID()}.jpg`;
  const neighborProductPath = `${neighborId}/free_scan/front_label/${randomUUID()}.jpg`;
  await upload(skinBucket, nestedSkinPath);
  await upload(productBucket, productPath);
  await upload(skinBucket, neighborSkinPath);
  await upload(productBucket, neighborProductPath);

  const referenced = await admin.from('user_photos').insert({
    user_id: guestId, photo_type: 'front', storage_path: skinPaths[0],
  }).select('id').single();
  assert.ifError(referenced.error);

  // A privileged, malformed metadata row simulates an inconsistent source.
  // Deletion must not delete a different owner's object or remove Auth first.
  const corrupt = await admin.from('user_photos').insert({
    user_id: guestId, photo_type: 'front', storage_path: neighborSkinPath,
  }).select('id').single();
  assert.ifError(corrupt.error);
  corruptMetadataId = corrupt.data.id;

  const rejected = await deleteGuest();
  assert.equal(rejected.status, 500);
  assert.equal(rejected.body?.code, 'DELETION_FAILED');
  assert.ifError((await admin.auth.admin.getUserById(guestId)).error);
  const marker = await admin.from('profiles').select('deletion_started_at').eq('id', guestId).single();
  assert.ifError(marker.error);
  assert.ok(marker.data.deletion_started_at, 'failed cleanup leaves the write fence in place');
  assert.equal((await list(skinBucket, `${guestId}/front`)).length, 100,
    'first page remains intact after the failed inventory');
  assert.equal((await list(skinBucket, `${neighborId}/front`)).length, 1);

  const fencedPath = `${guestId}/front/late-${randomUUID()}.jpg`;
  const lateUpload = await guest.storage.from(skinBucket).upload(
    fencedPath, new Blob(['late synthetic image'], { type: 'image/jpeg' }),
    { contentType: 'image/jpeg', upsert: false },
  );
  assert.ok(lateUpload.error, 'new owner uploads remain fenced after failed deletion');

  assert.ifError((await admin.from('user_photos').delete().eq('id', corruptMetadataId)).error);
  corruptMetadataId = null;
  const retried = await deleteGuest();
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body, { deleted: true });
  guestDeleted = true;
  assert.ok((await admin.auth.admin.getUserById(guestId)).error);
  assert.deepEqual((await list(skinBucket, guestId)), []);
  assert.deepEqual((await list(productBucket, guestId)), []);
  assert.deepEqual((await admin.from('user_photos').select('id').eq('user_id', guestId)).data, []);
  assert.equal((await list(skinBucket, `${neighborId}/front`)).length, 1);
  assert.equal((await list(productBucket, `${neighborId}/free_scan/front_label`)).length, 1);
  assert.ifError((await admin.auth.admin.getUserById(neighborId)).error);
  console.log('P0-C local guest deletion: >100 objects, both buckets, fail-closed fence, safe retry, neighbor isolation: PASS');
} finally {
  if (corruptMetadataId) await admin.from('user_photos').delete().eq('id', corruptMetadataId);
  if (guestId && !guestDeleted) {
    const cleanup = await deleteGuest();
    if (cleanup.status !== 200) console.warn('Synthetic guest cleanup did not complete; fixture retained for local review');
  }
  if (neighborId) {
    for (const bucket of [skinBucket, productBucket]) {
      const paths = await collectPaths(bucket, neighborId);
      if (paths.length) assert.ifError((await admin.storage.from(bucket).remove(paths)).error);
      assert.deepEqual(await collectPaths(bucket, neighborId), []);
    }
    assert.ifError((await admin.auth.admin.deleteUser(neighborId)).error);
  }
}
