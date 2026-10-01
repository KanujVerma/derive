import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupProductIngredients, parseProductIngredientQuery } from '../supabase/functions/_shared/product-ingredient-lookup.ts';
import { handleProductIngredients } from '../supabase/functions/private-product-ingredients/handler.ts';
import { parseProductIngredientLookup, requestProductIngredients, productIngredientKey } from '../src/presentation/external-products/productIngredients.ts';
import type { ProductIngredientLookup, PublishedIngredientEvidence } from '../src/contracts/ProductIngredientLookup.ts';

const owner = 'e6000000-0000-4000-8000-000000000001';
const query = { barcode: '0012044038840', name: 'Old Spice Fresh High Endurance Deodorant', brand: 'Old Spice', size: '3 oz' };
const evidence: PublishedIngredientEvidence = { source: 'open_beauty_facts', sourceUrl: 'https://world.openbeautyfacts.org/product/0012044038840',
  sourceLicense: 'ODbL-1.0', retrievedAt: '2026-09-30T00:00:00Z', sourceModifiedAt: null, barcode: query.barcode,
  productName: query.name, brand: query.brand, quantity: query.size, ingredientsText: 'Water, Glycerin', matchBasis: 'barcode',
  formulaVerified: false, canonicalProductId: null };
const result = (): ProductIngredientLookup => ({ status: 'found', query, evidence: [{ ...evidence }],
  sources: [{ source: 'open_beauty_facts', status: 'found' }, { source: 'dailymed', status: 'not_found' }], rightsPolicy: 'private_evaluation_only' });

test('identity-only query supports barcode miss, rejects profile/owner and excessive identity', () => {
  assert.deepEqual(parseProductIngredientQuery(query), query);
  assert.deepEqual(parseProductIngredientQuery({ barcode: query.barcode, name: null, brand: null, size: null }), { barcode: query.barcode, name: null, brand: null, size: null });
  for (const bad of [{ ...query, barcode: '12345678' }, { ...query, userId: owner }, { ...query, profile: {} },
    { ...query, name: null }, { ...query, name: 'x'.repeat(181) }, { ...query, name: 'x\n' }]) assert.throws(() => parseProductIngredientQuery(bad));
});

test('two sources start in parallel; evidence stays separate and never canonical', async () => {
  let release!: () => void; let starts = 0;
  const gate = new Promise<void>(r => { release = r; });
  const run = async () => { starts++; if (starts === 2) release(); await gate; return { status: 'found' as const, evidence }; };
  const answer = await lookupProductIngredients(query, { reserve: async () => 'reserved', obf: run,
    dailyMed: async () => { const r = await run(); return { ...r, evidence: { ...evidence, source: 'dailymed', sourceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + owner,
      sourceLicense: 'DailyMed-public-label', matchBasis: 'name_variant', barcode: null } }; } });
  assert.equal(starts, 2); assert.equal(answer.status, 'found'); assert.equal(answer.evidence.length, 2);
  assert.ok(answer.evidence.every(e => e.formulaVerified === false && e.canonicalProductId === null));
});

test('one failed source cannot discard ingredients returned by another', async () => {
  const answer = await lookupProductIngredients(query, { reserve: async () => 'reserved', obf: async () => { throw Error('network'); },
    dailyMed: async () => ({ status: 'found', evidence: { ...evidence, source: 'dailymed', sourceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + owner,
      sourceLicense: 'DailyMed-public-label', matchBasis: 'name_variant', barcode: null } }) });
  assert.equal(answer.status, 'found'); assert.equal(answer.sources[0].status, 'unavailable');
});

test('budget denies all outbound calls, barcode-only never sends a fake NDC/name to DailyMed', async () => {
  const never = async (): Promise<{ status: 'not_found' }> => { throw Error('must not run'); };
  assert.equal((await lookupProductIngredients(query, { reserve: async () => 'rate_limited', obf: never, dailyMed: never })).status, 'rate_limited');
  const answer = await lookupProductIngredients({ barcode: query.barcode, name: null, brand: null, size: null }, { reserve: async () => 'reserved',
    obf: async q => { assert.equal(q.name, ''); return { status: 'not_found' }; }, dailyMed: never });
  assert.equal(answer.status, 'not_found'); assert.equal(answer.sources[1].status, 'not_queried');
});

test('client rejects trusted-formula injection, wrong barcode, source host/license and inconsistent envelopes', () => {
  assert.deepEqual(parseProductIngredientLookup(result(), query), result());
  for (const change of [{ formulaVerified: true }, { canonicalProductId: owner }, { barcode: '3606000537538' },
    { sourceUrl: 'https://evil.com/a' }, { sourceUrl: 'https://world.openbeautyfacts.org@evil.com/product/0012044038840' },
    { sourceLicense: 'public' }, { ingredientsText: '' }, { sourceModifiedAt: 'not date' }]) {
    assert.throws(() => parseProductIngredientLookup({ ...result(), evidence: [{ ...evidence, ...change }] }, query));
  }
  assert.throws(() => parseProductIngredientLookup({ ...result(), status: 'not_found' }, query));
  assert.throws(() => parseProductIngredientLookup({ ...result(), sources: [] }, query));
  const projected = parseProductIngredientLookup({ ...result(), evidence: [{ ...evidence, score: 100, personalFit: 'safe' }] }, query);
  assert.equal('score' in projected.evidence[0], false);
});

test('client posts only identity and prevents owner/query switch publishing', async () => {
  let scope = owner + ':' + productIngredientKey(query);
  const client = { functions: { invoke: async (name: string, opts: { body: object }) => {
    assert.equal(name, 'private-product-ingredients'); assert.deepEqual(opts.body, query);
    scope = ''; return { data: result(), error: null };
  } } };
  await assert.rejects(requestProductIngredients(query, owner, () => scope, client), /SCOPE_CHANGED/);
});

test('client retains typed rate-limit response body', async () => {
  const limited: ProductIngredientLookup = { ...result(), status: 'rate_limited', evidence: [], sources: [] };
  const answer = await requestProductIngredients(query, owner, () => owner + ':' + productIngredientKey(query), { functions: {
    invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify(limited), { status: 429 }) } }),
  } });
  assert.equal(answer.status, 'rate_limited');
});

const deps = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  lookup: async () => result(), failure: (code: string, _message: string, status: number) => Object.assign(Error(code), { status }),
  respond: (v: unknown, status = 200) => new Response(JSON.stringify(v), { status }),
  errorResponse: (e: unknown) => new Response(null, { status: (e as { status?: number }).status ?? 500 }), corsHeaders: {} });
const request = (body: unknown = query) => new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) });
test('HTTP auth/allowlist/input gates precede outbound queries', async () => {
  const never = async (): Promise<ProductIngredientLookup> => { throw Error('must not run'); };
  for (const [overrides, status] of [[{ enabled: false }, 503], [{ allowedUserIds: [] }, 503],
    [{ authenticate: async () => ({ userId: 'another-owner' }) }, 403],
    [{ authenticate: async () => { throw Object.assign(Error('auth'), { status: 401 }); } }, 401]] as const) {
    assert.equal((await handleProductIngredients(request(), { ...deps(), ...overrides, lookup: never })).status, status);
  }
  assert.equal((await handleProductIngredients(request({ ...query, ownerId: owner }), { ...deps(), lookup: never })).status, 400);
  assert.equal((await handleProductIngredients(request({ ...query, name: 'x'.repeat(5000) }), { ...deps(), lookup: never })).status, 413);
  assert.equal((await handleProductIngredients(new Request('https://example.test'), deps())).status, 405);
});
test('HTTP passes authenticated identity and bounded query, with partial-success body', async () => {
  const response = await handleProductIngredients(request(), { ...deps(), lookup: async (q, auth) => {
    assert.deepEqual(q, query); assert.equal(auth.userId, owner); return result();
  } });
  assert.equal(response.status, 200); assert.equal(parseProductIngredientLookup(await response.json(), query).status, 'found');
});
