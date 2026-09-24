import assert from 'node:assert/strict';
import test from 'node:test';
import { readProductEvidencePhoto } from '../src/presentation/capture/readProductEvidencePhoto.ts';
import { createFreeEvidenceProcessor, mapFreeResolutionToCapture } from '../src/presentation/capture/freeEvidenceProcessor.ts';
import { uploadFreeProductEvidence } from '../src/services/remote/freeProductEvidence.ts';
import type { CaptureEvidence } from '../src/presentation/capture/productEvidence.ts';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const photo: CaptureEvidence = { role: 'front_label', kind: 'local_photo', value: 'file://private-cache/image' };

test('native photo reader uses byte signature and rejects empty, oversized, and unsupported files before grants', async () => {
  const read = (bytes: Uint8Array, type = 'application/octet-stream') => readProductEvidencePhoto('file://opaque', {
    platform: 'ios', nativeFileFactory: () => ({ exists: true, size: bytes.byteLength, type, arrayBuffer: async () => bytes.slice().buffer }),
  });
  assert.equal((await read(JPEG, 'image/png')).mimeType, 'image/jpeg');
  await assert.rejects(() => read(new Uint8Array()), { code: 'PHOTO_EMPTY' });
  await assert.rejects(() => read(Uint8Array.from([1, 2, 3])), { code: 'PHOTO_MIME_UNSUPPORTED' });
  await assert.rejects(() => readProductEvidencePhoto('file://opaque', {
    platform: 'ios', nativeFileFactory: () => ({ exists: true, size: 10 * 1024 * 1024 + 1, type: 'image/jpeg', arrayBuffer: async () => { throw new Error('must not read'); } }),
  }), { code: 'PHOTO_TOO_LARGE' });
});

test('web photo reader returns ArrayBuffer evidence and uses its byte signature', async () => {
  const result = await readProductEvidencePhoto('blob:camera-capture', {
    platform: 'web',
    fetchPhoto: async () => ({ ok: true, blob: async () => new Blob([JPEG], { type: 'image/png' }) }),
  });
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.bytes.byteLength, JPEG.byteLength);
});

test('photo grant and immutable upload feed only granted evidence to scan resolver, without OCR or public URL', async () => {
  const calls: unknown[] = [];
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => ({ bytes: JPEG.slice().buffer, mimeType: 'image/jpeg' }),
    createRequestId: (() => { let next = 0; return () => `id-${++next}`; })(),
    prepare: async (input) => { calls.push(['prepare', input]); return { bucket: 'customer-product-evidence', storagePath: 'server-issued/private.jpg', role: input.role, mimeType: input.mimeType, maxBytes: 10 * 1024 * 1024 }; },
    upload: async (target, bytes) => { calls.push(['upload', target.storagePath, bytes.byteLength]); },
    resolve: async (input) => { calls.push(['resolve', input]); return { caseId: 'case-1', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }; },
  });
  const result = await processor.process([photo]);
  assert.deepEqual(result, { state: 'insufficient_evidence', candidates: [] });
  assert.deepEqual(calls[0], ['prepare', { requestId: 'id-1', role: 'front_label', mimeType: 'image/jpeg' }]);
  assert.deepEqual(calls[1], ['upload', 'server-issued/private.jpg', JPEG.byteLength]);
  assert.deepEqual(calls[2], ['resolve', { requestId: 'id-2', consumer: 'scan', evidencePhotos: [{ storagePath: 'server-issued/private.jpg', role: 'front_label' }] }]);
  assert.equal(JSON.stringify(calls).includes('publicUrl'), false);
});

test('three distinct photo roles pass only their uploaded private paths to resolver', async () => {
  const paths: string[] = [];
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => ({ bytes: JPEG.slice().buffer, mimeType: 'image/jpeg' }), createRequestId: () => 'id',
    prepare: async (input) => ({ bucket: 'customer-product-evidence', storagePath: `issued/${input.role}`, role: input.role, mimeType: input.mimeType, maxBytes: 10 * 1024 * 1024 }),
    upload: async (target) => { paths.push(target.storagePath); },
    resolve: async (input) => {
      assert.deepEqual(input.evidencePhotos, [
        { storagePath: 'issued/front_label', role: 'front_label' },
        { storagePath: 'issued/ingredients', role: 'ingredients' },
        { storagePath: 'issued/packaging', role: 'packaging' },
      ]);
      return { caseId: 'case', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false };
    },
  });
  await processor.process([photo, { role: 'ingredients', kind: 'local_photo', value: 'file://ingredients' }, { role: 'packaging', kind: 'local_photo', value: 'file://package' }]);
  assert.deepEqual(paths, ['issued/front_label', 'issued/ingredients', 'issued/packaging']);
});

test('barcode bypasses photo grants and uploads', async () => {
  let grants = 0;
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => { throw new Error('must not read'); }, createRequestId: () => 'case-id',
    prepare: async () => { grants++; throw new Error('must not prepare'); },
    upload: async () => { throw new Error('must not upload'); },
    resolve: async (input) => {
      assert.deepEqual(input, { requestId: 'case-id', consumer: 'scan', barcode: '012345678905' });
      return { caseId: 'case-1', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false };
    },
  });
  await processor.process([{ role: 'barcode', kind: 'barcode', value: '012345678905' }, photo]);
  assert.equal(grants, 0);
});

test('manual retry reuses photo grant and resolver request ID after upload or response failure', async () => {
  const prepared: string[] = [];
  const resolved: string[] = [];
  let uploads = 0;
  let next = 0;
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => ({ bytes: JPEG.slice().buffer, mimeType: 'image/jpeg' }), createRequestId: () => `id-${++next}`,
    prepare: async (input) => { prepared.push(input.requestId); return { bucket: 'customer-product-evidence', storagePath: 'server-issued/private.jpg', role: input.role, mimeType: input.mimeType, maxBytes: 10 * 1024 * 1024 }; },
    upload: async () => { if (++uploads === 1) throw new Error('private storage error'); },
    resolve: async (input) => { resolved.push(input.requestId); if (resolved.length === 1) throw new Error('network'); return { caseId: 'case', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }; },
  });
  await assert.rejects(() => processor.process([photo]), { code: 'UPLOAD_FAILED' });
  await assert.rejects(() => processor.process([photo]), { code: 'RESOLVE_FAILED' });
  await processor.process([photo]);
  assert.deepEqual(prepared, ['id-1']);
  assert.deepEqual(resolved, ['id-2', 'id-2']);
  assert.equal(uploads, 2);
});

test('candidate and unknown states stay unresolved without fabricating product identity', async () => {
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => ({ bytes: JPEG.slice().buffer, mimeType: 'image/jpeg' }), createRequestId: () => 'id',
    prepare: async (input) => ({ bucket: 'customer-product-evidence', storagePath: 'server-path', role: input.role, mimeType: input.mimeType, maxBytes: 10 * 1024 * 1024 }),
    upload: async () => {},
    resolve: async () => ({ caseId: 'case', state: 'ambiguous_candidates', candidates: [{ productId: 'product-1', brand: 'A', name: 'Lotion', basis: 'label_text', matchReasons: [] }], nextAction: 'choose_candidate', requiresFounderReview: false }),
  });
  assert.deepEqual(await processor.process([photo]), { state: 'ambiguous', candidates: [{ id: 'case:0', label: 'A Lotion', detail: 'Possible match. Formula unverified.' }] });
  assert.deepEqual(mapFreeResolutionToCapture({ caseId: 'identified', state: 'identified_formula_unverified', product: { productId: 'p', brand: 'A', name: 'Lotion' }, candidates: [], nextAction: 'confirm_variant', requiresFounderReview: false }),
    { state: 'candidates', candidates: [{ id: 'identified:product', label: 'A Lotion', detail: 'Possible match. Formula unverified.' }] });
  assert.deepEqual(mapFreeResolutionToCapture({ caseId: 'unknown', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }),
    { state: 'insufficient_evidence', candidates: [] });
});

test('preparation failure never loops grants and reuses its request ID only on an explicit retry', async () => {
  const ids: string[] = [];
  let next = 0;
  const processor = createFreeEvidenceProcessor({
    readPhoto: async () => ({ bytes: JPEG.slice().buffer, mimeType: 'image/jpeg' }), createRequestId: () => `id-${++next}`,
    prepare: async (input) => { ids.push(input.requestId); throw new Error('opaque 429'); },
    upload: async () => { throw new Error('must not upload'); },
    resolve: async () => { throw new Error('must not resolve'); },
  });
  await assert.rejects(() => processor.process([photo]), { code: 'PREPARE_FAILED' });
  assert.deepEqual(ids, ['id-1']);
  await assert.rejects(() => processor.process([photo]), { code: 'PREPARE_FAILED' });
  assert.deepEqual(ids, ['id-1', 'id-1']);
});

test('S-FREE-4 upload helper uses its private target with immutable Storage options', async () => {
  const calls: unknown[] = [];
  const target = { bucket: 'customer-product-evidence' as const, storagePath: 'server-issued/private.jpg', role: 'front_label' as const, mimeType: 'image/jpeg' as const, maxBytes: 10 * 1024 * 1024 };
  const client = {
    functions: { invoke: async () => ({ data: null, error: null }) },
    storage: { from: (bucket: string) => ({ upload: async (path: string, bytes: ArrayBuffer, options: object) => { calls.push([bucket, path, bytes.byteLength, options]); return { error: null }; } }) },
  };
  await uploadFreeProductEvidence(target, JPEG.slice().buffer, client);
  assert.deepEqual(calls, [['customer-product-evidence', 'server-issued/private.jpg', JPEG.byteLength, { contentType: 'image/jpeg', upsert: false }]]);
});
