import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildWebIngredientSearchQuery, ingredientPageText, lookupWebProductIngredients, parseWebIngredientExtraction,
  parseWebProductIngredientsRequest, safeIngredientPageUrl, sameIngredientProduct }
  from '../supabase/functions/_shared/web-product-ingredients.ts';
import { handlePrivateWebProductIngredients } from '../supabase/functions/private-web-product-ingredients/handler.ts';
import type { IngredientWebPage } from '../supabase/functions/_shared/web-product-ingredients.ts';

const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 Oz',
  brand: 'Old Spice', size: '3 oz' };
const title = 'Old Spice High Endurance Fresh Deodorant';
const list = 'Water, Propylene Glycol, Sodium Stearate, Fragrance.';
const pageUrl = 'https://www.target.com/p/old-spice-fresh/-/A-123456';
const html = `<html><head><title>${title}</title><script>Secret fabricated formula</script><style>.bad{display:none}</style></head>
  <body><nav>Unrelated other product</nav><h1>${title}</h1><p>Ingredients: ${list}</p></body></html>`;
const page: IngredientWebPage = { url: pageUrl, title, text: `${title} Ingredients: ${list}` };
const extracted = { status: 'found', sourceIndex: 0, productName: title, ingredientsText: list };
const provider = (value: unknown = extracted) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const keys = { serpApiKey: 'fixture-search-key', geminiApiKey: 'fixture-model-key', reserveRequest: async (): Promise<'reserved'> => 'reserved' };
const searchPayload = (organic_results: { link: string }[]) => ({
  search_parameters: { engine: 'google_light', q: buildWebIngredientSearchQuery(query) },
  organic_results,
});

test('web query is bounded valid barcode identity only, not URLs, owner, photos or skin context', () => {
  assert.deepEqual(parseWebProductIngredientsRequest(query), query);
  for (const value of [{ ...query, barcode: '12345678' }, { ...query, name: '' }, { ...query, name: 'a'.repeat(181) },
    { ...query, profile: {} }, { ...query, userId: 'owner' }, { ...query, sourceUrl: pageUrl },
    { ...query, photos: [] }, { ...query, brand: 7 }, { ...query, size: '3 oz\n' }]) {
    assert.throws(() => parseWebProductIngredientsRequest(value), /INVALID_WEB_INGREDIENT_QUERY/);
  }
});

test('search prioritizes known official manufacturer, deduplicates brand and quantity without losing variant or SPF', () => {
  assert.equal(buildWebIngredientSearchQuery(query), query.name + ' ingredients site:oldspice.com');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Daily Moisturizing Lotion', brand: 'Aveeno', size: '12 fl oz' }),
    'Aveeno Daily Moisturizing Lotion 12 fl oz ingredients site:aveeno.com');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Aveeno Daily Moisturizing Lotion 12 fl oz', brand: 'Aveeno', size: 'One 12 fl oz Bottle' }),
    'Aveeno Daily Moisturizing Lotion 12 fl oz ingredients site:aveeno.com');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'CeraVe AM Facial Moisturizing Lotion SPF 30', brand: 'CeraVe', size: '3 oz' }),
    'CeraVe AM Facial Moisturizing Lotion SPF 30 3 oz ingredients site:cerave.com');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Old Spice High Endurance Fresh Deodorant', brand: null, size: null }),
    'Old Spice High Endurance Fresh Deodorant ingredients site:oldspice.com');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Other Brand Fresh Aerosol Deodorant', brand: 'Other Brand', size: '4 oz' }),
    'Other Brand Fresh Aerosol Deodorant 4 oz ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Moisturizing Cream', brand: 'https://evil.com', size: null }),
    'https://evil.com Moisturizing Cream ingredients');
});

test('only exact HTTPS official source hosts may be fetched; private hosts and redirect/proxy URLs rejected', () => {
  for (const host of ['aveeno.com', 'www.oldspice.com', 'cerave.com', 'www.cetaphil.com', 'neutrogena.com',
    'www.target.com', 'walgreens.com', 'www.walmart.com', 'cvs.com']) {
    assert.equal(safeIngredientPageUrl('https://' + host + '/products/example#ingredients'), 'https://' + host + '/products/example');
  }
  for (const value of ['http://target.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a',
    'https://www.target.com.evil.com/a', 'https://evil.target.com/a', 'https://user:pass@target.com/a',
    'https://www.target.com:8443/a', 'https://www.target.com./a', 'https://www.target.com\\@evil.com/a',
    'https://www.target.com/redirect/a', 'https://www.target.com/fetch/a', 'https://www.target.com/a?url=http://localhost',
    'https://www.target.com/a?next=https://evil.com', 'https://www.target.com/a\n']) {
    assert.equal(safeIngredientPageUrl(value), null, value);
  }
});

test('HTML strips executable/navigation noise and normalizes visible ingredient text and heading entities', () => {
  const result = ingredientPageText(html);
  assert.match(result.title, /Old Spice High Endurance Fresh Deodorant/);
  assert.match(result.text, /Water, Propylene Glycol/);
  assert.doesNotMatch(result.text, /Secret fabricated|Unrelated other|display:none|script|nav/);
  const entities = ingredientPageText('<title>Aveeno</title><h1>Daily Moisturizing Lotion</h1><p>Ingredients: Water,&#32;Glycerin&nbsp;&amp; Oat.</p>');
  assert.equal(entities.title, 'Daily Moisturizing Lotion | Aveeno');
  assert.match(entities.text, /Water, Glycerin & Oat\./);
});

test('variant/form guards distinguish plain deodorant, antiperspirant, sprays, scent and SPF', () => {
  assert.equal(sameIngredientProduct(query, title), true);
  for (const name of ['Old Spice High Endurance Fresh Antiperspirant Deodorant',
    'Old Spice High Endurance Pure Sport Deodorant', 'Old Spice High Endurance Fresh Deodorant Dry Spray',
    'Old Spice High Endurance Fresh Deodorant Aerosol', 'Old Spice Fresh Body Wash']) {
    assert.equal(sameIngredientProduct(query, name), false, name);
  }
  const sunscreen = { ...query, name: 'CeraVe AM Facial Moisturizing Lotion SPF 30', brand: 'CeraVe' };
  assert.equal(sameIngredientProduct(sunscreen, 'CeraVe AM Facial Moisturizing Lotion SPF 30'), true);
  assert.equal(sameIngredientProduct(sunscreen, 'CeraVe AM Facial Moisturizing Lotion SPF 50'), false);
});

test('model can only return a verbatim list from an indexed fetched page, not invented facts or another variant', () => {
  const result = parseWebIngredientExtraction(extracted, query, [page], new Date('2026-10-01T12:00:00Z'));
  assert.deepEqual(result, { status: 'found', evidence: { productName: title, ingredientsText: list,
    sourceUrl: pageUrl, sourceName: 'target.com', retrievedAt: '2026-10-01T12:00:00.000Z', basis: 'published_web', formulaVerified: false } });
  assert.equal(parseWebIngredientExtraction({ ...extracted, ingredientsText: 'Water, Fake Ingredient.' }, query, [page]).status, 'not_found');
  assert.equal(parseWebIngredientExtraction({ ...extracted, ingredientsText: 'Water,\nPropylene Glycol,  Sodium Stearate, Fragrance.' }, query, [page]).status, 'found');
  assert.equal(parseWebIngredientExtraction({ ...extracted, productName: title + ' Antiperspirant' }, query, [page]).status, 'ambiguous');
  assert.equal(parseWebIngredientExtraction(extracted, query, [{ ...page, title: 'Old Spice Pure Sport Deodorant' }]).status, 'ambiguous');
  for (const value of [{ ...extracted, sourceIndex: 5 }, { ...extracted, sourceUrl: 'https://evil.com' },
    { ...extracted, score: 99 }, { ...extracted, ingredientsText: 'x'.repeat(16001) }]) {
    assert.equal(parseWebIngredientExtraction(value, query, [page]).status, 'unavailable');
  }
  for (const status of ['not_found', 'ambiguous'] as const) assert.equal(parseWebIngredientExtraction({ status, sourceIndex: null,
    productName: null, ingredientsText: null }, query, [page]).status, status);
});

test('one private budget precedes search, at most top five pages run concurrently, one extraction call uses no search tools', async () => {
  let reserved = 0, pageCalls = 0, modelCalls = 0, activePages = 0, maxPages = 0;
  const result = await lookupWebProductIngredients(query, { ...keys,
    reserveRequest: async () => { reserved++; return 'reserved'; },
    now: () => new Date('2026-10-01T12:00:00Z'),
    fetcher: async (url, init) => {
      assert.equal(reserved, 1);
      const parsed = new URL(String(url));
      if (parsed.hostname === 'serpapi.com') {
        assert.equal(parsed.pathname, '/search.json'); assert.equal(parsed.searchParams.get('engine'), 'google_light');
        assert.equal(parsed.searchParams.has('num'), false); assert.equal(parsed.searchParams.get('gl'), 'us');
        assert.equal(parsed.searchParams.get('hl'), 'en'); assert.equal(parsed.searchParams.get('api_key'), keys.serpApiKey);
        assert.equal(parsed.searchParams.get('q'), query.name + ' ingredients site:oldspice.com');
        assert.equal(init?.redirect, 'error');
        return new Response(JSON.stringify(searchPayload(Array.from({ length: 8 }, (_v, index) => ({ link: pageUrl + '?id=' + index })))));
      }
      if (parsed.hostname === 'generativelanguage.googleapis.com') {
        modelCalls++; assert.equal(pageCalls, 5); assert.equal(init?.redirect, 'error');
        assert.equal((init!.headers as Record<string, string>)['x-goog-api-key'], keys.geminiApiKey);
        const body = JSON.parse(init!.body as string); assert.equal('tools' in body, false);
        assert.equal(body.generationConfig.responseMimeType, 'application/json');
        assert.doesNotMatch(init!.body as string, /fixture-search-key|fixture-model-key|skin.*profile|e6000000/);
        return new Response(JSON.stringify(provider()));
      }
      pageCalls++; activePages++; maxPages = Math.max(maxPages, activePages);
      assert.equal(init?.redirect, 'manual');
      await new Promise(resolve => setTimeout(resolve, 5)); activePages--;
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  assert.equal(result.status, 'found'); assert.equal(reserved, 1); assert.equal(pageCalls, 5);
  assert.equal(maxPages, 5); assert.equal(modelCalls, 1);
});

test('unsafe organic links and redirects never fetch the suggested private or unrelated URL', async () => {
  const fetched: string[] = [];
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    const value = String(url); fetched.push(value);
    if (value.startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([
      { link: 'https://127.0.0.1/a' }, { link: 'https://evil.com/a' }, { link: pageUrl },
    ])));
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  } });
  assert.equal(result.status, 'not_found'); assert.equal(fetched.length, 2); assert.equal(fetched[1], pageUrl);
});

test('safe manufacturer redirects retain actual final source URL', async () => {
  let pageCalls = 0;
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: 'https://oldspice.com/products/fresh' }])));
    if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response(JSON.stringify(provider()));
    pageCalls++;
    if (pageCalls === 1) return new Response(null, { status: 301, headers: { location: 'https://www.oldspice.com/products/fresh' } });
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.evidence.sourceUrl, 'https://www.oldspice.com/products/fresh');
  assert.equal(pageCalls, 2);
});

test('missing keys, invalid model and denied private budget make no network requests', async () => {
  let calls = 0, reserved = 0;
  const fetcher: typeof fetch = async () => { calls++; throw Error('unexpected'); };
  const reserveRequest = async (): Promise<'reserved'> => { reserved++; return 'reserved'; };
  for (const override of [{ serpApiKey: '' }, { geminiApiKey: '' }, { model: '../../other' }]) {
    assert.equal((await lookupWebProductIngredients(query, { ...keys, reserveRequest, fetcher, ...override })).status, 'configuration_required');
  }
  assert.equal(reserved, 0); assert.equal(calls, 0);
  assert.equal((await lookupWebProductIngredients(query, { ...keys, fetcher, reserveRequest: async () => 'rate_limited' })).status, 'rate_limited');
  assert.equal(calls, 0);
});

test('HTTP 200 with missing or unrelated echoed query is not accepted as a successful search', async () => {
  for (const response of [
    { organic_results: [{ link: pageUrl }] },
    { ...searchPayload([{ link: pageUrl }]), search_parameters: { q: '3' } },
  ]) {
    let calls = 0;
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      calls++; assert.match(String(url), /^https:\/\/serpapi\.com\/search\.json\?/);
      return new Response(JSON.stringify(response));
    } });
    assert.deepEqual(result, { status: 'unavailable' }); assert.equal(calls, 1);
  }
});

test('search/model quota and missing permission remain typed and never leak provider URLs or keys', async () => {
  for (const [http, status] of [[429, 'rate_limited'], [403, 'configuration_required'], [503, 'unavailable']] as const) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async () => new Response('{}', { status: http }) });
    assert.deepEqual(result, { status });
  }
  for (const [http, status] of [[429, 'rate_limited'], [404, 'configuration_required'], [503, 'unavailable']] as const) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
      if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response('{}', { status: http });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } });
    assert.deepEqual(result, { status });
  }
});

test('bounded oversized provider/page bodies and malformed model output fail cleanly', async () => {
  assert.equal((await lookupWebProductIngredients(query, { ...keys, fetcher: async () => new Response('x'.repeat(262145)) })).status, 'unavailable');
  for (const modelBody of ['{}', JSON.stringify(provider({ ...extracted, ingredientsText: 'Fake A, Fake B.' })), 'x'.repeat(65537)]) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
      if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response(modelBody);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } });
    assert.equal(result.status, modelBody.includes('Fake A') ? 'not_found' : 'unavailable');
  }
  const oversizedPage = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
    return new Response('x'.repeat(1048577), { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(oversizedPage.status, 'not_found');
});

test('search and extraction request timeout aborts without retries', async () => {
  for (const phase of ['search', 'model'] as const) {
    let calls = 0;
    const result = await lookupWebProductIngredients(query, { ...keys, searchTimeoutMs: 5, modelTimeoutMs: 5,
      fetcher: async (url, init) => {
        const search = String(url).startsWith('https://serpapi.com/');
        const model = String(url).startsWith('https://generativelanguage.googleapis.com/');
        if (phase === 'search' && search || phase === 'model' && model) {
          calls++; await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(Error('timeout')), { once: true }));
          throw Error('unreachable');
        }
        if (search) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      },
    });
    assert.equal(result.status, 'unavailable'); assert.equal(calls, 1);
  }
});

const owner = 'e6000000-0000-4000-8000-000000000001';
const deps = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  lookup: async () => ({ status: 'not_found' as const }),
  failure: (code: string, _message: string, status: number) => Object.assign(Error(code), { status }),
  respond: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
  errorResponse: (error: unknown) => new Response(null, { status: (error as { status?: number }).status ?? 500 }), corsHeaders: {},
});
const request = (body: unknown = query) => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('endpoint blocks disabled, missing auth, non-allowlisted owners and forged context before provider', async () => {
  let calls = 0;
  const lookup = async () => { calls++; return { status: 'not_found' as const }; };
  for (const [overrides, status] of [[{ enabled: false }, 503], [{ allowedUserIds: [] }, 503],
    [{ authenticate: async () => ({ userId: 'other' }) }, 403],
    [{ authenticate: async () => { throw Object.assign(Error(), { status: 401 }); } }, 401]] as const) {
    assert.equal((await handlePrivateWebProductIngredients(request(), { ...deps(), lookup, ...overrides })).status, status);
  }
  assert.equal((await handlePrivateWebProductIngredients(request({ ...query, profile: {} }), { ...deps(), lookup })).status, 400);
  assert.equal((await handlePrivateWebProductIngredients(request({ ...query, name: 'x'.repeat(5000) }), { ...deps(), lookup })).status, 413);
  assert.equal(calls, 0);
  assert.equal((await handlePrivateWebProductIngredients(new Request('https://example.com'), deps())).status, 405);
});

test('endpoint forwards only parsed product identity plus authenticated owner with typed HTTP statuses', async () => {
  for (const [status, http] of [['not_found', 200], ['ambiguous', 200], ['configuration_required', 503], ['unavailable', 503], ['rate_limited', 429]] as const) {
    const response = await handlePrivateWebProductIngredients(request(), { ...deps(), lookup: async (input, identity) => {
      assert.deepEqual(input, query); assert.equal(identity.userId, owner); return { status };
    } });
    assert.equal(response.status, http);
  }
});

test('server flags, two server-only keys and existing private budget do not write ingredient records', () => {
  const source = readFileSync(new URL('../supabase/functions/private-web-product-ingredients/index.ts', import.meta.url), 'utf8');
  assert.match(source, /DERIVE_WEB_INGREDIENT_TEST_ENABLED'\) === 'true'/);
  assert.match(source, /DERIVE_UPC_PRIVATE_TESTER_IDS/); assert.match(source, /SERPAPI_API_KEY/); assert.match(source, /GEMINI_API_KEY/);
  assert.match(source, /reserve_private_grounded_search.*p_user_id: userId/);
  assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.storage|console\./);
});
