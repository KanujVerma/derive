import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasVerifiedPackageFormula } from '../src/contracts/ProductTruthSnapshot.ts';
import { unresolvedProductTruth, verifiedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';

test('only verified package identity and exact formula can cross the P0-B formula boundary', () => {
  assert.equal(hasVerifiedPackageFormula(verifiedProductTruth), true);
  assert.equal(hasVerifiedPackageFormula(unresolvedProductTruth), false);
  assert.equal(hasVerifiedPackageFormula(formulaOnlyProductTruth), false);
});
test('conflicts or catalog-reference substitution fail closed', () => {
  assert.equal(hasVerifiedPackageFormula({ ...verifiedProductTruth, conflicts: [{ code: 'ingredient_mismatch', status: 'unresolved' }] }), false);
  assert.equal(hasVerifiedPackageFormula({ ...verifiedProductTruth, catalogReferences: { ...verifiedProductTruth.catalogReferences, variantId: null } }), false);
});
test('fixtures preserve ingredient order and contain no customer input or private paths', () => {
  assert.deepEqual(verifiedProductTruth.formula!.ingredients, ['Water', 'Glycerin']);
  for (const snapshot of [verifiedProductTruth, unresolvedProductTruth, formulaOnlyProductTruth]) {
    assert.equal(snapshot.schemaVersion, 1);
    assert.doesNotMatch(JSON.stringify(snapshot), /storagePath|extractedText|file:\/\/|confidence|score/);
  }
});
