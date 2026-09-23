import assert from 'node:assert/strict';
import test from 'node:test';
import { useOnboardingStore } from '../src/stores/onboardingStore.ts';
import type { CatalogProductSummary } from '../src/contracts/ProductCatalog.ts';
import { buildCustomerShelfProduct, buildCatalogShelfProduct, buildEditedShelfProduct } from '../src/utils/shelfProducts.ts';
import {
  searchCatalogProducts, getCatalogProductDetail, resolveCatalogIdentity, createCatalogRequestId,
} from '../src/services/productCatalog.ts';

const productId = 'a1100000-0000-4000-8000-000000000001';
const summary: CatalogProductSummary = {
  productId, brand: 'CeraVe', name: 'Renewing SA Cleanser', category: 'cleanser',
  imageUrl: null, isCatalogStandard: true, variantCount: 0, formulaState: 'unverified',
};

test('Mobile catalog: search sends bounded query to the authenticated Edge interface', async () => {
  const calls: Array<{ name: string; body: any }> = [];
  const client = { functions: { invoke: async (name: string, options: { body: any }) => {
    calls.push({ name, body: options.body });
    return { data: { items: [summary] }, error: null };
  } } };
  assert.deepEqual(await searchCatalogProducts(' CeraVe SA ', client), [summary]);
  assert.deepEqual(calls, [{ name: 'catalog-products', body: { operation: 'search', query: 'CeraVe SA', limit: 10 } }]);
  assert.deepEqual(await searchCatalogProducts('x', client), []);
  assert.equal(calls.length, 1, 'one-character input never hits the server');
});

test('Mobile catalog: malformed or failed search does not invent products', async () => {
  const failed = { functions: { invoke: async () => ({ data: null, error: new Error('offline') }) } };
  await assert.rejects(searchCatalogProducts('CeraVe', failed));
  const malformed = { functions: { invoke: async () => ({ data: { items: [{ name: 'invented' }] }, error: null }) } };
  await assert.rejects(searchCatalogProducts('CeraVe', malformed));
});

test('Mobile catalog: detail and S6 typed/barcode resolution use canonical product identity', async () => {
  const calls: Array<{ name: string; body: any }> = [];
  const client = { functions: { invoke: async (name: string, options: { body: any }) => {
    calls.push({ name, body: options.body });
    if (name === 'catalog-products') return { data: { product: { ...summary, sourceReference: null, observedAt: '2026-09-22T00:00:00Z', variants: [] } }, error: null };
    return { data: { caseId: 'case-id', state: 'identified_formula_unverified', product: { productId, brand: 'CeraVe', name: 'Renewing SA Cleanser' }, candidates: [], nextAction: 'photograph_ingredients', requiresFounderReview: false }, error: null };
  } } };
  const detail = await getCatalogProductDetail(productId, client);
  const typed = await resolveCatalogIdentity({ requestId: 'a2000000-0000-4000-8000-000000000001', consumer: 'scan', brand: 'CeraVe', productName: 'Renewing SA Cleanser' }, client);
  const barcode = await resolveCatalogIdentity({ requestId: 'a2000000-0000-4000-8000-000000000002', consumer: 'scan', barcode: '036000291452' }, client);
  assert.equal(detail.productId, productId);
  assert.equal(typed.product?.productId, productId);
  assert.equal(barcode.product?.productId, productId);
  assert.equal(calls[0].name, 'catalog-products');
  assert.equal(calls[1].name, 'resolve-product-identity');
  assert.equal(calls[2].name, 'resolve-product-identity');
});

test('Mobile shelf: one-tap catalog Add keeps UUID, prevents duplicates, and invents no chemistry', () => {
  const shelf = useOnboardingStore.getState();
  shelf.resetOnboarding();
  try {
    const product = buildCatalogShelfProduct(summary);
    assert.equal(product.id, productId);
    assert.equal(product.isCatalogStandard, true);
    assert.deepEqual(product.keyActives, []);
    assert.equal(product.fullIngredients, undefined);
    shelf.addProduct(product);
    shelf.addProduct(product);
    assert.equal(useOnboardingStore.getState().detectedProducts.length, 1);
    assert.equal(useOnboardingStore.getState().detectedProducts[0].id, productId);
  } finally { useOnboardingStore.getState().resetOnboarding(); }
});

test('Mobile shelf: manual fallback is provisional and editing catalog identity demotes it', () => {
  const manual = buildCustomerShelfProduct('manual-1', { brand: 'Unknown', name: 'Barrier Cream', category: 'moisturizer' });
  assert.equal(manual.isCatalogStandard, false);
  assert.deepEqual(manual.keyActives, []);
  const catalog = buildCatalogShelfProduct(summary);
  const edited = buildEditedShelfProduct(catalog, { brand: 'CeraVe', name: 'Different Cleanser', category: 'cleanser' }, 'manual-2');
  assert.equal(edited.id, 'manual-2');
  assert.equal(edited.isCatalogStandard, false);
  assert.deepEqual(edited.keyActives, []);
  assert.equal(buildEditedShelfProduct(catalog, { brand: catalog.brand, name: catalog.name, category: catalog.category }, 'manual-3').id, productId);
});

test('Check Product: S6 trust states never produce a fabricated personal-fit verdict', async () => {
  const { describeCheckProductFit } = await import('../src/commerce/checkProductPresentation.ts');
  assert.deepEqual(describeCheckProductFit('verified_product_formula'), {
    kind: 'provider_unavailable',
    message: 'Personal fit is not available yet. Formula facts are shown separately below.',
  });
  assert.equal(describeCheckProductFit('identified_formula_unverified').kind, 'formula_unverified');
  assert.equal(describeCheckProductFit('ambiguous_candidates').kind, 'choose_candidate');
  assert.equal(describeCheckProductFit('formula_only').kind, 'identity_unverified');
  assert.equal(describeCheckProductFit('insufficient_evidence').kind, 'identity_unverified');
  assert.doesNotMatch(JSON.stringify(describeCheckProductFit('verified_product_formula')), /\d+%|score/i);
});

test('Check Product: catalog detail opens only for a matching resolved product', async () => {
  const { resolvedCatalogDetailId } = await import('../src/commerce/checkProductPresentation.ts');
  const resolved = { product: { productId, brand: summary.brand, name: summary.name }, candidates: [] };
  assert.equal(resolvedCatalogDetailId({ ...resolved, state: 'identified_formula_unverified' } as any, productId), productId);
  assert.equal(resolvedCatalogDetailId({ ...resolved, state: 'verified_product_formula' } as any, productId), productId);
  assert.equal(resolvedCatalogDetailId({ ...resolved, state: 'identified_formula_unverified' } as any, 'a1100000-0000-4000-8000-000000000002'), null);
  assert.equal(resolvedCatalogDetailId({ ...resolved, state: 'ambiguous_candidates', product: undefined } as any, productId), null);
  assert.equal(resolvedCatalogDetailId({ ...resolved, state: 'insufficient_evidence', product: undefined } as any, productId), null);
});

test('Check Product: S6 requests use UUID-shaped idempotency keys', () => {
  assert.match(createCatalogRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Mobile onboarding payload carries the chosen canonical catalog UUID without chemistry', async () => {
  const { buildOnboardingPayload } = await import('../src/services/deriveClient.ts');
  const selected = buildCatalogShelfProduct(summary);
  const payload = buildOnboardingPayload({ detectedProducts: [selected] }, 'usr_real_catalog_member', true);
  assert.equal(payload.confirmedProducts[0].id, productId);
  assert.equal(payload.confirmedProducts[0].isCatalogStandard, true);
  assert.deepEqual(payload.confirmedProducts[0].keyActives, []);
  assert.equal(payload.confirmedProducts[0].fullIngredients, undefined);
});

test('Check Product: only an exact verified S6 case reveals a matching formula', async () => {
  const { getVerifiedFormulaForResolution } = await import('../src/commerce/checkProductPresentation.ts');
  const formula = { formulaVersionId: 'a1300000-0000-4000-8000-000000000001', ingredients: ['Water'], provenanceType: 'manufacturer' as const, sourceReference: null, observedAt: '2026-09-22T00:00:00Z' };
  const detail: any = { ...summary, variants: [{ variantId: 'a1200000-0000-4000-8000-000000000001', name: 'US bottle', regionCode: 'US', packageSize: null, sourceReference: null, observedAt: null, verificationState: 'verified', formulaState: 'verified', formula }] };
  assert.equal(getVerifiedFormulaForResolution(detail, { state: 'identified_formula_unverified' } as any), null);
  assert.equal(getVerifiedFormulaForResolution(detail, { state: 'ambiguous_candidates' } as any), null);
  assert.equal(getVerifiedFormulaForResolution(detail, { state: 'verified_product_formula', formula: { formulaVersionId: 'a1300000-0000-4000-8000-000000000002' } } as any), null);
  assert.equal(getVerifiedFormulaForResolution(detail, { state: 'verified_product_formula', product: { productId, variantId: 'a1200000-0000-4000-8000-000000000002' }, formula: { formulaVersionId: formula.formulaVersionId } } as any), null);
  assert.deepEqual(getVerifiedFormulaForResolution(detail, { state: 'verified_product_formula', product: { productId, variantId: detail.variants[0].variantId }, formula: { formulaVersionId: formula.formulaVersionId } } as any), formula);
});

test('Check Product: unknown or ambiguous S6 results remain unresolved', async () => {
  const unresolved = { functions: { invoke: async () => ({ data: { caseId: 'case-id', state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: true }, error: null }) } };
  const unknown = await resolveCatalogIdentity({ requestId: 'a2000000-0000-4000-8000-000000000003', consumer: 'scan', barcode: '12345670' }, unresolved);
  assert.equal(unknown.product, undefined);
  assert.equal(unknown.requiresFounderReview, true);
  const ambiguous = { functions: { invoke: async () => ({ data: { caseId: 'case-id', state: 'ambiguous_candidates', candidates: [{ productId, brand: 'CeraVe', name: 'Renewing SA Cleanser', basis: 'exact_typed_identity', matchReasons: ['same name'] }], nextAction: 'choose_candidate', requiresFounderReview: true }, error: null }) } };
  const candidate = await resolveCatalogIdentity({ requestId: 'a2000000-0000-4000-8000-000000000004', consumer: 'scan', productName: 'Renewing SA Cleanser' }, ambiguous);
  assert.equal(candidate.product, undefined);
  assert.equal(candidate.candidates[0].productId, productId);
  assert.equal(candidate.requiresFounderReview, true);
});
