import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { handlePrivateUpcLookup } from '../supabase/functions/private-upc-lookup/handler.ts';
import { lookupUpcItemDb } from '../supabase/functions/_shared/upcitemdb-candidate.ts';
import { parsePrivateUpcLookup, requestPrivateUpcLookup, validPrivateBarcode } from '../src/presentation/external-products/privateLookup.ts';

const owner = 'e6000000-0000-4000-8000-000000000001';
const barcode = '0037000734130';
const request = (body: unknown = { barcode }) => new Request('https://example.test/private-upc-lookup', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
});
const deps = () => ({
  enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  readJsonObject: async (req: Request) => await req.json() as Record<string, unknown>,
  lookup: async () => ({ status: 'not_found' as const, candidates: [] as [], truncated: false as const }),
  failure: (code: string, _message: string, status: number) => Object.assign(new Error(code), { status }),
  respond: (value: unknown, status = 200) => new Response(JSON.stringify(value), { status }),
  errorResponse: (error: unknown) => new Response(null, { status: (error as { status?: number }).status ?? 500 }),
  corsHeaders: {},
});

test('private endpoint refuses disabled/empty allowlist/auth/other owner before lookup', async () => {
  const noLookup = async () => { throw new Error('must not query provider'); };
  for (const [overrides, status] of [
    [{ enabled: false }, 503], [{ allowedUserIds: [] }, 503],
    [{ authenticate: async () => { throw Object.assign(new Error('auth'), { status: 401 }); } }, 401],
    [{ authenticate: async () => ({ userId: 'someone-else' }) }, 403],
  ] as const) {
    assert.equal((await handlePrivateUpcLookup(request(), { ...deps(), ...overrides, lookup: noLookup })).status, status);
  }
});

test('invalid/mixed payload and wrong method never consume provider allowance', async () => {
  for (const body of [{ barcode: '12345678' }, { barcode, userId: owner }, { barcode: 37000734130 }, {}]) {
    assert.equal((await handlePrivateUpcLookup(request(body), {
      ...deps(), lookup: async () => { throw new Error('must not query'); },
    })).status, 400);
  }
  assert.equal((await handlePrivateUpcLookup(new Request('https://example.test'), deps())).status, 405);
  assert.equal((await handlePrivateUpcLookup(new Request('https://example.test', { method: 'OPTIONS' }), deps())).status, 200);
});

test('endpoint uses authenticated owner for durable reservation and exposes candidate to client', async () => {
  let reservations = 0, outbound = 0;
  const response = await handlePrivateUpcLookup(request(), {
    ...deps(), lookup: async (input, identity) => {
      assert.equal(identity.userId, owner);
      return lookupUpcItemDb(input, { enabled: true, plan: 'trial',
        reserveRequest: async () => { reservations++; return 'reserved'; },
        fetcher: async () => {
          outbound++;
          return new Response(JSON.stringify({ code: 'OK', offset: 0, total: 1,
            items: [{ ean: barcode, upc: barcode.slice(1), title: 'Old Spice Captain Deodorant 3 oz', brand: 'Old Spice', ingredients: 'ignored' }] }));
        },
      });
    },
  });
  assert.equal(response.status, 200);
  const result = parsePrivateUpcLookup(await response.json(), barcode);
  assert.equal(result.status, 'found');
  assert.equal(result.candidates[0]?.formulaVerified, false);
  assert.equal(result.candidates[0]?.canonicalProductId, null);
  assert.equal('ingredients' in result.candidates[0]!, false);
  assert.equal(reservations, 1); assert.equal(outbound, 1);
});

test('endpoint preserves upstream/budget 429 and unavailable 503 without retries', async () => {
  for (const [status, http] of [['rate_limited', 429], ['unavailable', 503], ['configuration_required', 503]] as const) {
    const response = await handlePrivateUpcLookup(request(), { ...deps(), lookup: async () => ({ status, candidates: [], truncated: false }) });
    assert.equal(response.status, http);
  }
});

test('client rejects injected formula trust, wrong barcode/source URL and malformed envelopes', () => {
  const candidate = { source: 'upcitemdb', rightsPolicy: 'internal_evaluation_only', observedBarcode: barcode,
    sourceBarcode: barcode, sourceRecordId: barcode, sourceUrl: 'https://api.upcitemdb.com/prod/trial/lookup?upc=' + barcode,
    retrievedAt: '2026-09-30T00:00:00Z', name: 'Old Spice Captain', brand: 'Old Spice', size: null, category: null,
    canonicalProductId: null, formulaVerified: false };
  const envelope = (overrides = {}) => ({ status: 'found', candidates: [{ ...candidate, ...overrides }], truncated: false });
  assert.equal(parsePrivateUpcLookup(envelope(), barcode).status, 'found');
  for (const overrides of [{ formulaVerified: true }, { canonicalProductId: owner }, { observedBarcode: '3606000537538' },
    { sourceUrl: 'https://evil.example' }, { name: '' }, { category: 42 }, { rightsPolicy: 'approved' }]) {
    assert.throws(() => parsePrivateUpcLookup(envelope(overrides), barcode), /INVALID_UPC_RESPONSE/);
  }
  const projected = parsePrivateUpcLookup(envelope({ ingredients: ['invented'], images: ['private'] }), barcode);
  assert.equal('ingredients' in projected.candidates[0]!, false);
  assert.equal('images' in projected.candidates[0]!, false);
  assert.equal(validPrivateBarcode(barcode), true);
  assert.equal(validPrivateBarcode('12345678'), false);
});

test('client pins owner before and after response; quota response is typed', async () => {
  let current: string | null = owner, calls = 0;
  const client = { functions: { invoke: async (name: string, options: { body: object }) => {
    calls++; assert.equal(name, 'private-upc-lookup'); assert.deepEqual(options.body, { barcode });
    current = null; return { data: { status: 'not_found', candidates: [], truncated: false }, error: null };
  } } };
  await assert.rejects(requestPrivateUpcLookup(barcode, owner, () => current, client), /OWNER_CHANGED/);
  assert.equal(calls, 1);
  await assert.rejects(requestPrivateUpcLookup(barcode, owner, () => current, client), /OWNER_CHANGED/);
  assert.equal(calls, 1);
  const limited = await requestPrivateUpcLookup(barcode, owner, () => owner, { functions: {
    invoke: async () => ({ data: null, error: { context: { status: 429 } } }),
  } });
  assert.equal(limited.status, 'rate_limited');
});

test('private phone route stays development-only and outside canonical Check composition', () => {
  const source = readFileSync(new URL('../app/upc-test.tsx', import.meta.url), 'utf8');
  assert.match(source, /__DEV__ && publicEnvironment.buildFlavor === 'development'/);
  assert.match(source, /locked.current/);
  assert.match(source, /sequence.current/);
  assert.doesNotMatch(source, /resolveCatalogIdentity|evaluateProduct|recordFreeCheck|\.insert\(|\.upsert\(/);
});
