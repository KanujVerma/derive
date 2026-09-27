import assert from 'node:assert/strict';
import test from 'node:test';
import { describeProductTruth } from '../src/presentation/capture/productTruthPresentation.ts';
import { unresolvedProductTruth, verifiedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';

test('truth presentation separates package formula from personal suitability', () => {
  for (const snapshot of [unresolvedProductTruth, verifiedProductTruth, formulaOnlyProductTruth]) {
    const view = describeProductTruth(snapshot);
    assert.ok(view.title && view.detail && view.nextAction);
    assert.doesNotMatch(view.detail, /safe for you|recommended for you|score/i);
    if (snapshot.state === 'formula_only') assert.match(view.title, /product unconfirmed/);
    if (snapshot.state === 'insufficient_evidence') assert.match(view.detail, /does not mean.*unsafe/);
  }
});
