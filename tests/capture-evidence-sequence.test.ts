import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptureSession, nextPhotoRole, reduceCapture } from '../src/presentation/capture/productEvidence.ts';

test('saving a front photo suggests ingredients without losing the front', () => {
  const front = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  assert.equal(nextPhotoRole(front), 'ingredients');
  const withIngredients = reduceCapture(front, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  assert.deepEqual(withIngredients.evidence.map((item) => item.role), ['front_label', 'ingredients']);
  assert.equal(nextPhotoRole(withIngredients), 'packaging');
  const full = reduceCapture(withIngredients, { type: 'photo', role: 'packaging', uri: 'file://package.jpg' });
  assert.equal(nextPhotoRole(full), null);
  assert.equal(full.evidence.length, 3);
});

test('a barcode does not consume one of the three photo slots', () => {
  const barcode = reduceCapture(createCaptureSession(), { type: 'barcode', value: '012345678905' });
  assert.equal(nextPhotoRole(barcode), 'front_label');
  const ingredients = reduceCapture(barcode, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  assert.equal(nextPhotoRole(ingredients), 'front_label');
});

test('rapid duplicate photo commits cannot add a fourth photo or erase another role', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  assert.deepEqual(session.evidence.map((item) => item.role), ['front_label', 'ingredients']);
  assert.equal(session.evidence.find((item) => item.role === 'front_label')?.value, 'file://front.jpg');
});

test('retaking one role reopens that slot and preserves other photos', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file://ingredients.jpg' });
  session = reduceCapture(session, { type: 'retake', role: 'ingredients' });
  assert.equal(nextPhotoRole(session), 'ingredients');
  assert.deepEqual(session.evidence.map((item) => item.role), ['front_label']);
});

test('correcting a preview role keeps an earlier photo and avoids duplicate roles', () => {
  const front = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  const corrected = reduceCapture(front, { type: 'photo', role: 'packaging', uri: 'file://package.jpg' });
  assert.deepEqual(corrected.evidence.map((item) => item.role), ['front_label', 'packaging']);
  assert.equal(nextPhotoRole(corrected), 'ingredients');
});

test('insufficient evidence can resume collection with earlier photos intact', () => {
  const front = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'file://front.jpg' });
  const processing = reduceCapture(front, { type: 'process' });
  const insufficient = reduceCapture(processing, { type: 'resolved', result: { state: 'insufficient_evidence', candidates: [] } });
  const resumed = reduceCapture(insufficient, { type: 'collect_more' });
  assert.equal(resumed.phase, 'collecting');
  assert.equal(nextPhotoRole(resumed), 'ingredients');
  assert.deepEqual(resumed.evidence, [{ role: 'front_label', kind: 'local_photo', value: 'file://front.jpg' }]);
});
