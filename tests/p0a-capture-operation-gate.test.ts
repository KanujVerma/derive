import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptureOperationGate } from '../src/presentation/capture/captureOperationGate.ts';
import { createFreeEvidenceProcessor } from '../src/presentation/capture/freeEvidenceProcessor.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

test('rapid review taps cannot issue extra prepare or immutable upload while review is pending', async () => {
  const gate = createCaptureOperationGate();
  const uploading = deferred<void>();
  let prepares = 0;
  let uploads = 0;
  let resolves = 0;
  const processor = createFreeEvidenceProcessor({
    createRequestId: () => 'id',
    readPhoto: async () => ({ bytes: new Uint8Array([1]).buffer, mimeType: 'image/jpeg' }),
    prepare: async () => { prepares++; return { bucket: 'customer-product-evidence', storagePath: 'owner/private.jpg', role: 'front_label', mimeType: 'image/jpeg', maxBytes: 10485760 }; },
    upload: async () => { uploads++; await uploading.promise; },
    resolve: async () => { resolves++; return { caseId: 'case', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }; },
  });
  const review = () => gate.run(async () => processor.process([{ kind: 'local_photo', role: 'front_label', value: 'file://private' }]));
  const first = review();
  assert.equal(await review(), undefined);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(prepares, 1);
  assert.equal(uploads, 1);
  assert.equal(resolves, 0);
  assert.equal(await review(), undefined);
  uploading.resolve();
  await first;
  assert.equal(resolves, 1);
  assert.equal(gate.isBusy(), false);
});

test('pending camera capture blocks role changes and review, then retains its original photo role', async () => {
  const gate = createCaptureOperationGate();
  const camera = deferred<string>();
  let role = 'front_label';
  let preview: { role: string; uri: string } | null = null;
  const taking = gate.run(async (isCurrent) => {
    const uri = await camera.promise;
    if (isCurrent()) preview = { role, uri };
  });
  gate.whenIdle(() => { role = 'ingredients'; });
  assert.equal(await gate.run(async () => assert.fail('review must not start')), undefined);
  camera.resolve('file://front');
  await taking;
  assert.deepEqual(preview, { role: 'front_label', uri: 'file://front' });
  gate.whenIdle(() => { role = 'ingredients'; });
  assert.equal(role, 'ingredients');
});

test('failure releases the operation gate for a customer retry', async () => {
  const gate = createCaptureOperationGate();
  await assert.rejects(gate.run(async () => { throw new Error('unavailable'); }));
  assert.equal(gate.isBusy(), false);
  assert.equal(await gate.run(async () => 'retry'), 'retry');
});

test('close or unmount invalidates pending results and old completion cannot unlock newer work', async () => {
  const gate = createCaptureOperationGate();
  const old = deferred<void>();
  const current = deferred<void>();
  let stalePresented = false;
  const first = gate.run(async (isCurrent) => { await old.promise; stalePresented = isCurrent(); });
  gate.cancel();
  const second = gate.run(async () => current.promise);
  old.resolve();
  await first;
  assert.equal(stalePresented, false);
  assert.equal(gate.isBusy(), true);
  current.resolve();
  await second;
  assert.equal(gate.isBusy(), false);
});
