import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProductLinkResult, ProductLinkError, resolveProductLink } from '../src/services/productLinks.ts';

const requestId = '2f2f6f97-f988-4d46-b871-aeb8c2e2aa21';
const input = { requestId, url: 'https://www.amazon.com/dp/B00ABC1234' };
const recovery = { status: 'needs_details', source: 'amazon', reason: 'Enter a name or scan the package.', nextAction: 'search_or_photo' };

test('client forwards one stable Check request and keeps source recovery distinct from truth', async () => {
  let calls = 0;
  const result = await resolveProductLink(input, { functions: { invoke: async (name, options) => {
    calls++;
    assert.equal(name, 'resolve-product-link');
    assert.deepEqual(options.body, input);
    return { data: recovery, error: null };
  } } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'needs_details');
  assert.equal('product' in result, false);
});

test('client preserves typed quota failure and does not automatically retry', async () => {
  let calls = 0;
  await assert.rejects(resolveProductLink(input, { functions: { invoke: async () => {
    calls++;
    return { data: null, error: { context: new Response(null, { status: 429 }) } };
  } } }), (error: unknown) => error instanceof ProductLinkError && error.code === 'RATE_LIMITED');
  assert.equal(calls, 1);
});

test('malformed product and label responses cannot produce a client identity or verdict', () => {
  for (const value of [
    { status: 'resolution', source: 'open_beauty_facts_url', sourceUrl: 'https://world.openbeautyfacts.org/product/036000291452', barcode: '036000291452',
      resolution: { caseId: requestId, state: 'verified_product_formula', candidates: [], nextAction: 'evaluate_product_fit', requiresFounderReview: false,
        product: { productId: 'not-an-id', brand: 'Brand', name: 'Name' } } },
    { status: 'label_candidate', candidate: { source: 'dailymed_spl', identityStatus: 'verified_product_formula' }, nextAction: 'confirm_package' },
    { ...recovery, sourceUrl: 'http://127.0.0.1' },
    { ...recovery, nextAction: 'evaluate_product_fit' },
    { status: 'resolution', source: 'open_beauty_facts_url', sourceUrl: 'https://world.openbeautyfacts.org/product/036000291452', barcode: '036000291452',
      resolution: { caseId: requestId, state: 'verified_product_formula', candidates: [], nextAction: 'evaluate_product_fit', requiresFounderReview: false } },
  ]) assert.throws(() => parseProductLinkResult(value), ProductLinkError);
  const result = parseProductLinkResult({ status: 'label_candidate', nextAction: 'confirm_package', candidate: {
    source: 'dailymed_spl', sourceRecordId: requestId, sourceVersion: 1, title: 'Example sunscreen', publishedDate: 'Jun 15, 2020',
    sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${requestId}`, retrievedAt: '2026-09-29T00:00:00.000Z', identityStatus: 'label_title_only',
  } });
  assert.equal(result.status, 'label_candidate');
});

test('invalid local input fails before the remote call', async () => {
  let called = false;
  const client = { functions: { invoke: async () => { called = true; return { data: recovery, error: null }; } } };
  for (const url of ['http://example.org/product', 'https://user:password@example.org/product', 'https://example.org:8080/product', 'https://example.org/product\n']) {
    await assert.rejects(resolveProductLink({ requestId, url }, client), (error: unknown) => error instanceof ProductLinkError && error.code === 'INVALID_LINK');
  }
  assert.equal(called, false);
});
