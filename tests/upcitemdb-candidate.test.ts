import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupUpcItemDb } from '../supabase/functions/_shared/upcitemdb-candidate.ts';

const UPC = '885909456017';
const EAN = `0${UPC}`;
const PACK = '20008236914225';
const item = { ean: EAN, upc: UPC, title: 'Example lotion, 8 oz', brand: 'Example', size: '8 oz', category: 'Beauty' };
const reserveRequest = async () => 'reserved' as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

test('default OFF never reserves or fetches', async () => {
  const result = await lookupUpcItemDb(UPC, {
    plan: 'trial', reserveRequest: async () => { throw Error('must not reserve'); },
    fetcher: (() => { throw Error('must not fetch'); }) as typeof fetch,
  });
  assert.deepEqual(result, { status: 'disabled', candidates: [], truncated: false });
});

test('invalid barcode, missing reservation and missing paid key fail before network', async () => {
  const fetcher = (() => { throw Error('must not fetch'); }) as typeof fetch;
  assert.equal((await lookupUpcItemDb('4002293401101', { plan: 'trial', enabled: true, reserveRequest, fetcher })).status, 'invalid_barcode');
  assert.equal((await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, fetcher })).status, 'configuration_required');
  assert.equal((await lookupUpcItemDb(UPC, { plan: 'paid', enabled: true, reserveRequest, fetcher })).status, 'configuration_required');
});

test('durable budget rejection or outage prevents a provider request', async () => {
  const fetcher = (() => { throw Error('must not fetch'); }) as typeof fetch;
  assert.equal((await lookupUpcItemDb(UPC, {
    plan: 'trial', enabled: true, reserveRequest: async () => 'rate_limited', fetcher,
  })).status, 'rate_limited');
  assert.equal((await lookupUpcItemDb(UPC, {
    plan: 'trial', enabled: true, reserveRequest: async () => { throw Error('DB down'); }, fetcher,
  })).status, 'unavailable');
});

test('trial lookup returns only bounded candidate identity; no private data or formula', async () => {
  let calls = 0;
  const result = await lookupUpcItemDb(UPC, {
    plan: 'trial', enabled: true, reserveRequest,
    now: () => new Date('2026-09-29T00:00:00Z'),
    fetcher: (async (input: string | URL | Request, init?: RequestInit) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.href, `https://api.upcitemdb.com/prod/trial/lookup?upc=${UPC}`);
      assert.equal(new Headers(init?.headers).get('user_key'), null);
      assert.equal(init?.redirect, 'error');
      return json({ code: 'OK', total: 1, offset: 0, items: [{ ...item, description: 'DO NOT COPY', images: ['https://image.invalid/1'], offers: [] }] });
    }) as typeof fetch,
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'found');
  if (result.status !== 'found') return;
  assert.deepEqual(result.candidates[0], {
    source: 'upcitemdb', rightsPolicy: 'internal_evaluation_only', sourceRecordId: EAN,
    sourceUrl: `https://api.upcitemdb.com/prod/trial/lookup?upc=${UPC}`,
    retrievedAt: '2026-09-29T00:00:00.000Z', observedBarcode: UPC, sourceBarcode: EAN,
    brand: 'Example', name: 'Example lotion, 8 oz', size: '8 oz', category: 'Beauty',
    canonicalProductId: null, formulaVerified: false,
  });
  assert.equal('description' in result.candidates[0], false);
  assert.equal('images' in result.candidates[0], false);
});

test('paid key stays in a server header rather than URL or output', async () => {
  const result = await lookupUpcItemDb(EAN, {
    plan: 'paid', apiKey: 'secret-test-key', enabled: true, reserveRequest,
    fetcher: (async (input: string | URL | Request, init?: RequestInit) => {
      assert.equal(new URL(String(input)).pathname, '/prod/v1/lookup');
      assert.equal(String(input).includes('secret-test-key'), false);
      assert.equal(new Headers(init?.headers).get('user_key'), 'secret-test-key');
      assert.equal(new Headers(init?.headers).get('key_type'), '3scale');
      return json({ code: 'OK', total: 1, offset: 0, items: [item] });
    }) as typeof fetch,
  });
  assert.equal(result.status, 'found');
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false);
});

test('different barcode and blank name cannot yield a false identity', async () => {
  for (const product of [{ ...item, ean: '4002293401102', upc: undefined }, { ...item, title: '   ' }]) {
    const result = await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
      fetcher: (async () => json({ code: 'OK', total: 1, offset: 0, items: [product] })) as typeof fetch });
    assert.equal(result.status, 'incomplete');
    assert.deepEqual(result.candidates, []);
  }
});

test('GTIN-14 pack cannot be inferred from an inner item UPC', async () => {
  const innerOnly = await lookupUpcItemDb(PACK, { plan: 'trial', enabled: true, reserveRequest,
    fetcher: (async () => json({ code: 'OK', total: 1, offset: 0, items: [{ ...item, ean: '0008236914221', upc: '008236914221' }] })) as typeof fetch });
  assert.equal(innerOnly.status, 'incomplete');
  const exact = await lookupUpcItemDb(PACK, { plan: 'trial', enabled: true, reserveRequest,
    fetcher: (async () => json({ code: 'OK', total: 1, offset: 0, items: [{ ...item, gtin: PACK }] })) as typeof fetch });
  assert.equal(exact.status, 'found');
  if (exact.status === 'found') assert.equal(exact.candidates[0].sourceBarcode, PACK);
});

test('ambiguous or truncated provider result does not select its first row', async () => {
  const result = await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
    fetcher: (async () => json({ code: 'OK', total: 3, offset: 0, items: [item, { ...item, title: 'Other variant' }] })) as typeof fetch });
  assert.equal(result.status, 'ambiguous');
  if (result.status === 'ambiguous') {
    assert.equal(result.truncated, true);
    assert.equal(result.candidates.length, 2);
  }
});

test('inconsistent count, extra raw rows and nonzero offset cannot yield found', async () => {
  for (const envelope of [
    { total: 0, items: [item] },
    { total: 1, items: [item, null] },
    { total: 1, items: [item, { ...item, ean: '4002293401102', upc: undefined }] },
    { total: 1, offset: 1, items: [item] },
    { total: 1, offset: undefined, items: [item] },
    { total: '1', items: [item] },
    { total: -1, items: [] },
  ]) {
    const result = await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
      fetcher: (async () => json({ code: 'OK', offset: 0, ...envelope })) as typeof fetch });
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.candidates, []);
  }
  const partial = await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
    fetcher: (async () => json({ code: 'OK', total: 2, offset: 0, items: [item, null] })) as typeof fetch });
  assert.equal(partial.status, 'ambiguous');
  if (partial.status === 'ambiguous') assert.equal(partial.truncated, true);
});

test('404, 429, timeout, malformed and oversized responses fail closed', async () => {
  const statuses: [Response, string][] = [
    [json({ code: 'NOT_FOUND' }, 404), 'not_found'],
    [json({ code: 'EXCEED_LIMIT' }, 429), 'rate_limited'],
    [json({ code: 'SERVER_ERR' }, 503), 'unavailable'],
    [new Response('invalid json', { status: 200 }), 'unavailable'],
    [new Response('x'.repeat(65_537), { status: 200 }), 'unavailable'],
  ];
  for (const [response, expected] of statuses) {
    assert.equal((await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
      fetcher: (async () => response) as typeof fetch })).status, expected);
  }
  const timeoutFetcher = ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })) as typeof fetch;
  assert.equal((await lookupUpcItemDb(UPC, { plan: 'trial', enabled: true, reserveRequest,
    timeoutMs: 1, fetcher: timeoutFetcher })).status, 'unavailable');
});
