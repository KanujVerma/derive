import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCatalogRequest,
  projectCatalogSummary,
  resolveCatalogFormula,
  publicSourceReference,
} from '../supabase/functions/catalog-products/catalog.ts';

const productId = 'a1100000-0000-4000-8000-000000000001';
const variantId = 'a1200000-0000-4000-8000-000000000001';
const formulaId = 'a1300000-0000-4000-8000-000000000001';

test('Catalog API: search requires two visible characters and bounds result count', () => {
  assert.deepEqual(parseCatalogRequest({ operation: 'search', query: ' Ce ', limit: 50 }), {
    operation: 'search', query: 'Ce', limit: 20,
  });
  assert.deepEqual(parseCatalogRequest({ operation: 'search', query: 'x' }), {
    operation: 'search', query: '', limit: 10,
  });
  assert.throws(() => parseCatalogRequest({ operation: 'search', query: 'a'.repeat(81) }));
  assert.throws(() => parseCatalogRequest({ operation: 'search', query: 'CeraVe', userId: 'other-user' }));
});

test('Catalog API: detail accepts only a catalog UUID and optional variant UUID', () => {
  assert.deepEqual(parseCatalogRequest({ operation: 'detail', productId, variantId }), {
    operation: 'detail', productId, variantId,
  });
  assert.throws(() => parseCatalogRequest({ operation: 'detail', productId: 'not-a-uuid' }));
  assert.throws(() => parseCatalogRequest({ operation: 'detail', productId, secret: 'member-data' }));
});

test('Catalog API: summary projection cannot leak member or private fields', () => {
  const result = projectCatalogSummary({
    product_id: productId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser',
    image_url: 'https://manufacturer.example/image.jpg', variant_count: 0,
    formula_state: 'unverified', user_id: 'private-member', full_ingredients: ['private'],
  });
  assert.deepEqual(result, {
    productId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser',
    imageUrl: null, variantCount: 0,
    formulaState: 'unverified', isCatalogStandard: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /private|user_id|full_ingredients/);
  assert.equal(projectCatalogSummary({ ...{ product_id: productId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser', variant_count: 1 }, formula_state: 'multiple_versions' }).formulaState, 'multiple_versions');
});

test('Catalog API: formula details require one S6 verified identifier link', () => {
  const formula = {
    id: formulaId, variant_id: variantId, ingredients: ['Water', 'Glycerin'],
    provenance_type: 'manufacturer', source_reference: 'https://manufacturer.example/formula',
    catalog_public_source_url: 'https://manufacturer.example/formula',
    observed_at: '2026-09-22T00:00:00Z', verification_status: 'verified',
  };
  const identifier = {
    variant_id: variantId, formula_version_id: formulaId, source_authority: 'manufacturer',
    verified_at: '2026-09-22T00:00:00Z',
  };
  assert.deepEqual(resolveCatalogFormula(variantId, [formula], [identifier]), {
    state: 'verified',
    formula: { formulaVersionId: formulaId, ingredients: ['Water', 'Glycerin'],
      provenanceType: 'manufacturer', sourceReference: 'https://manufacturer.example/formula',
      observedAt: '2026-09-22T00:00:00Z' },
  });
  const privateSource = resolveCatalogFormula(variantId, [{ ...formula, catalog_public_source_url: null }], [identifier]);
  assert.equal(privateSource.state, 'verified');
  if (privateSource.state === 'verified') assert.equal(privateSource.formula.sourceReference, null);
  assert.deepEqual(resolveCatalogFormula(variantId, [formula], []), { state: 'unverified' });
  assert.equal(publicSourceReference('internal://private-reference'), null);
  assert.equal(publicSourceReference('https://manufacturer.example/page'), 'https://manufacturer.example/page');
  assert.deepEqual(resolveCatalogFormula(variantId, [formula], [{ ...identifier, verified_at: null }]), { state: 'unverified' });
  const second = { ...formula, id: 'a1300000-0000-4000-8000-000000000002' };
  assert.deepEqual(resolveCatalogFormula(variantId, [formula, second], [identifier, { ...identifier, formula_version_id: second.id }]), { state: 'multiple_versions' });
});
