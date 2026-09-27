import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readFreeEvidenceStatus } from '../supabase/functions/prepare-free-product-evidence/status.ts';
import { readFreeProductEvidenceStatus } from '../src/services/remote/freeProductEvidence.ts';
import { createImmutableEvidenceUploadAttempt, reconcileFreeEvidenceUpload } from '../src/presentation/capture/immutableEvidenceUploadRecovery.ts';

const owner = 'ab000000-0000-4000-8000-000000000001';
const filename = 'ab000000-0000-4000-8000-000000000002.jpg';
const input = { requestId: 'ab000000-0000-4000-8000-000000000003', role: 'front_label' as const, mimeType: 'image/jpeg' as const };
const target = { bucket: 'customer-product-evidence' as const, storagePath: `${owner}/free_scan/front_label/${filename}`, role: input.role, mimeType: input.mimeType, maxBytes: 10485760 };
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: input.mimeType };
const status = { uploaded: true, target, objectBytes: photo.bytes.byteLength };

function serverClient(options: { grant?: unknown; entries?: unknown; grantError?: unknown; storageError?: unknown } = {}) {
  const calls: unknown[] = [];
  const filters: Record<string, string> = {};
  const grant = options.grant === undefined ? { storage_path: target.storagePath, role: input.role, mime_type: input.mimeType } : options.grant;
  const client = {
    from(table: string) {
      calls.push(['table', table]);
      return { select(columns: string) {
        calls.push(['columns', columns]);
        const query = {
          eq(column: string, value: string) { filters[column] = value; return query; },
          async maybeSingle() {
            calls.push(['filters', { ...filters }]);
            return { data: filters.user_id === owner ? grant : null, error: options.grantError ?? null };
          },
        };
        return query;
      } };
    },
    storage: { from(bucket: string) { return { async list(prefix: string, listOptions: object) {
      calls.push(['list', bucket, prefix, listOptions]);
      return { data: options.entries ?? [{ name: filename, metadata: { size: 3, mimetype: 'image/jpeg' } }], error: options.storageError ?? null };
    } }; } },
  };
  return { client, calls };
}

test('status reads only the JWT owner request and exact immutable object, with no grant issuance', async () => {
  const { client, calls } = serverClient();
  assert.deepEqual(await readFreeEvidenceStatus(client, owner, input), status);
  assert.deepEqual(calls, [
    ['table', 'free_product_evidence_grants'], ['columns', 'storage_path, role, mime_type'],
    ['filters', { user_id: owner, request_id: input.requestId }],
    ['list', target.bucket, `${owner}/free_scan/front_label`, { search: filename, limit: 2 }],
  ]);
  const route = readFileSync(new URL('../supabase/functions/prepare-free-product-evidence/index.ts', import.meta.url), 'utf8');
  assert.ok(route.indexOf('await authenticate(req)') < route.indexOf('body.operation === "status"'));
  assert.ok(route.indexOf('return jsonResponse(await readFreeEvidenceStatus') < route.indexOf('admin.rpc('));
});

test('cross-owner and unknown grants are uniformly not found without probing private Storage', async () => {
  for (const [userId, options] of [['other-owner', {}], [owner, { grant: null }]] as const) {
    const { client, calls } = serverClient(options);
    await assert.rejects(readFreeEvidenceStatus(client, userId, input), { code: 'EVIDENCE_NOT_FOUND', status: 404 });
    assert.equal(calls.some((call) => (call as string[])[0] === 'list'), false);
  }
});

test('status rejects role/type conflicts and corrupt or foreign stored grant paths before Storage', async () => {
  for (const grant of [
    { storage_path: target.storagePath, role: 'ingredients', mime_type: input.mimeType },
    { storage_path: target.storagePath, role: input.role, mime_type: 'image/png' },
    { storage_path: `other/free_scan/front_label/${filename}`, role: input.role, mime_type: input.mimeType },
    { storage_path: `${owner}/free_scan/front_label/../${filename}`, role: input.role, mime_type: input.mimeType },
  ]) {
    const { client, calls } = serverClient({ grant });
    await assert.rejects(readFreeEvidenceStatus(client, owner, input));
    assert.equal(calls.some((call) => (call as string[])[0] === 'list'), false);
  }
});

test('only absence of the exact object means not uploaded; metadata conflict and lookup failure fail closed', async () => {
  assert.deepEqual(await readFreeEvidenceStatus(serverClient({ entries: [{ name: `other-${filename}`, metadata: { size: 3, mimetype: 'image/jpeg' } }] }).client, owner, input), { uploaded: false, target, objectBytes: null });
  for (const metadata of [null, { size: 0, mimetype: 'image/jpeg' }, { size: 10485761, mimetype: 'image/jpeg' }, { size: '3', mimetype: 'image/jpeg' }, { size: 3, mimetype: 'image/png' }]) {
    await assert.rejects(readFreeEvidenceStatus(serverClient({ entries: [{ name: filename, metadata }] }).client, owner, input), { code: 'EVIDENCE_CONFLICT', status: 409 });
  }
  await assert.rejects(readFreeEvidenceStatus(serverClient({ grantError: { code: 'database-private-error' } }).client, owner, input), { code: 'EVIDENCE_UNAVAILABLE', status: 503 });
  await assert.rejects(readFreeEvidenceStatus(serverClient({ storageError: { message: 'private-storage-detail' } }).client, owner, input), { code: 'EVIDENCE_UNAVAILABLE', status: 503 });
});

test('remote status sends only operation/request/role/type, projects safe metadata, and rejects malformed responses', async () => {
  const bodies: object[] = [];
  const client = (data: unknown, error: unknown = null) => ({
    functions: { invoke: async (name: string, options: { body: object }) => { assert.equal(name, 'prepare-free-product-evidence'); bodies.push(options.body); return { data, error }; } },
    storage: { from: () => ({ upload: async () => { assert.fail('status must never upload'); } }) },
  });
  assert.deepEqual(await readFreeProductEvidenceStatus(input, client({ ...status, rawBytes: 'excluded', signedUrl: 'excluded' })), status);
  assert.deepEqual(bodies[0], { operation: 'status', ...input });
  for (const value of [null, {}, { ...status, uploaded: 'yes' }, { ...status, objectBytes: 0 }, { ...status, target: { ...target, mimeType: 'image/png' } }, { ...status, uploaded: false }, { uploaded: false, target, objectBytes: 3 }]) {
    await assert.rejects(readFreeProductEvidenceStatus(input, client(value)), { message: 'Photo status is unavailable' });
  }
  await assert.rejects(readFreeProductEvidenceStatus(input, client(null, { message: 'raw-private-path' })), { message: 'Photo status is unavailable' });
  assert.deepEqual(await readFreeProductEvidenceStatus(input, client({ uploaded: false, target, objectBytes: null })), { uploaded: false, target, objectBytes: null });
});

test('lost upload ACK recovers only from matching target, original MIME and exact original size', async () => {
  for (const response of [status, { ...status, objectBytes: 4 }, { ...status, uploaded: false, objectBytes: null }, { ...status, target: { ...target, storagePath: 'other-owner/private' } }, { ...status, target: { ...target, role: 'ingredients' as const } }]) {
    let checks = 0;
    let ownerChecks = 0;
    const recovered = await reconcileFreeEvidenceUpload({ requestId: input.requestId, target, photo }, {
      status: async (request) => { checks++; assert.deepEqual(request, input); return response; }, assertOwner: () => { ownerChecks++; },
    });
    assert.equal(recovered, response === status);
    assert.equal(checks, 1);
    assert.equal(ownerChecks, 2);
  }
  assert.equal(await reconcileFreeEvidenceUpload({ requestId: input.requestId, target, photo }, {
    status: async () => { throw new Error('unavailable'); }, assertOwner: () => {},
  }), false);
});

test('upload attempt preserves original decoded bytes despite local mutation, skips confirmed upload on explicit retry', async () => {
  const original = new Uint8Array([1, 2, 3]);
  const attemptTarget = { ...target };
  let uploads = 0;
  let checks = 0;
  const attempt = createImmutableEvidenceUploadAttempt({ requestId: input.requestId, target: attemptTarget, photo: { bytes: original.buffer, mimeType: 'image/jpeg' } }, {
    upload: async (path, bytes) => { uploads++; assert.deepEqual(path, target); assert.deepEqual(new Uint8Array(bytes), new Uint8Array([1, 2, 3])); throw new Error('ACK lost'); },
    status: async () => { checks++; return status; }, assertOwner: () => {},
  });
  original.fill(9);
  attemptTarget.storagePath = 'changed-local-attempt';
  await attempt.upload();
  await attempt.upload();
  assert.equal(uploads, 1);
  assert.equal(checks, 1);
});

test('missing confirmation preserves failure without automatic reupload, and explicit retry retains bytes', async () => {
  let uploads = 0;
  let checks = 0;
  const attempt = createImmutableEvidenceUploadAttempt({ requestId: input.requestId, target, photo }, {
    upload: async () => { uploads++; throw new Error('Photo upload failed'); },
    status: async () => { checks++; return { uploaded: false, target, objectBytes: null }; }, assertOwner: () => {},
  });
  await assert.rejects(attempt.upload(), { message: 'Photo upload failed' });
  assert.equal(uploads, 1);
  assert.equal(checks, 1);
  await assert.rejects(attempt.upload());
  assert.equal(uploads, 2);
  assert.equal(checks, 2);
});

test('owner change before/during reconciliation cannot confirm or expose stale upload status', async () => {
  let changed = false;
  let checks = 0;
  const assertOwner = () => { if (changed) throw new Error('ACCOUNT_CHANGED'); };
  await assert.rejects(reconcileFreeEvidenceUpload({ requestId: input.requestId, target, photo }, {
    status: async () => { checks++; changed = true; return status; }, assertOwner,
  }), { message: 'ACCOUNT_CHANGED' });
  assert.equal(checks, 1);
  await assert.rejects(reconcileFreeEvidenceUpload({ requestId: input.requestId, target, photo }, {
    status: async () => { assert.fail('must not query under changed owner'); }, assertOwner,
  }), { message: 'ACCOUNT_CHANGED' });
});

test('invalid original upload bytes or MIME never reach Storage or status lookup', async () => {
  for (const originalPhoto of [
    { bytes: new ArrayBuffer(0), mimeType: input.mimeType },
    { bytes: new ArrayBuffer(10485761), mimeType: input.mimeType },
    { bytes: photo.bytes, mimeType: 'image/png' as const },
  ]) {
    const attempt = createImmutableEvidenceUploadAttempt({ requestId: input.requestId, target, photo: originalPhoto }, {
      upload: async () => assert.fail('invalid attempt must not upload'),
      status: async () => { assert.fail('invalid attempt must not query'); }, assertOwner: () => {},
    });
    await assert.rejects(attempt.upload(), { message: 'Photo upload failed' });
  }
});
