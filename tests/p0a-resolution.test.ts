import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProductIdentity, normalizeIngredientFingerprint } from '../supabase/functions/_shared/product-identity.ts';
import type { CatalogResolutionRecord } from '../supabase/functions/_shared/product-identity.ts';

const record: CatalogResolutionRecord = {
  productId: 'product', variantId: 'variant', formulaVersionId: 'formula',
  brand: 'Evidence Lab', name: 'Barrier Wash', variantName: 'Fragrance Free', regionCode: 'US',
  identifierType: 'gtin_12', identifierValue: '036000291452', identifierAuthority: 'gs1',
  identifierVerifiedAt: '2026-09-20T00:00:00Z', identifierFormulaVersionId: 'formula',
  formulaVerificationStatus: 'verified', formulaSourceReference: 'https://manufacturer.example/wash',
  formulaObservedAt: '2026-09-20T00:00:00Z',
  ingredientFingerprint: normalizeIngredientFingerprint(['Water', 'Glycerin']),
};

for (const evidence of [{ brand: 'Other Brand' }, { productName: 'Other Wash' }, { variantName: 'Original' }, { regionCode: 'GB' }]) {
  test(`barcode does not erase contradictory ${Object.keys(evidence)[0]}`, () => {
    const result = resolveProductIdentity({ barcode: record.identifierValue, ...evidence }, [record]);
    assert.equal(result.state, 'ambiguous_candidates');
    assert.equal(result.selected, undefined);
    assert.equal(result.requiresFounderReview, true);
    assert.deepEqual(result.conflicts, [Object.keys(evidence)[0] === 'regionCode' ? 'region_mismatch' : 'identity_mismatch']);
  });
}

test('contradictory ordered ingredients preserve identity and withhold formula authority', () => {
  const result = resolveProductIdentity({ barcode: record.identifierValue, ingredientList: ['Glycerin', 'Water'] }, [record]);
  assert.equal(result.state, 'identified_formula_unverified');
  assert.equal(result.selected?.variantId, record.variantId);
  assert.equal(result.selected?.formulaVersionId, undefined);
  assert.equal(result.requiresFounderReview, true);
  assert.deepEqual(result.conflicts, ['ingredient_mismatch']);
});

test('numeric manufacturer SKU and incorrectly typed/invalid GTIN never establish barcode authority', () => {
  for (const changed of [{ identifierType: 'manufacturer_sku' }, { identifierType: 'gtin_13' }, { identifierType: undefined }, { identifierValue: '036000291453' }]) {
    const result = resolveProductIdentity({ barcode: changed.identifierValue ?? record.identifierValue }, [{ ...record, ...changed }]);
    assert.equal(result.state, 'insufficient_evidence');
  }
});

test('duplicate assertions cannot make formula truth depend on row order', () => {
  const unlinked = { ...record, identifierFormulaVersionId: undefined };
  for (const catalog of [[unlinked, record], [record, unlinked]]) {
    assert.equal(resolveProductIdentity({ barcode: record.identifierValue }, catalog).state, 'verified_product_formula');
  }
});

test('reused barcode never promotes a reformulation merely from a customer ingredient match', () => {
  const reformulated = { ...record, formulaVersionId: 'formula-2', identifierFormulaVersionId: 'formula-2', ingredientFingerprint: normalizeIngredientFingerprint(['Water', 'Niacinamide']) };
  const result = resolveProductIdentity({ barcode: record.identifierValue, ingredientList: ['Water', 'Niacinamide'] }, [record, reformulated]);
  assert.equal(result.state, 'identified_formula_unverified');
  assert.equal(result.selected?.formulaVersionId, undefined);
  assert.equal(result.candidates.length, 2);
});

test('unknown catalog region does not invent a submitted market match', () => {
  const result = resolveProductIdentity({ barcode: record.identifierValue, regionCode: 'GB' }, [{ ...record, regionCode: undefined }]);
  assert.notEqual(result.state, 'verified_product_formula');
});

test('model and packaging resemblance alone remain candidates', () => {
  const result = resolveProductIdentity({ labelText: 'Evidence Lab Barrier Wash', packagingText: 'Fragrance Free US' }, [record]);
  assert.equal(result.state, 'ambiguous_candidates');
  assert.equal(result.selected, undefined);
});

test('matching submitted evidence preserves authoritative verified resolution', () => {
  const result = resolveProductIdentity({ barcode: record.identifierValue, brand: 'evidence lab', productName: 'Barrier Wash', variantName: 'Fragrance-Free', regionCode: 'us', ingredientList: ['Water', 'Glycerin'] }, [record]);
  assert.equal(result.state, 'verified_product_formula');
  assert.equal(result.conflicts, undefined);
});

test('incomplete catalog labels never verify formula truth', () => {
  for (const field of ['brand', 'name', 'variantName', 'productId', 'variantId'] as const) {
    assert.notEqual(resolveProductIdentity({ barcode: record.identifierValue }, [{ ...record, [field]: undefined }]).state, 'verified_product_formula');
  }
});

test('identifier reused across variants preserves an explicit identifier conflict', () => {
  const result = resolveProductIdentity({ barcode: record.identifierValue }, [record, { ...record, variantId: 'variant-2', formulaVersionId: 'formula-2', identifierFormulaVersionId: 'formula-2' }]);
  assert.equal(result.state, 'ambiguous_candidates');
  assert.deepEqual(result.conflicts, ['identifier_conflict']);
});
