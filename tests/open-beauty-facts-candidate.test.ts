import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { lookupOpenBeautyFacts } from '../supabase/functions/_shared/open-beauty-facts-candidate.ts';

const BARCODE = '3560070791460';
const agent = 'Derive/0.1 (https://github.com/KanujVerma/derive)';
const found = (product: Record<string, unknown> = {}) => new Response(JSON.stringify({
  code: BARCODE, status: 'success', result: { id: 'product_found' },
  product: { code: BARCODE, brands: 'Carrefour', product_name: 'Solution dentaire',
    quantity: '500 ml', categories: 'Mouthwash', last_modified_t: 1491327417, ...product },
}), { status: 200, headers: { 'content-type': 'application/json' } });

test('OBF read-through returns bounded candidate identity and provenance, never canonical/formula truth', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const result = await lookupOpenBeautyFacts(BARCODE, {
    userAgent: agent, now: () => new Date('2026-09-28T00:00:00Z'),
    fetcher: async (url, init) => { calls.push({ url: String(url), init }); return found(); },
  });
  assert.equal(result.status, 'found');
  if (result.status !== 'found') return;
  assert.deepEqual(result.candidate, {
    source: 'open_beauty_facts', sourceLicense: 'ODbL-1.0',
    sourceUrl: `https://world.openbeautyfacts.org/product/${BARCODE}`,
    retrievedAt: '2026-09-28T00:00:00.000Z', sourceModifiedAt: '2017-04-04T17:36:57.000Z',
    barcode: BARCODE, brand: 'Carrefour', name: 'Solution dentaire',
    quantity: '500 ml', category: 'Mouthwash', canonicalProductId: null, formulaVerified: false,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://world.openbeautyfacts.org/api/v3/product/${BARCODE}.json?fields=code,brands,product_name,quantity,categories,last_modified_t`);
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal((calls[0].init?.headers as Record<string, string>)['User-Agent'], agent);
});

test('OBF absence, missing name, alias barcode, and provider failures stay untrusted', async () => {
  const lookup = (response: Response) => lookupOpenBeautyFacts(BARCODE, { userAgent: agent, fetcher: async () => response });
  assert.deepEqual(await lookup(new Response(null, { status: 404 })), { status: 'not_found', candidate: null });
  assert.deepEqual(await lookup(new Response(null, { status: 429 })), { status: 'rate_limited', candidate: null });
  assert.deepEqual(await lookup(new Response(null, { status: 503 })), { status: 'unavailable', candidate: null });
  assert.deepEqual(await lookup(found({ product_name: '   ' })), { status: 'incomplete', candidate: null });
  assert.deepEqual(await lookup(found({ code: '12345670' })), { status: 'unavailable', candidate: null });
  assert.deepEqual(await lookup(new Response(JSON.stringify({ status: 'success', result: { id: 'product_not_found' } }))),
    { status: 'not_found', candidate: null });
  assert.deepEqual(await lookup(new Response('{bad')), { status: 'unavailable', candidate: null });
  assert.deepEqual(await lookup(new Response('x'.repeat(32_769))), { status: 'unavailable', candidate: null });
  assert.deepEqual(await lookupOpenBeautyFacts(BARCODE, { userAgent: agent, fetcher: async () => { throw new Error('offline'); } }),
    { status: 'unavailable', candidate: null });
});

test('OBF labels are length/control bounded and invalid GTIN never calls provider', async () => {
  const result = await lookupOpenBeautyFacts(BARCODE, { userAgent: agent,
    fetcher: async () => found({ brands: '\u0000Acme\n  Skin', product_name: 'x'.repeat(200), last_modified_t: 'bad' }),
  });
  assert.equal(result.status, 'found');
  if (result.status !== 'found') return;
  assert.equal(result.candidate.brand, 'Acme Skin');
  assert.equal(result.candidate.name.length, 180);
  assert.equal(result.candidate.sourceModifiedAt, null);
  await assert.rejects(lookupOpenBeautyFacts('12345678', { userAgent: agent, fetcher: async () => { throw new Error('called'); } }), /INVALID_BARCODE/);
});

test('evaluation endpoint is disabled by default and never writes catalog/cases', () => {
  const source = readFileSync(new URL('../supabase/functions/external-product-candidates/index.ts', import.meta.url), 'utf8');
  assert.match(source, /DERIVE_OBF_CANDIDATES_ENABLED/);
  assert.match(source, /!== 'true'/);
  assert.match(source, /authenticate\(req\)/);
  assert.doesNotMatch(source, /\.from\(|\.rpc\(|insert\(|upsert\(|update\(/);
});
