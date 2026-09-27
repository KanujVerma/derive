import assert from 'node:assert/strict';
import test from 'node:test';
import { createFreeEvidenceProcessor, CaptureProcessingError } from '../src/presentation/capture/freeEvidenceProcessor.ts';
import { captureRecovery } from '../src/presentation/capture/captureRecovery.ts';
import { FreeProductEvidenceDailyLimitError } from '../src/services/remote/freeProductEvidence.ts';
import type { CaptureEvidence } from '../src/presentation/capture/productEvidence.ts';

const photo: CaptureEvidence = { kind: 'local_photo', role: 'front_label', value: 'file://private-capture' };
const result = { caseId: 'case', state: 'insufficient_evidence' as const, candidates: [], nextAction: 'manual_review' as const, requiresFounderReview: false };
function dependencies() {
  return {
    createRequestId: () => 'request-id',
    readPhoto: async () => ({ bytes: new Uint8Array([1]).buffer, mimeType: 'image/jpeg' as const }),
    prepare: async () => ({ bucket: 'customer-product-evidence' as const, storagePath: 'owner/free_scan/front_label/image.jpg', role: 'front_label' as const, mimeType: 'image/jpeg' as const, maxBytes: 10 * 1024 * 1024 }),
    upload: async () => {},
    resolve: async () => result,
  };
}

test('typed daily quota stops before upload/resolve, without issuing automatic retries or replacement IDs', async () => {
  const ids: string[] = [];
  const processor = createFreeEvidenceProcessor({ ...dependencies(),
    prepare: async ({ requestId }) => { ids.push(requestId); throw new FreeProductEvidenceDailyLimitError(); },
    upload: async () => { assert.fail('must not upload'); },
    resolve: async () => { assert.fail('must not resolve'); },
  });
  await assert.rejects(() => processor.process([photo]), { code: 'DAILY_LIMIT' });
  assert.deepEqual(ids, ['request-id']);
  assert.equal(captureRecovery(new CaptureProcessingError('DAILY_LIMIT')).canRetry, false);
  assert.equal(captureRecovery(new CaptureProcessingError('DAILY_LIMIT')).canCollectMore, false);
  // A later explicit call preserves the original request identity.
  await assert.rejects(() => processor.process([photo]), { code: 'DAILY_LIMIT' });
  assert.deepEqual(ids, ['request-id', 'request-id']);
});

test('opaque quota-shaped errors stay generic and raw private error text never reaches recovery copy', async () => {
  const processor = createFreeEvidenceProcessor({ ...dependencies(), prepare: async () => { throw { code: 'DAILY_LIMIT', message: 'file://secret-private-path' }; } });
  await assert.rejects(() => processor.process([photo]), { code: 'PREPARE_FAILED' });
  assert.deepEqual(captureRecovery(new Error('file://secret-private-path')), {
    message: 'We could not review this evidence yet. Your captures are still here.', canRetry: true, canCollectMore: true,
  });
  for (const code of ['PHOTO_TOO_LARGE', 'PHOTO_MIME_UNSUPPORTED', 'ACCOUNT_CHANGED'] as const) {
    assert.equal(captureRecovery(new CaptureProcessingError(code)).canRetry, false);
  }
});

test('owner loss or switch at each asynchronous photo boundary blocks subsequent calls and stale results', async () => {
  for (const phase of ['readPhoto', 'prepare', 'upload', 'resolve'] as const) {
    for (const nextOwner of ['owner-b', null]) {
      let owner: string | null = 'owner-a';
      const calls: string[] = [];
      const deps = dependencies();
      const processor = createFreeEvidenceProcessor({ ...deps, getOwnerId: () => owner,
        readPhoto: async () => { calls.push('readPhoto'); const value = await deps.readPhoto(); if (phase === 'readPhoto') owner = nextOwner; return value; },
        prepare: async () => { calls.push('prepare'); const value = await deps.prepare(); if (phase === 'prepare') owner = nextOwner; return value; },
        upload: async () => { calls.push('upload'); if (phase === 'upload') owner = nextOwner; },
        resolve: async () => { calls.push('resolve'); if (phase === 'resolve') owner = nextOwner; return result; },
      });
      await assert.rejects(() => processor.process([photo]), { code: 'ACCOUNT_CHANGED' });
      assert.deepEqual(calls, ['readPhoto', 'prepare', 'upload', 'resolve'].slice(0, ['readPhoto', 'prepare', 'upload', 'resolve'].indexOf(phase) + 1));
      await assert.rejects(() => processor.process([photo]), { code: 'ACCOUNT_CHANGED' });
    }
  }
});

test('live null identity fails closed; barcode results and saved reviews cannot cross owners', async () => {
  const signedOut = createFreeEvidenceProcessor({ ...dependencies(), getOwnerId: () => null, resolve: async () => { assert.fail('must not resolve'); } });
  await assert.rejects(() => signedOut.process([photo]), { code: 'ACCOUNT_CHANGED' });
  let owner = 'owner-a';
  const processor = createFreeEvidenceProcessor({ ...dependencies(), getOwnerId: () => owner });
  const review = await processor.process([photo]);
  assert.equal(processor.resolutionFor(review), result);
  owner = 'owner-b';
  assert.equal(processor.resolutionFor(review), null);
  const barcodeProcessor = createFreeEvidenceProcessor({ ...dependencies(), getOwnerId: () => owner,
    resolve: async () => { owner = 'owner-c'; return result; },
  });
  await assert.rejects(() => barcodeProcessor.process([{ kind: 'barcode', role: 'barcode', value: '012345678905' }]), { code: 'ACCOUNT_CHANGED' });
});
