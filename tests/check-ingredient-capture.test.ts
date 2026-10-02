import assert from 'node:assert/strict';
import test from 'node:test';
import { createIngredientContinuationProcessor } from '../src/presentation/capture/ingredientContinuationProcessor.ts';
import { verifiedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { buildScanResultSheet } from '../src/presentation/check/result-sheet/model.ts';
import type { ContinueProductIngredientsInput, ContinueProductIngredientsResult, ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';
const snapshot = { ...verifiedProductTruth, state: 'identified_formula_unverified' as const, formula: null,
  nextRequiredEvidence: 'ingredients' as const, catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null } };
const root: ProductResolutionResult = { caseId: snapshot.resolutionCaseId, state: snapshot.state, product: snapshot.product!,
  nextAction: 'photograph_ingredients', candidates: [], requiresFounderReview: false, truthSnapshot: snapshot };
const model = buildScanResultSheet({ kind: 'snapshot', snapshot, resolverResult: root, ownerId: 'owner-a' });
if (model.kind !== 'result' || !model.requestedEvidence) throw new Error('Missing bound request');
const action = model.requestedEvidence;
const evidence = [{ kind: 'barcode' as const, role: 'barcode' as const, value: '036000291452' },
  { kind: 'local_photo' as const, role: 'front_label' as const, value: 'file:///front.jpg' },
  { kind: 'local_photo' as const, role: 'ingredients' as const, value: 'file:///ingredients.jpg' }];
const child: ContinueProductIngredientsResult = { ...root, caseId: 'child-case', attemptId: root.caseId, attemptRevision: 2,
  parentSnapshotId: snapshot.snapshotId, truthSnapshot: { ...snapshot, resolutionCaseId: 'child-case', snapshotId: 'child-snapshot' } };
function setup() {
  let owner = 'owner-a', current = true, calls = 0, uploads = 0, fail = false;
  const requests: ContinueProductIngredientsInput[] = [];
  let result = child;
  const processor = createIngredientContinuationProcessor(action, () => current, {
    getOwnerId: () => owner, createRequestId: () => `request-${++calls}`,
    readPhoto: async uri => { assert.equal(uri, 'file:///ingredients.jpg'); return { mimeType: 'image/jpeg', bytes: new ArrayBuffer(2) }; },
    prepare: async input => ({ ...input, bucket: 'customer-product-evidence', storagePath: 'private/ingredients.jpg', maxBytes: 100, expiresAt: 'later', uploadToken: 'fake' }),
    upload: async () => { uploads++; }, continueIngredients: async input => { requests.push(input); if (fail) throw new Error('offline'); return result; },
  });
  return { processor, requests, uploads: () => uploads, setOwner: (value: string) => { owner = value; }, cancel: () => { current = false; }, fail: (value: boolean) => { fail = value; }, result: (value: ContinueProductIngredientsResult) => { result = value; } };
}
test('requested ingredient photo uses the exact parent and preserves identity without another identification', async () => {
  const s = setup(); const review = await s.processor.process(evidence);
  assert.equal(s.requests.length, 1); assert.equal(s.uploads(), 1);
  assert.deepEqual(s.requests[0], { operation: 'continue_ingredients', requestId: 'request-2', rootCaseId: root.caseId,
    parentSnapshotId: snapshot.snapshotId, evidencePhoto: { storagePath: 'private/ingredients.jpg', role: 'ingredients' } });
  assert.equal(s.processor.resolutionFor(review), child);
  assert.equal(child.state, 'identified_formula_unverified', 'a photo alone invents no verified formula');
});
test('response-loss retry keeps request/photo upload identity stable', async () => {
  const s = setup(); s.fail(true); await assert.rejects(s.processor.process(evidence)); s.fail(false);
  await s.processor.process(evidence); assert.equal(s.uploads(), 1); assert.deepEqual(s.requests[0], s.requests[1]);
});
test('cancellation/account changes cannot publish or resolve retained photos', async () => {
  for (const cancel of [false, true]) {
    const s = setup(); const review = await s.processor.process(evidence);
    if (cancel) s.cancel(); else s.setOwner('owner-b');
    assert.equal(s.processor.resolutionFor(review), null);
    await assert.rejects(s.processor.process(evidence)); assert.equal(s.requests.length, 1);
  }
});
test('wrong parent, child revision or product cannot become the displayed continuation', async () => {
  for (const changed of [{ ...child, parentSnapshotId: 'another-snapshot' }, { ...child, attemptId: 'other-case' },
    { ...child, product: { ...child.product!, productId: 'other-product' } }]) {
    const s = setup(); s.result(changed); await assert.rejects(s.processor.process(evidence));
  }
});
