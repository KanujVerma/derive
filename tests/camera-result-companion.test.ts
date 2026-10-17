import assert from 'node:assert/strict';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import test from 'node:test';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';
import { unresolvedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { selectCurrentSheetModel } from '../src/presentation/check/result-sheet/model.ts';
import { createCheckResultLifecycle } from '../src/presentation/check/result-sheet/lifecycle.ts';
import { cameraCompanionSheet, cameraResultNeedsExistingPage } from '../src/presentation/check/result-sheet/cameraCompanion.ts';

const scanId = '11111111-1111-4111-8111-111111111111';
const base = { awaiting: true, checking: false, ownerId: 'owner-1', scanId, error: null, resolution: null, catalogProduct: null };
const unbound = { caseId: unresolvedProductTruth.resolutionCaseId, state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false } as ProductResolutionResult;

test('the camera sheet loads, binds a snapshot, and refuses an unbound finished result', () => {
  assert.equal(cameraCompanionSheet({ ...base, awaiting: false })?.kind, undefined);
  assert.equal(cameraCompanionSheet({ ...base, checking: true })?.kind, 'loading');
  assert.equal(cameraCompanionSheet({ ...base, error: 'offline' })?.kind, 'error');
  const bound = cameraCompanionSheet({ ...base, resolution: { ...unbound, truthSnapshot: unresolvedProductTruth } });
  assert.equal(bound?.kind, 'result');
  assert.equal(cameraCompanionSheet(base), null);
  assert.equal(cameraResultNeedsExistingPage({ ...base, resolution: unbound }), true);
  assert.equal(cameraResultNeedsExistingPage({ ...base, checking: true, resolution: unbound }), false);
});

test('an ingredient follow-up cannot hand off an unbound or incomplete product result', async () => {
  const bridge = createCheckCaptureBridge({ async process() { return { state: 'insufficient_evidence', candidates: [] }; },
    resolutionFor: () => unbound });
  const evidence = [{ kind: 'local_photo' as const, role: 'ingredients' as const, value: 'file:///follow-up.jpg' }];
  await assert.rejects(bridge.processor.process(evidence));
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence }).resolvedCase, null);
  assert.equal(bridge.ingredientPanels.getState().phase, 'retake');
});

test('an unverified barcode miss still opens one transient recovery sheet bound to the current scan', () => {
  const miss = cameraCompanionSheet({ ...base, ownerId: null, unknownBarcode: '036000291452' });
  assert.equal(miss?.kind, 'unknown');
  assert.match(miss!.detail, /unverified/);
  assert.equal(cameraCompanionSheet({ ...base, awaiting: false, unknownBarcode: '036000291452' }), null);
});

test('scan fixture dismisses, rearms, and refuses the previous scan or snapshot after a second scan', () => {
  const lifecycle = createCheckResultLifecycle();
  const first = lifecycle.begin('owner-1', { kind: 'camera', sessionId: 'scan-one' }, 'request-one');
  const miss = cameraCompanionSheet({ ...base, scanId: 'scan-one', unknownBarcode: '036000291452' });
  assert.equal(selectCurrentSheetModel(miss, 'owner-1', null, 'scan-one'), miss);
  assert.deepEqual(lifecycle.dismiss(first, 'owner-1'), { kind: 'camera', sessionId: 'scan-one' });
  assert.equal(cameraCompanionSheet({ ...base, awaiting: false, scanId: 'scan-one' }), null);
  const second = lifecycle.begin('owner-1', { kind: 'camera', sessionId: 'scan-two' }, 'request-two');
  assert.equal(lifecycle.canPublish(first, 'owner-1'), false);
  assert.equal(lifecycle.canPublish(second, 'owner-1'), true);
  assert.equal(selectCurrentSheetModel(miss, 'owner-1', null, 'scan-two'), null);
  assert.equal(selectCurrentSheetModel(miss, 'owner-2', null, 'scan-one'), null);
  const snapshot = { ...unresolvedProductTruth, snapshotId: 'snapshot-two', resolutionCaseId: 'case-two' };
  const resolution = { ...unbound, caseId: 'case-two', truthSnapshot: snapshot };
  const result = cameraCompanionSheet({ ...base, scanId: 'scan-two', resolution });
  assert.equal(result?.kind, 'result');
  assert.equal(selectCurrentSheetModel(result, 'owner-1', snapshot, 'scan-two'), result);
  assert.equal(selectCurrentSheetModel(result, 'owner-1', unresolvedProductTruth, 'scan-two'), null);
  assert.equal(lifecycle.dismiss(first, 'owner-1'), null, 'an old dismiss cannot close the second scan');
});
