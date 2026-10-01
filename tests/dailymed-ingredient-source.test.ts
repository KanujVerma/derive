import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupDailyMedIngredients } from '../supabase/functions/_shared/dailymed-ingredient-source.ts';

const setid = '2138f86b-3937-4c2b-9568-d40a745b637d';
const query = { barcode: '3337875597417', name: 'CeraVe AM Facial Moisturizing Lotion SPF30 3 fl oz', brand: 'CeraVe', size: '3 fl oz' };
const title = 'CERAVE AM FACIAL MOISTURIZING BROAD SPECTRUM SPF 30 SUNSCREEN LOTION [LOREAL]';
const label = (overrides: Record<string, unknown> = {}) => ({ setid, title, published_date: 'Jan 01, 2024', spl_version: 7, ...overrides });
const xml = (active = '<paragraph>Zinc oxide 6.3%</paragraph>', inactive = '<paragraph>water, glycerin, niacinamide</paragraph>') => `<?xml version="1.0"?><document xmlns="urn:hl7-org:v3"><setId root="${setid}"/><component><section><code code="55106-9"/><title>Active ingredients</title><text>${active}</text></section></component><component><section><code code="51727-6"/><title>Inactive ingredients</title><text>${inactive}</text></section></component></document>`;
function fake(records: unknown[] = [label()], body = xml(), total = records.length) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push({ url, init });
    return url.pathname.endsWith('.json')
      ? new Response(JSON.stringify({ data: records, metadata: { total_elements: total } }), { headers: { 'content-type': 'application/json' } })
      : new Response(body, { headers: { 'content-type': 'application/xml' } });
  };
  return { calls, fetch: fetcher };
}

test('DailyMed retrieves active and inactive evidence with provenance, never treating UPC as NDC', async () => {
  const f = fake();
  const result = await lookupDailyMedIngredients(query, { fetch: f.fetch, now: () => new Date('2026-09-30T00:00:00Z') });
  assert.equal(result.status, 'found');
  assert.deepEqual(result.evidence, {
    source: 'dailymed', sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`,
    sourceLicense: 'DailyMed-public-label', retrievedAt: '2026-09-30T00:00:00.000Z', sourceModifiedAt: '2024-01-01T00:00:00.000Z',
    barcode: null, productName: title, brand: 'CeraVe', quantity: null,
    ingredientsText: 'Active ingredients:\nZinc oxide 6.3%\n\nInactive ingredients:\nwater, glycerin, niacinamide',
    matchBasis: 'name_variant', formulaVerified: false, canonicalProductId: null,
  });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url.searchParams.get('drug_name'), 'cerave am facial moistur');
  assert.equal(f.calls[0].url.searchParams.get('pagesize'), '20');
  assert.equal(f.calls[0].url.searchParams.has('ndc'), false);
  for (const call of f.calls) {
    assert.equal(call.url.origin, 'https://dailymed.nlm.nih.gov');
    assert.equal(call.init?.redirect, 'error');
    assert.equal(call.init?.credentials, 'omit');
    assert.equal(call.init?.method, 'GET');
    assert.ok(call.init?.signal);
  }
});

test('different SPF variant is rejected and two same-name labels remain ambiguous', async () => {
  const wrong = fake([label({ title: title.replace('SPF 30', 'SPF 50') })]);
  assert.equal((await lookupDailyMedIngredients(query, wrong)).status, 'not_found');
  assert.equal(wrong.calls.length, 1);
  assert.equal((await lookupDailyMedIngredients(query, fake([label(), label({ setid: '11111111-1111-1111-1111-111111111111' })]))).status, 'ambiguous');
  assert.equal((await lookupDailyMedIngredients(query, fake([label()], xml(), 7))).status, 'ambiguous');
  assert.equal((await lookupDailyMedIngredients(query, fake([label({ title: title.replace('SPF 30', 'SPF 50') + ' 30 GRAMS' })]))).status, 'not_found');
});

test('same-brand wrong product and unqualified brand searches are not accepted', async () => {
  assert.equal((await lookupDailyMedIngredients(query, fake([label({ title: 'CERAVE PM FACIAL MOISTURIZING LOTION' })]))).status, 'not_found');
  let called = false;
  const result = await lookupDailyMedIngredients({ ...query, name: 'CeraVe' }, { fetch: async () => { called = true; throw Error(); } });
  assert.equal(result.status, 'incomplete'); assert.equal(called, false);
});

test('filters more than six complete search results before deciding ambiguity', async () => {
  const unrelated = Array.from({ length: 8 }, (_, i) => label({ title: `CERAVE OTHER PRODUCT ${i}` }));
  const f = fake([...unrelated, label()]);
  assert.equal((await lookupDailyMedIngredients(query, f)).status, 'found');
  assert.equal(f.calls.length, 2);
});

test('reads a bounded second page and does not trust provider next-page URLs', async () => {
  const calls: URL[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input)); calls.push(url);
    if (url.pathname.endsWith('.xml')) return new Response(xml(), { headers: { 'content-type': 'application/xml' } });
    const page = Number(url.searchParams.get('page') ?? 1);
    return new Response(JSON.stringify({
      data: page === 1 ? Array.from({ length: 20 }, (_, i) => label({ title: `CERAVE OTHER ${i}` })) : [label()],
      metadata: { total_elements: 21, current_page: page, next_page_url: 'https://evil.test' },
    }), { headers: { 'content-type': 'application/json' } });
  };
  assert.equal((await lookupDailyMedIngredients(query, { fetch: fetcher })).status, 'found');
  assert.equal(calls.length, 3);
  assert.equal(calls[1].searchParams.get('page'), '2');
  assert.ok(calls.every(url => url.origin === 'https://dailymed.nlm.nih.gov'));
  const tooBroad = fake([label()], xml(), 41);
  assert.equal((await lookupDailyMedIngredients(query, tooBroad)).status, 'ambiguous');
  assert.equal(tooBroad.calls.length, 1);
});

test('incomplete or shifting pagination never accepts a first-page match', async () => {
  for (const second of [
    { data: [], metadata: { total_elements: 21, current_page: 2 } },
    { data: [label()], metadata: { total_elements: 22, current_page: 2 } },
    { data: [label()], metadata: { total_elements: 21, current_page: 1 } },
  ]) {
    let calls = 0;
    const result = await lookupDailyMedIngredients(query, { fetch: async () => {
      calls++;
      return new Response(JSON.stringify(calls === 1
        ? { data: Array.from({ length: 20 }, () => label()), metadata: { total_elements: 21 } } : second),
      { headers: { 'content-type': 'application/json' } });
    } });
    assert.notEqual(result.status, 'found');
    assert.equal(calls, 2);
  }
});

test('marketing words can be absent but deodorant cannot become antiperspirant or spray', async () => {
  const fresh = { ...query, name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 Oz', brand: 'Old Spice' };
  const exact = 'OLD SPICE FRESH HIGH ENDURANCE DEODORANT STICK';
  assert.equal((await lookupDailyMedIngredients(fresh, fake([label({ title: exact })]))).status, 'found');
  for (const wrong of [
    exact.replace('DEODORANT', 'ANTIPERSPIRANT AND DEODORANT'),
    exact.replace('STICK', '(ALUMINUM CHLOROHYDRATE) STICK'),
    exact.replace('STICK', 'AEROSOL, SPRAY'),
    `${exact} FOR WOMEN`,
    exact.replace('FRESH', 'PURE SPORT'),
  ]) assert.equal((await lookupDailyMedIngredients(fresh, fake([label({ title: wrong })]))).status, 'not_found');
  // Sex-labelled hair-growth treatments are not merely deodorant marketing.
  const hair = { ...query, name: 'Nizoral Hair Regrowth Treatment for Men', brand: 'Nizoral' };
  assert.equal((await lookupDailyMedIngredients(hair, fake([label({
    title: 'NIZORAL HAIR REGROWTH TREATMENT FOR WOMEN (MINOXIDIL) FOAM',
  })]))).status, 'not_found');
});

test('Nizoral dandruff naming excludes pet and other treatments without choosing duplicate labels', async () => {
  const nizoral = { ...query, name: 'Nizoral Anti-Dandruff Shampoo', brand: 'Nizoral' };
  const exact = 'NIZORAL (KETOCONAZOLE) SHAMPOO [KRAMER LABORATORIES]';
  assert.equal((await lookupDailyMedIngredients(nizoral, fake([label({ title: exact })]))).status, 'found');
  for (const wrong of ['NIZORAL PET (KETOCONAZOLE) SHAMPOO', 'NIZORAL PSORIASIS (SALICYLIC ACID) SHAMPOO']) {
    assert.equal((await lookupDailyMedIngredients(nizoral, fake([label({ title: wrong })]))).status, 'not_found');
  }
  assert.equal((await lookupDailyMedIngredients(nizoral, fake([
    label({ title: exact }), label({ title: exact, setid: '11111111-1111-1111-1111-111111111111' }),
  ]))).status, 'ambiguous');
  assert.equal((await lookupDailyMedIngredients({ ...nizoral, name: 'Nizoral Anti-Dandruff Shampoo 1%' }, fake([label({ title: exact })]))).status, 'not_found');
});

test('moisturizer wording is normalized without erasing lotion/cream or SPF variants', async () => {
  assert.equal((await lookupDailyMedIngredients({ ...query, name: 'CeraVe AM Facial Moisturizer Lotion SPF 30' }, fake())).status, 'found');
  assert.equal((await lookupDailyMedIngredients({ ...query, name: 'CeraVe AM Facial Moisturizer Cream SPF 30' }, fake())).status, 'not_found');
  const f = fake([label({ title: 'NIZORAL (KETOCONAZOLE) SHAMPOO' })], xml(), 9);
  assert.equal((await lookupDailyMedIngredients({ ...query, name: 'Nizoral Anti-Dandruff Shampoo', brand: 'Nizoral' }, f)).status, 'ambiguous');
  assert.equal(f.calls[0].url.searchParams.get('drug_name'), 'nizoral');
});

test('compact Face50 retains numeric variant and narrows search without picking duplicate formulas', async () => {
  const sun = { barcode: '0871760002975', name: 'Sun Bum Face50 Premium Sunscreen', brand: 'Sun Bum', size: null };
  const sunTitle = 'SUN BUM FACE 50 PREMIUM SUNSCREEN (AVOBENZONE, HOMOSALATE, OCTISALATE, OCTOCRYLENE) LOTION [SUN BUM, LLC]';
  const single = fake([label({ title: sunTitle })]);
  assert.equal((await lookupDailyMedIngredients(sun, single)).status, 'found');
  assert.equal(single.calls[0].url.searchParams.get('drug_name'), 'sun bum face 50 premium');
  assert.equal((await lookupDailyMedIngredients({ ...sun, name: 'Sun Bum Face30 Premium Sunscreen' }, fake([label({ title: sunTitle })]))).status, 'not_found');
  const competing = fake([label({ title: sunTitle }), label({ title: sunTitle, setid: '11111111-1111-1111-1111-111111111111' })]);
  assert.equal((await lookupDailyMedIngredients(sun, competing)).status, 'ambiguous');
  assert.equal(competing.calls.length, 1);
});

test('CDATA, entities, ingredient order and table strengths are preserved', async () => {
  const f = fake([label()], xml('<table><tbody><tr><td>Zinc oxide</td><td>6.3%</td></tr></tbody></table>', '<paragraph><![CDATA[Water, glycerin]]>, fragrance &amp; parfum, sodium &#x68;ydroxide</paragraph>'));
  const result = await lookupDailyMedIngredients(query, f);
  assert.equal(result.status, 'found');
  assert.equal(result.evidence?.ingredientsText, 'Active ingredients:\nZinc oxide\n6.3%\n\nInactive ingredients:\nWater, glycerin, fragrance & parfum, sodium hydroxide');
});

test('missing inactive declaration stays incomplete; differing declarations stay ambiguous', async () => {
  assert.equal((await lookupDailyMedIngredients(query, fake([label()], xml('Zinc oxide', '')))).status, 'incomplete');
  const duplicate = xml().replace('</document>', '<component><section><title>Inactive ingredients</title><text>different formula</text></section></component></document>');
  assert.equal((await lookupDailyMedIngredients(query, fake([label()], duplicate))).status, 'ambiguous');
  assert.equal((await lookupDailyMedIngredients(query, fake([label()], xml('x'.repeat(12_000), 'y'.repeat(12_000))))).status, 'incomplete');
});

test('rejects DTD/entity expansion, bad XML, unsafe references, and oversized responses', async () => {
  for (const invalid of [
    '<!DOCTYPE document [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + xml(),
    xml('Zinc &unknown; oxide'), xml('Zinc & oxide'), xml('Zinc &#0; oxide'),
    xml().replace('</text>', '</wrong>'), xml() + '<document/>', '<document><text>',
    xml().replace(setid, '11111111-1111-1111-1111-111111111111'),
    xml('x'.repeat(600_001)),
  ]) assert.equal((await lookupDailyMedIngredients(query, fake([label()], invalid))).status, 'unavailable');
  assert.equal((await lookupDailyMedIngredients(query, fake([label({ setid: 'https://evil.test' })]))).status, 'not_found');
  const oversized: typeof fetch = async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '65537' } });
  assert.equal((await lookupDailyMedIngredients(query, { fetch: oversized })).status, 'unavailable');
});

test('handles no records, invalid metadata/JSON/MIME, HTTP failures, rate limits and network errors', async () => {
  assert.equal((await lookupDailyMedIngredients(query, fake([]))).status, 'not_found');
  for (const [response, status] of [
    [new Response('', { status: 404 }), 'not_found'], [new Response('', { status: 429 }), 'rate_limited'],
    [new Response('', { status: 503 }), 'unavailable'],
    [new Response('{', { headers: { 'content-type': 'application/json' } }), 'unavailable'],
    [new Response('{}', { headers: { 'content-type': 'text/html' } }), 'unavailable'],
    [new Response(JSON.stringify({ data: [label()] }), { headers: { 'content-type': 'application/json' } }), 'ambiguous'],
  ] as const) assert.equal((await lookupDailyMedIngredients(query, { fetch: async () => response })).status, status);
  assert.equal((await lookupDailyMedIngredients(query, { fetch: async () => { throw new Error('network'); } })).status, 'unavailable');
  const f = fake();
  assert.equal((await lookupDailyMedIngredients(query, { fetch: async (input, init) => String(input).endsWith('.xml') ? new Response('', { status: 429 }) : f.fetch(input, init) })).status, 'rate_limited');
});
