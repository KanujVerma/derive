import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import { createCaptureSession, reduceCapture, toCaptureHandoff, type CaptureResult } from '../src/presentation/capture/productEvidence.ts';

test('bridge passes the current processor outcome through a route independent handoff', async () => {
  const result: CaptureResult = { state: 'ambiguous', candidates: [{ id: 'candidate-a', label: 'Possible A' }] };
  const bridge = createCheckCaptureBridge({ async process() { return result; } });
  let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  assert.deepEqual(await bridge.processor.process(session.evidence), result);
  session = reduceCapture(session, { type: 'process' });
  session = reduceCapture(session, { type: 'resolved', result });
  session = reduceCapture(session, { type: 'confirm_candidate', candidateId: 'candidate-a' });
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).review, { state: 'ambiguous', selectedCandidateId: 'candidate-a' });
});

test('bridge does not attach an old result after evidence is retaken', async () => {
  const bridge = createCheckCaptureBridge({ async process() { return { state: 'unknown', candidates: [] }; } });
  let session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://old.jpg' });
  await bridge.processor.process(session.evidence);
  session = reduceCapture(session, { type: 'retake', role: 'front_label' });
  session = reduceCapture(session, { type: 'photo', role: 'front_label', uri: 'file://new.jpg' });
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).review, { state: 'pending', selectedCandidateId: null });
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).localPhotos, [{ role: 'front_label', uri: 'file://new.jpg' }]);
});

test('processor errors remain pending evidence without exposing the error', async () => {
  const bridge = createCheckCaptureBridge({ async process() { throw new Error('secret remote detail'); } });
  const session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  await assert.rejects(bridge.processor.process(session.evidence));
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).review, { state: 'insufficient_evidence', selectedCandidateId: null });
});

test('older processing completion cannot replace a newer review', async () => {
  const resolves: ((result: CaptureResult) => void)[] = [];
  const bridge = createCheckCaptureBridge({
    process() { return new Promise<CaptureResult>((resolve) => { resolves.push(resolve); }); },
  });
  const session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  const first = bridge.processor.process(session.evidence);
  const second = bridge.processor.process(session.evidence);
  resolves[1]({ state: 'unknown', candidates: [] });
  await second;
  resolves[0]({ state: 'candidates', candidates: [{ id: 'stale', label: 'Stale' }] });
  await first;
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).review, { state: 'unknown', selectedCandidateId: null });
});

test('photo handoff carries the matching S6 case and drops it after retake', async () => {
  const resolution = { caseId: 'case', state: 'ambiguous_candidates' as const, candidates: [], nextAction: 'choose_candidate' as const, requiresFounderReview: false };
  const review: CaptureResult = { state: 'ambiguous', candidates: [{ id: 'case:0', label: 'Possible A' }] };
  const bridge = createCheckCaptureBridge({
    async process() { return review; },
    resolutionFor(result) { return result === review ? resolution : null; },
  });
  let session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://old.jpg' });
  await bridge.processor.process(session.evidence);
  assert.deepEqual(bridge.handoff(toCaptureHandoff(session)).resolvedCase, resolution);
  session = reduceCapture(session, { type: 'retake', role: 'front_label' });
  assert.equal(bridge.handoff(toCaptureHandoff(session)).resolvedCase, null);
});
