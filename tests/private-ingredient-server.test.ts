import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGroundedAnswer, parseIngredientQuery, safeGroundedUrl, safeSearchSuggestions, searchPublishedIngredients }
  from '../supabase/functions/_shared/private-ingredient-search.ts';
import { handlePrivateIngredientSearch } from '../supabase/functions/private-ingredient-search/handler.ts';

const query = { barcode: '0037000734130', name: 'Old Spice Captain Deodorant 3 oz', brand: 'Old Spice', size: '3 oz' };
const owner = 'e6000000-0000-4000-8000-000000000001';
const suggestion = '<style>.chip{color:#222}</style><a href="https://www.google.com/search?q=Old+Spice">Search</a>';
const provider = (text = 'Published list not found.') => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] },
  groundingMetadata: { webSearchQueries: ['Old Spice ingredients'], searchEntryPoint: { renderedContent: suggestion },
    groundingChunks: [{ web: { title: 'Manufacturer', uri: 'https://oldspice.com/products/captain' } }],
    groundingSupports: [{ segment: { startIndex: 0, endIndex: new TextEncoder().encode(text).length, text }, groundingChunkIndices: [0] }] },
}] });

test('ingredient input is bounded, exact and never accepts profile/photos/owner/inferred formula', () => {
  assert.deepEqual(parseIngredientQuery(query), query);
  for (const bad of [{ ...query, userId: owner }, { ...query, ingredients: ['fake'] }, { ...query, name: '' },
    { ...query, barcode: '12345678' }, { ...query, name: 'a'.repeat(181) }, { ...query, brand: 1 }, { ...query, size: 'x\n' }]) {
    assert.throws(() => parseIngredientQuery(bad), /INVALID_INGREDIENT_QUERY/);
  }
});

test('grounded output preserves full text, sources and suggestions, never promotes formula', () => {
  const text = 'Café — the exact variant was not found.\nCheck the package.';
  const answer = parseGroundedAnswer(provider(text), query);
  assert.equal(answer.status, 'grounded_answer');
  if (answer.status !== 'grounded_answer') return;
  assert.equal(answer.text, text); assert.equal(answer.searchSuggestionsHtml, suggestion);
  assert.equal(answer.formulaVerified, false); assert.equal(answer.canonicalProductId, null);
  assert.equal('ingredients' in answer, false);
});

test('missing search/citations, truncated output and non-UTF8 citation boundaries fail closed', () => {
  for (const mutate of [
    (v: ReturnType<typeof provider>) => { v.candidates[0].finishReason = 'MAX_TOKENS'; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.webSearchQueries = []; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.groundingSupports = []; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.searchEntryPoint.renderedContent = ''; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.groundingSupports[0].segment.endIndex = 1; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices = [999]; },
    (v: ReturnType<typeof provider>) => { v.candidates[0].groundingMetadata.groundingChunks[0].web.uri = 'http://localhost'; },
  ]) {
    const value = provider('é: unclear variant'); mutate(value);
    assert.equal(parseGroundedAnswer(value, query).status, 'no_grounded_answer');
  }
});

test('suggestion HTML is rejected rather than sanitized when unsafe; only public HTTPS links', () => {
  assert.equal(safeSearchSuggestions(suggestion), true);
  for (const html of [suggestion + '<script>alert(1)</script>', suggestion + '<img src="https://evil.com/a">',
    '<a href="javascript:alert(1)">x</a>', suggestion + '<iframe></iframe>', suggestion + '<div onclick="x()">x</div>',
    suggestion + '<style>@import "https://evil.com/x"</style>']) assert.equal(safeSearchSuggestions(html), false);
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://127.0.0.1', 'https://[::1]',
    'https://example.local', 'https://example.com:1234', 'https://2130706433', 'https://example.com\\@evil.com']) assert.equal(safeGroundedUrl(url), false);
  assert.equal(safeGroundedUrl('https://vertexaisearch.cloud.google.com/grounding-api-redirect/foo'), true);
});

test('provider reserves before one server-key request, product identity only and no fallback/retry', async () => {
  let reservations = 0, calls = 0;
  const answer = await searchPublishedIngredients(query, { apiKey: 'private-test-key', reserveRequest: async () => { reservations++; return 'reserved'; },
    fetcher: async (url, init) => {
      calls++; assert.match(String(url), /gemini-3\.8-flash:generateContent$/);
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'private-test-key');
      assert.equal(init?.redirect, 'error');
      const body = JSON.parse(init!.body as string);
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      assert.match(body.contents[0].parts[0].text, /Old Spice/);
      assert.doesNotMatch(body.contents[0].parts[0].text, /private-test-key|e6000000|skin.*profile/);
      return new Response(JSON.stringify(provider()));
    } });
  assert.equal(answer.status, 'grounded_answer'); assert.equal(reservations, 1); assert.equal(calls, 1);
});

test('empty key and denied budget do not call Google, provider quota/config/errors remain typed', async () => {
  const noFetch = async () => { throw new Error('must not call'); };
  const noReserve = async (): Promise<'reserved'> => { throw new Error('must not reserve'); };
  assert.equal((await searchPublishedIngredients(query, { apiKey: '', reserveRequest: noReserve, fetcher: noFetch })).status, 'configuration_required');
  assert.equal((await searchPublishedIngredients(query, { apiKey: 'key', reserveRequest: async () => 'rate_limited', fetcher: noFetch })).status, 'rate_limited');
  for (const [http, status] of [[429, 'rate_limited'], [403, 'configuration_required'], [404, 'configuration_required'], [503, 'unavailable']] as const) {
    let calls = 0;
    assert.equal((await searchPublishedIngredients(query, { apiKey: 'key', reserveRequest: async () => 'reserved',
      fetcher: async () => { calls++; return new Response('{}', { status: http }); } })).status, status);
    assert.equal(calls, 1);
  }
  assert.equal((await searchPublishedIngredients(query, { apiKey: 'key', reserveRequest: async () => 'reserved',
    fetcher: async () => new Response('x'.repeat(131073)) })).status, 'unavailable');
});

const deps = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  search: async () => ({ status: 'no_grounded_answer' as const }),
  failure: (code: string, _message: string, status: number) => Object.assign(new Error(code), { status }),
  respond: (value: unknown, status = 200) => new Response(JSON.stringify(value), { status }),
  errorResponse: (err: unknown) => new Response(null, { status: (err as { status?: number }).status ?? 500 }), corsHeaders: {},
});
const request = (body: unknown = query) => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('endpoint denies disabled/other owner/auth and malformed payload before provider', async () => {
  const noSearch = async (): Promise<{ status: 'no_grounded_answer' }> => { throw Error('must not search'); };
  assert.equal((await handlePrivateIngredientSearch(request(), { ...deps(), enabled: false, search: noSearch })).status, 503);
  assert.equal((await handlePrivateIngredientSearch(request(), { ...deps(), allowedUserIds: [], search: noSearch })).status, 503);
  assert.equal((await handlePrivateIngredientSearch(request(), { ...deps(), authenticate: async () => ({ userId: 'other' }), search: noSearch })).status, 403);
  assert.equal((await handlePrivateIngredientSearch(request(), { ...deps(), authenticate: async () => { throw Object.assign(Error(), { status: 401 }); }, search: noSearch })).status, 401);
  assert.equal((await handlePrivateIngredientSearch(request({ ...query, profile: {} }), { ...deps(), search: noSearch })).status, 400);
  assert.equal((await handlePrivateIngredientSearch(request({ name: 'x'.repeat(5000) }), { ...deps(), search: noSearch })).status, 413);
  assert.equal((await handlePrivateIngredientSearch(new Request('https://example.com'), deps())).status, 405);
});

test('endpoint forwards only parsed product identity and authenticated owner; keeps quota/config status', async () => {
  for (const [status, http] of [['rate_limited', 429], ['configuration_required', 503], ['no_grounded_answer', 200]] as const) {
    const response = await handlePrivateIngredientSearch(request(), { ...deps(), search: async (input, identity) => {
      assert.deepEqual(input, query); assert.equal(identity.userId, owner); return { status };
    } });
    assert.equal(response.status, http);
  }
});
