import assert from 'node:assert/strict';
import test from 'node:test';
import { captureRoles, createCaptureSession, reduceCapture, toCaptureHandoff } from '../src/presentation/capture/productEvidence.ts';
import { fixtureCaptureProcessor } from '../src/fixtures/capture/fixtureCaptureProcessor.ts';

test('four roles retain distinct evidence and retake replaces only one role', () => {
  let session = createCaptureSession();
  session = reduceCapture(session, { type: 'barcode', value: '012345678905' });
  for (const role of captureRoles.filter((role) => role !== 'barcode')) {
    session = reduceCapture(session, { type: 'photo', role, uri: `file://${role}-old.jpg` });
  }
  assert.deepEqual(session.evidence.map((item) => item.role), captureRoles);
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file://ingredients-new.jpg' });
  assert.equal(session.evidence.length, 4);
  assert.equal(session.evidence.find((item) => item.role === 'ingredients')?.value, 'file://ingredients-new.jpg');
  assert.equal(session.evidence.find((item) => item.role === 'front_label')?.value, 'file://front_label-old.jpg');
});

test('processing and candidate confirmation preserve evidence-only authority', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'process' });
  assert.equal(session.phase, 'processing');
  session = reduceCapture(session, { type: 'resolved', result: { state: 'candidates', candidates: [{ id: 'a', label: 'A Cream' }] } });
  assert.equal(session.phase, 'candidates');
  session = reduceCapture(session, { type: 'confirm_candidate', candidateId: 'a' });
  assert.equal(session.phase, 'candidate_selected');
  const handoff = toCaptureHandoff(session);
  assert.equal(handoff.selectedCandidateId, 'a');
  assert.equal(handoff.authority, 'customer_evidence');
  assert.equal('verifiedProductId' in handoff, false);
  assert.equal('formulaId' in handoff, false);
});

test('ambiguous, unknown and insufficient outcomes remain unresolved', () => {
  for (const state of ['ambiguous', 'unknown', 'insufficient_evidence'] as const) {
    let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '000000000000' });
    session = reduceCapture(session, { type: 'process' });
    session = reduceCapture(session, { type: 'resolved', result: { state, candidates: [] } });
    assert.equal(session.phase, state);
    assert.equal(toCaptureHandoff(session).selectedCandidateId, undefined);
  }
});

test('fixture processor produces candidate examples only when explicitly selected', async () => {
  const evidence = reduceCapture(createCaptureSession(), { type: 'photo', role: 'packaging', uri: 'file://box.jpg' }).evidence;
  assert.equal((await fixtureCaptureProcessor.process(evidence, 'unknown')).state, 'unknown');
  assert.equal((await fixtureCaptureProcessor.process(evidence, 'ambiguous')).state, 'ambiguous');
  assert.equal((await fixtureCaptureProcessor.process(evidence, 'candidate')).state, 'candidates');
});

test('empty capture cannot process or select a candidate', () => {
  const empty = createCaptureSession();
  assert.equal(reduceCapture(empty, { type: 'process' }).phase, 'collecting');
  assert.equal(reduceCapture(empty, { type: 'confirm_candidate', candidateId: 'invented' }).selectedCandidateId, undefined);
});

test('retake after candidate selection clears the choice but retains other evidence', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  session = reduceCapture(session, { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'process' });
  session = reduceCapture(session, { type: 'resolved', result: { state: 'candidates', candidates: [{ id: 'a', label: 'A Cream' }] } });
  session = reduceCapture(session, { type: 'confirm_candidate', candidateId: 'a' });
  session = reduceCapture(session, { type: 'retake', role: 'front_label' });
  assert.equal(session.phase, 'collecting');
  assert.equal(session.selectedCandidateId, undefined);
  assert.deepEqual(session.evidence.map((item) => item.role), ['barcode']);
});
