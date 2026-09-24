import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogProductDetail } from '../src/contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';

const target = await import('../src/presentation/personalization/fitTarget.ts').catch(() => ({} as Record<string, unknown>));
const detail: CatalogProductDetail = {
  productId: 'p1', brand: 'Brand', name: 'Cream', category: 'moisturizer',
  imageUrl: null, isCatalogStandard: true, variantCount: 1, formulaState: 'verified_variant_available',
  sourceReference: null, observedAt: '2026-09-24', variants: [{
    variantId: 'v1', name: 'Original', regionCode: null, packageSize: null,
    sourceReference: null, observedAt: '2026-09-24', verificationState: 'verified',
    formulaState: 'verified', formula: { formulaVersionId: 'f1', ingredients: ['Water'],
      provenanceType: 'package_label', sourceReference: null, observedAt: '2026-09-24' },
  }],
};
const resolution: ProductResolutionResult = {
  caseId: 'c1', state: 'verified_product_formula', product: { productId: 'p1',
    brand: 'Brand', name: 'Cream', variantId: 'v1' },
  formula: { formulaVersionId: 'f1', verificationStatus: 'verified', sourceReference: 'https://example.com', observedAt: '2026-09-24' },
  candidates: [], nextAction: 'evaluate_product_fit', requiresFounderReview: false,
};

test('K2/S2 passes variant only for the exact verified product formula', () => {
  assert.equal(typeof target.selectFreeFitTarget, 'function');
  const select = target.selectFreeFitTarget as (d: CatalogProductDetail | null, r: ProductResolutionResult | null) => unknown;
  assert.deepEqual(select(detail, resolution), { productId: 'p1', variantId: 'v1' });
  assert.deepEqual(select(detail, { ...resolution, state: 'identified_formula_unverified' }), { productId: 'p1' });
  assert.deepEqual(select(detail, { ...resolution, formula: { ...resolution.formula!, formulaVersionId: 'other' } }), { productId: 'p1' });
  assert.equal(select(detail, { ...resolution, product: { ...resolution.product!, productId: 'other' } }), null);
  assert.equal(select(null, resolution), null);
});
