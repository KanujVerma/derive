import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRecoveryPlan } from '../src/presentation/check/result-sheet/evidenceRecovery.ts';
import { unresolvedProductTruth, verifiedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';
import { mapCaptureForCheck } from '../src/presentation/capture/checkCaptureAdapter.ts';
import { createCaptureSession, reduceCapture, toCaptureHandoff } from '../src/presentation/capture/productEvidence.ts';
const base = { loading: false, error: null, resolution: null, unknownBarcode: null, hasPhotos: false, hasCatalogIdentity: false };
const result = (state: ProductResolutionResult['state'], nextAction: ProductResolutionResult['nextAction'] = 'manual_review'): ProductResolutionResult => ({
  caseId: unresolvedProductTruth.resolutionCaseId, state, candidates: [], nextAction, requiresFounderReview: false });
test('unmatched barcode and entered name offer compact front-label and name recovery', () => {
  for (const input of [{ unknownBarcode: '036000291452' }, { enteredName: true }, { linkNeedsDetails: true }, { resolution: result('insufficient_evidence') }]) {
    assert.deepEqual(checkRecoveryPlan({ ...base, ...input }), { photoRole: 'front_label', search: true, retry: false });
  }
});
test('ambiguous identity and conflicts ask for the package, while known identity requests ingredients only', () => {
  assert.equal(checkRecoveryPlan({ ...base, resolution: result('ambiguous_candidates') }).photoRole, 'front_label');
  assert.deepEqual(checkRecoveryPlan({ ...base, resolution: result('identified_formula_unverified', 'photograph_ingredients') }), { photoRole: 'ingredients', search: false, retry: false });
  const conflict = { ...result('identified_formula_unverified', 'photograph_ingredients'), truthSnapshot: { ...unresolvedProductTruth, conflicts: [{ code: 'identity_mismatch' as const, status: 'unresolved' as const }] } };
  assert.equal(checkRecoveryPlan({ ...base, resolution: conflict }).photoRole, 'front_label');
});
test('transport/auth failure uses Retry, and loading never duplicates recovery actions', () => {
  assert.deepEqual(checkRecoveryPlan({ ...base, hasPhotos: true, unknownBarcode: '036000291452', error: 'Service unavailable' }), { photoRole: null, search: false, retry: true });
  assert.deepEqual(checkRecoveryPlan({ ...base, loading: true, error: 'offline' }), { photoRole: null, search: false, retry: false });
});
test('verified facts with unsupported category/goal or missing optional context do not request more photos', () => {
  const verified = { ...result('verified_product_formula'), truthSnapshot: verifiedProductTruth };
  assert.deepEqual(checkRecoveryPlan({ ...base, resolution: verified }), { photoRole: null, search: false, retry: false });
});
test('photo recovery retains observed barcode and other roles, and retake replaces only its target', () => {
  let session = reduceCapture(createCaptureSession(), { type: 'barcode', value: '036000291452' });
  session = reduceCapture(session, { type: 'photo', role: 'front_label', uri: 'file:///front.jpg' });
  session = reduceCapture(session, { type: 'photo', role: 'ingredients', uri: 'file:///ingredients.jpg' });
  session = reduceCapture(session, { type: 'retake', role: 'front_label' });
  const handoff = mapCaptureForCheck(toCaptureHandoff(session));
  assert.equal(handoff.evidence?.find(item => item.role === 'barcode')?.value, '036000291452');
  assert.deepEqual(handoff.localPhotos, [{ role: 'ingredients', uri: 'file:///ingredients.jpg' }]);
  assert.equal(handoff.barcodeLookup, null, 'mixed evidence never becomes a barcode-only resolve');
});
