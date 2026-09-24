import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCaptureForCheck } from '../src/presentation/capture/checkCaptureAdapter.ts';
import { createCaptureSession, reduceCapture, toCaptureHandoff, type CaptureResult } from '../src/presentation/capture/productEvidence.ts';

test('barcode is a factual lookup input while photos remain local evidence', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  session = reduceCapture(session, { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'packaging', uri: 'file://package.jpg' });

  assert.deepEqual(mapCaptureForCheck(toCaptureHandoff(session)), {
    authority: 'customer_evidence',
    barcodeLookup: { barcode: '012345678905' },
    localPhotos: [
      { role: 'front_label', uri: 'file://front.jpg' },
      { role: 'ingredients', uri: 'file://ingredients.jpg' },
      { role: 'packaging', uri: 'file://package.jpg' },
    ],
    review: { state: 'pending', selectedCandidateId: null },
  });
});

test('photo only evidence cannot become barcode lookup or a verified identity', () => {
  const session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  const mapped = mapCaptureForCheck(toCaptureHandoff(session));
  assert.equal(mapped.barcodeLookup, null);
  assert.deepEqual(mapped.localPhotos, [{ role: 'ingredients', uri: 'file://ingredients.jpg' }]);
  assert.equal('verifiedProductId' in mapped, false);
  assert.equal('formulaId' in mapped, false);
});

test('unknown and ambiguous processor outcomes stay unresolved in the handoff', () => {
  const handoff = toCaptureHandoff(reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' }));
  const unknown: CaptureResult = { state: 'unknown', candidates: [] };
  const ambiguous: CaptureResult = { state: 'ambiguous', candidates: [{ id: 'candidate-a', label: 'Possible A' }] };
  assert.deepEqual(mapCaptureForCheck(handoff, unknown).review, { state: 'unknown', selectedCandidateId: null });
  assert.deepEqual(mapCaptureForCheck(handoff, ambiguous).review, { state: 'ambiguous', selectedCandidateId: null });
});

test('selection is carried as a customer choice and retake clears it', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  session = reduceCapture(session, { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'process' });
  const result: CaptureResult = { state: 'ambiguous', candidates: [{ id: 'candidate-a', label: 'Possible A' }] };
  session = reduceCapture(session, { type: 'resolved', result });
  session = reduceCapture(session, { type: 'confirm_candidate', candidateId: 'candidate-a' });
  assert.deepEqual(mapCaptureForCheck(toCaptureHandoff(session), result).review, { state: 'ambiguous', selectedCandidateId: 'candidate-a' });

  session = reduceCapture(session, { type: 'retake', role: 'front_label' });
  const retaken = mapCaptureForCheck(toCaptureHandoff(session));
  assert.deepEqual(retaken.localPhotos, []);
  assert.deepEqual(retaken.review, { state: 'pending', selectedCandidateId: null });
});

test('unmatched candidate IDs and malformed barcode evidence are not forwarded', () => {
  const mapped = mapCaptureForCheck({
    authority: 'customer_evidence',
    evidence: [{ role: 'barcode', kind: 'barcode', value: 'abc' }],
    selectedCandidateId: 'not-in-result',
  }, { state: 'candidates', candidates: [{ id: 'candidate-a', label: 'Possible A' }] });
  assert.equal(mapped.barcodeLookup, null);
  assert.deepEqual(mapped.review, { state: 'candidates', selectedCandidateId: null });
});
