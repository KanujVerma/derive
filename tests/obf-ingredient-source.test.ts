import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupObfIngredients } from '../supabase/functions/_shared/obf-ingredient-source.ts';

const barcode = '036000291452';
const query = { barcode, name: 'Ultra sunscreen', brand: 'Source brand', size: '3 oz' };
const record = (product: Record<string, unknown> = {}, outer: Record<string, unknown> = {}) => new Response(JSON.stringify({
  status: 1, code: barcode, product: { code: barcode, product_name: 'Ultra sunscreen', brands: 'Source brand', quantity: '3 oz',
    ingredients_text: 'Aqua, parfum', ingredients_text_en: 'Water, Glycerin, Petrolatum', last_modified_t: 1491327417, ...product }, ...outer,
}));
const lookup = (response: Response) => lookupObfIngredients(query, { fetch: async () => response, now: () => new Date('2026-09-30T00:00:00Z') });

test('OBF ingredient evidence preserves exact text, source identity and attribution without formula promotion', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const raw = 'Water,\n  Glycerin, Petrolatum. May contain: CI 12345';
  const result = await lookupObfIngredients(query, { now: () => new Date('2026-09-30T00:00:00Z'), fetch: async (url, init) => {
    calls.push({ url: String(url), init }); return record({ ingredients_text_en: raw, product_name_en: 'English Ultra sunscreen' });
  } });
  assert.deepEqual(result, { status: 'found', evidence: {
    source: 'open_beauty_facts', sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`, sourceLicense: 'ODbL-1.0',
    retrievedAt: '2026-09-30T00:00:00.000Z', sourceModifiedAt: '2017-04-04T17:36:57.000Z', barcode,
    productName: 'English Ultra sunscreen', brand: 'Source brand', quantity: '3 oz', ingredientsText: raw,
    matchBasis: 'barcode', formulaVerified: false, canonicalProductId: null,
  } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v2\/product\/036000291452\.json\?fields=/);
  assert.equal(calls[0].init?.redirect, 'error');
  assert.match((calls[0].init?.headers as Record<string, string>)['User-Agent'], /^Derive\//);
  assert.equal(calls[0].url.includes(query.name), false, 'only barcode is sent; no observed/user labels leak');
});

test('only exact GTIN or UPC-A/zero-prefixed EAN equivalence is accepted', async () => {
  const padded = `0${barcode}`;
  assert.equal((await lookup(record({ code: padded }, { code: padded }))).status, 'found');
  assert.equal((await lookupObfIngredients({ ...query, barcode: padded }, { fetch: async () => record() })).status, 'found');
  assert.deepEqual(await lookup(record({ code: '3560070791460' })), { status: 'unavailable' });
  assert.deepEqual(await lookup(record({}, { code: '3560070791460' })), { status: 'unavailable' });
  assert.deepEqual(await lookup(record({ code: undefined })), { status: 'unavailable' });
});

test('missing records, incomplete ingredients and failures are distinguishable and never invented', async () => {
  assert.deepEqual(await lookup(new Response(null, { status: 404 })), { status: 'not_found' });
  assert.deepEqual(await lookup(record({}, { status: 0 })), { status: 'not_found' });
  assert.deepEqual(await lookup(record({ ingredients_text: '', ingredients_text_en: '' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ product_name: '', product_name_en: '' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(new Response(null, { status: 429 })), { status: 'rate_limited' });
  assert.deepEqual(await lookup(new Response(null, { status: 503 })), { status: 'unavailable' });
  assert.deepEqual(await lookup(new Response('{bad')), { status: 'unavailable' });
  assert.deepEqual(await lookup(new Response('[]')), { status: 'unavailable' });
  assert.deepEqual(await lookupObfIngredients(query, { fetch: async () => { throw new Error('offline'); } }), { status: 'unavailable' });
});

test('generic source text is retained without translating or parsing it when English is absent', async () => {
  const result = await lookup(record({ ingredients_text_en: '', ingredients_text: 'Aqua (eau), parfum', lang: 'fr', last_modified_t: 'invalid' }));
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.evidence.ingredientsText, 'Aqua (eau), parfum');
    assert.equal(result.evidence.sourceModifiedAt, null);
  }
});

test('response/ingredient bounds reject truncated or unsafe source evidence', async () => {
  assert.deepEqual(await lookup(new Response('x'.repeat(65_537))), { status: 'unavailable' });
  assert.deepEqual(await lookup(new Response('{}', { headers: { 'content-length': '70000' } })), { status: 'unavailable' });
  assert.deepEqual(await lookup(record({ ingredients_text_en: 'x'.repeat(24_001), ingredients_text: '' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ ingredients_text_en: 'Water\u0000Glycerin', ingredients_text: '' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ product_name: 'x'.repeat(301) })), { status: 'incomplete' });
});

test('invalid input makes no external request', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return record(); };
  await assert.rejects(lookupObfIngredients({ ...query, barcode: '12345678' }, { fetch: fetcher }), /INVALID_QUERY/);
  await assert.rejects(lookupObfIngredients({ ...query, name: 'x'.repeat(301) }, { fetch: fetcher }), /INVALID_QUERY/);
  await assert.rejects(lookupObfIngredients({ ...query, size: 'x'.repeat(101) }, { fetch: fetcher }), /INVALID_QUERY/);
  assert.equal(calls, 0);
});

test('barcode-only lookup works without a prior external product name and bounds optional labels', async () => {
  const result = await lookupObfIngredients({ barcode, name: '', brand: null, size: null }, {
    fetch: async () => record({ brands: 'b'.repeat(181), quantity: 'q'.repeat(181) }),
  });
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.evidence.productName, 'Ultra sunscreen');
    assert.equal(result.evidence.brand, null);
    assert.equal(result.evidence.quantity, null);
  }
});

test('a same-barcode food record or incompatible identity never supplies displayed ingredients', async () => {
  const cerave = { barcode: '3606000537538', name: 'CeraVe Moisturizing Cream', brand: 'CeraVe', size: null };
  const wrong = new Response(JSON.stringify({ status: 1, code: cerave.barcode, product: {
    code: cerave.barcode, product_name: 'Mixed Berry Prebiotic Soda', brands: 'Unknown', product_type: 'beauty',
    categories: 'soda', categories_tags: ['en:soda'], ingredients_text_en: 'Carbonated water, sugar',
  } }));
  assert.deepEqual(await lookupObfIngredients(cerave, { fetch: async () => wrong }), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ brands: 'Different brand' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ product_name: 'Ultra moisturizing cream' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ product_name: 'Unrelated product', categories: 'Cosmetics' })), { status: 'incomplete' });
  assert.deepEqual(await lookup(record({ brands: '' })), { status: 'incomplete' });
});

test('brand equivalence normalizes case and accents without accepting brand substrings', async () => {
  const branded = { ...query, name: "L'Oreal Ultra sunscreen", brand: "L'Oréal" };
  assert.equal((await lookupObfIngredients(branded, { fetch: async () => record({ brands: "L'OREAL", product_name: 'Ultra sunscreen' }) })).status, 'found');
  assert.deepEqual(await lookupObfIngredients({ ...query, brand: 'Source' }, { fetch: async () => record() }), { status: 'incomplete' });
});

test('same-barcode SPF and drug strength contradictions cannot supply ingredient evidence', async () => {
  for (const [wanted, returned] of [['Ultra sunscreen SPF30', 'Ultra sunscreen SPF50'],
    ['Ultra sunscreen SPF30', 'Ultra sunscreen'], ['Ultra acne gel 2.5%', 'Ultra acne gel 10%']]) {
    assert.deepEqual(await lookupObfIngredients({ ...query, name: wanted }, {
      fetch: async () => record({ product_name: returned }),
    }), { status: 'incomplete' });
  }
  assert.equal((await lookupObfIngredients({ ...query, name: 'Ultra sunscreen SPF30' }, {
    fetch: async () => record({ product_name: 'Ultra sunscreen SPF 30' }),
  })).status, 'found');
});

test('barcode-only food, ambiguous and explicit non-beauty records fail closed while body care and topical drug records remain evidence', async () => {
  const onlyBarcode = { barcode, name: '', brand: null, size: null };
  const bodyLookup = (product: Record<string, unknown>) => lookupObfIngredients(onlyBarcode, { fetch: async () => record(product) });
  assert.deepEqual(await bodyLookup({ product_name: 'Mixed Berry Prebiotic Soda', categories_tags: ['en:beverages'], product_type: 'food' }), { status: 'incomplete' });
  assert.deepEqual(await bodyLookup({ product_name: 'Mystery bottle', categories: '', product_type: '' }), { status: 'incomplete' });
  assert.deepEqual(await bodyLookup({ product_name: 'Ultra sunscreen', product_type: 'food' }), { status: 'incomplete' });
  assert.equal((await bodyLookup({ product_name: 'Fresh deodorant', product_type: 'beauty', categories: 'Body care' })).status, 'found');
  assert.equal((await bodyLookup({ product_name: 'Acne treatment gel', product_type: 'drug', categories: 'Topical acne treatments' })).status, 'found');
  assert.equal((await bodyLookup({ product_name: 'SPF sunscreen', product_type: 'drug', categories: 'Sun protection' })).status, 'found');
  assert.equal((await bodyLookup({ product_name: 'Tea tree cleanser', product_type: 'beauty', categories: 'Cosmetics' })).status, 'found');
  assert.equal((await bodyLookup({ product_name: 'Coffee body scrub', product_type: 'beauty', categories: 'Body care' })).status, 'found');
});

test('deadline bounds even a transport ignoring the abort signal', async () => {
  let signal: AbortSignal | null = null;
  const result = await lookupObfIngredients(query, { fetch: async (_url, init) => {
    signal = init?.signal ?? null;
    return await new Promise<Response>(() => {});
  } });
  assert.deepEqual(result, { status: 'unavailable' });
  assert.equal((signal as AbortSignal | null)?.aborted, true);
});
