import assert from 'node:assert/strict';
import test from 'node:test';
import { verifiedProductTruth, unresolvedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import type { CatalogProductSummary } from '../src/contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';
import {
  catalogImagePresentation, buildScanResultSheet, isCurrentSheetBinding, selectCurrentSheetModel,
  isCurrentRequestedEvidenceAction,
} from '../src/presentation/check/result-sheet/model.ts';

const product: CatalogProductSummary = {
  productId: verifiedProductTruth.product!.productId, brand: 'Synthetic', name: 'Fixture Cleanser',
  category: 'cleanser', imageUrl: 'https://manufacturer.example/fixture.png',
  isCatalogStandard: true, variantCount: 1, formulaState: 'verified_variant_available',
};
const ingredientSnapshot = {
  ...verifiedProductTruth, state: 'identified_formula_unverified' as const,
  formula: null, catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null },
  nextRequiredEvidence: 'ingredients' as const, unknownFields: ['formula' as const],
};
const ingredientResolution: ProductResolutionResult = {
  caseId: ingredientSnapshot.resolutionCaseId, state: 'identified_formula_unverified',
  product: ingredientSnapshot.product!, candidates: [], nextAction: 'photograph_ingredients',
  requiresFounderReview: false,
};

test('catalog images require an approved HTTPS-shaped URL and otherwise show a neutral placeholder', () => {
  assert.deepEqual(catalogImagePresentation(product.imageUrl), { kind: 'catalog', uri: product.imageUrl });
  for (const value of [null, 'http://example.org/bottle.jpg', 'file:///private/bottle.jpg',
    'data:image/png;base64,test', 'https://user:password@example.org/bottle.jpg',
    'https://example.org/bottle.jpg?token=private', 'https://localhost/bottle.jpg']) {
    assert.deepEqual(catalogImagePresentation(value), { kind: 'placeholder' });
  }
});

test('verified package result uses exact product identity without a score or invented personal fit', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: verifiedProductTruth, catalogProduct: product });
  assert.equal(result.kind, 'result');
  if (result.kind !== 'result') return;
  assert.equal(result.title, 'Fixture Cleanser');
  assert.equal(result.brand, 'Synthetic');
  assert.equal(result.status, 'Exact formula verified');
  assert.deepEqual(result.image, { kind: 'catalog', uri: product.imageUrl });
  assert.equal(result.personalFit, null);
  assert.equal(result.binding.productId, product.productId);
  assert.equal(result.binding.formulaVersionId, verifiedProductTruth.formula!.formulaVersionId);
  assert.doesNotMatch(JSON.stringify(result), /\d+\/100|confidence score/i);
});

test('a different catalog product cannot put its image under the resolved identity', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: verifiedProductTruth,
    catalogProduct: { ...product, productId: 'different-product' } });
  assert.equal(result.kind, 'result');
  if (result.kind === 'result') assert.deepEqual(result.image, { kind: 'placeholder' });
});

test('unknown, ambiguous, and formula-only snapshots preserve uncertainty', () => {
  const unknown = buildScanResultSheet({ kind: 'snapshot', snapshot: unresolvedProductTruth, catalogProduct: product });
  const ambiguous = buildScanResultSheet({ kind: 'snapshot', snapshot: {
    ...unresolvedProductTruth, state: 'ambiguous_candidates', customerConfirmation: 'required',
  }, catalogProduct: product });
  const formulaOnly = buildScanResultSheet({ kind: 'snapshot', snapshot: formulaOnlyProductTruth, catalogProduct: product });
  for (const result of [unknown, ambiguous, formulaOnly]) {
    assert.equal(result.kind, 'result');
    if (result.kind === 'result') {
      assert.deepEqual(result.image, { kind: 'placeholder' });
      assert.equal(result.binding.productId, null);
      assert.equal(result.personalFit, null);
    }
  }
  if (ambiguous.kind === 'result') assert.match(ambiguous.title, /possible products/i);
  if (formulaOnly.kind === 'result') assert.match(formulaOnly.status, /product unconfirmed/i);
});

test('customer capture stays visibly unverified and is never treated as a catalog photo', () => {
  const local = buildScanResultSheet({ kind: 'snapshot', snapshot: unresolvedProductTruth,
    localCustomerPhotoUri: 'file:///private/capture.jpg' });
  assert.equal(local.kind, 'result');
  if (local.kind === 'result') assert.deepEqual(local.image, {
    kind: 'customer_unverified', uri: 'file:///private/capture.jpg', label: 'Your photo, unverified',
  });
  const remote = buildScanResultSheet({ kind: 'snapshot', snapshot: unresolvedProductTruth,
    localCustomerPhotoUri: 'https://private.example/signed?token=secret' });
  if (remote.kind === 'result') assert.deepEqual(remote.image, { kind: 'placeholder' });
});

test('loading and error remain recoverable without inventing an identity', () => {
  const loading = buildScanResultSheet({ kind: 'loading' });
  const error = buildScanResultSheet({ kind: 'error' });
  assert.equal(loading.kind, 'loading');
  assert.equal(error.kind, 'error');
  assert.doesNotMatch(JSON.stringify([loading, error]), /productId|formulaVersionId/);
});

test('detail action binding fails closed after case, snapshot, revision, owner, or product changes', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: verifiedProductTruth, ownerId: 'owner-a' });
  assert.equal(result.kind, 'result');
  if (result.kind !== 'result') return;
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-a', verifiedProductTruth), true);
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-b', verifiedProductTruth), false);
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-a', { ...verifiedProductTruth, snapshotId: 'new-snapshot' }), false);
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-a', { ...verifiedProductTruth, caseRevision: 2 }), false);
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-a', { ...verifiedProductTruth, resolutionCaseId: 'new-case' }), false);
  assert.equal(isCurrentSheetBinding(result.binding, 'owner-a', { ...verifiedProductTruth,
    product: { ...verifiedProductTruth.product!, productId: 'other-product' } }), false);
});

test('the sheet itself disappears if its owner or immutable case no longer matches the camera', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: verifiedProductTruth, ownerId: 'owner-a' });
  assert.equal(selectCurrentSheetModel(result, 'owner-a', verifiedProductTruth), result);
  assert.equal(selectCurrentSheetModel(result, 'owner-b', verifiedProductTruth), null);
  assert.equal(selectCurrentSheetModel(result, 'owner-a', unresolvedProductTruth), null);
  assert.equal(selectCurrentSheetModel(result, 'owner-a', null), null);
  assert.equal(selectCurrentSheetModel(buildScanResultSheet({ kind: 'loading' }), null, null)?.kind, 'loading');
});

test('an ambiguous snapshot cannot borrow a product identity even if stale fields are populated', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: {
    ...verifiedProductTruth, state: 'ambiguous_candidates',
  }, catalogProduct: product });
  assert.equal(result.kind, 'result');
  if (result.kind === 'result') {
    assert.equal(result.binding.productId, null);
    assert.deepEqual(result.image, { kind: 'placeholder' });
    assert.match(result.title, /possible products/i);
  }
});

test('only a matching authoritative ingredient-photo request exposes a typed add-evidence action', () => {
  const result = buildScanResultSheet({ kind: 'snapshot', snapshot: ingredientSnapshot,
    resolverResult: ingredientResolution, ownerId: 'owner-a' });
  assert.equal(result.kind, 'result');
  if (result.kind !== 'result') return;
  assert.deepEqual(result.requestedEvidence, {
    kind: 'add_requested_evidence', role: 'ingredients', binding: result.binding,
  });
  assert.equal(isCurrentRequestedEvidenceAction(result.requestedEvidence!, 'owner-a', ingredientSnapshot, ingredientResolution), true);
  assert.equal(isCurrentRequestedEvidenceAction(result.requestedEvidence!, 'owner-b', ingredientSnapshot, ingredientResolution), false);
  assert.equal(isCurrentRequestedEvidenceAction(result.requestedEvidence!, 'owner-a', ingredientSnapshot,
    { ...ingredientResolution, caseId: 'different-case' }), false);
});

test('case/state/product mismatch or non-requested capture never starts another evidence flow', () => {
  const variants: ProductResolutionResult[] = [
    { ...ingredientResolution, caseId: 'different-case' },
    { ...ingredientResolution, state: 'ambiguous_candidates' },
    { ...ingredientResolution, product: { ...ingredientResolution.product!, productId: 'different-product' } },
    { ...ingredientResolution, nextAction: 'manual_review' },
  ];
  for (const resolverResult of variants) {
    const result = buildScanResultSheet({ kind: 'snapshot', snapshot: ingredientSnapshot, resolverResult });
    if (result.kind === 'result') assert.equal(result.requestedEvidence, null);
  }
  const noSnapshotRequest = buildScanResultSheet({ kind: 'snapshot', snapshot: {
    ...ingredientSnapshot, nextRequiredEvidence: 'none',
  }, resolverResult: ingredientResolution });
  if (noSnapshotRequest.kind === 'result') assert.equal(noSnapshotRequest.requestedEvidence, null);
  const noResolver = buildScanResultSheet({ kind: 'snapshot', snapshot: ingredientSnapshot });
  if (noResolver.kind === 'result') assert.equal(noResolver.requestedEvidence, null);
});
