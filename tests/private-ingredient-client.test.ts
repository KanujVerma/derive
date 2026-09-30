import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PrivateGroundedAnswer, PrivateIngredientSearch } from '../src/contracts/PrivateIngredientSearch.ts';
import { createPrivateIngredientController, ingredientQueryKey, parsePrivateIngredientSearch,
  privateIngredientAnswerDocument, requestPrivateIngredientSearch, safeIngredientSourceUrl,
  safeIngredientSuggestionsHtml, type PrivateIngredientState } from '../src/presentation/external-products/ingredientSearch.ts';

const owner = 'e6000000-0000-4000-8000-000000000003';
const query = { barcode: '0037000734130', name: 'Old Spice Captain Deodorant', brand: 'Old Spice', size: '3 oz' };
const answer: PrivateGroundedAnswer = { status: 'grounded_answer', query,
  text: 'Published ingredient listing:\nWater, fragrance.\nThis may be a different regional formula. <do not execute>',
  searchSuggestionsHtml: '<style>.chip{color:green}</style><div><svg viewBox="0 0 10 10"><path d="M0 0"/></svg><a class="chip" href="https://www.google.com/search?q=old+spice">Search Google</a></div>',
  sources: [{ title: 'Manufacturer listing', url: 'https://oldspice.com/products/captain' }],
  retrievedAt: '2026-09-30T00:00:00Z', formulaVerified: false, canonicalProductId: null };

test('grounded result must echo exact query and preserve full answer + suggestions, not a selected ingredient fragment', () => {
  assert.deepEqual(parsePrivateIngredientSearch(answer, query), answer);
  for (const changed of [{ ...answer, query: { ...query, size: '5 oz' } }, { ...answer, formulaVerified: true },
    { ...answer, canonicalProductId: owner }, { ...answer, sources: [] }, { ...answer, retrievedAt: 'invalid' },
    { ...answer, text: '' }, { ...answer, query: { ...query, brand: null } }]) {
    assert.throws(() => parsePrivateIngredientSearch(changed, query), /INVALID_INGREDIENT_RESPONSE/);
  }
  const projected = parsePrivateIngredientSearch({ ...answer, personalScore: 99, profile: 'private', ingredients: ['invented'] }, query);
  assert.equal('personalScore' in projected, false); assert.equal('profile' in projected, false); assert.equal('ingredients' in projected, false);
});

test('empty statuses remain typed and unknown statuses fail closed', () => {
  for (const status of ['configuration_required', 'rate_limited', 'unavailable', 'no_grounded_answer']) {
    assert.deepEqual(parsePrivateIngredientSearch({ status }, query), { status });
  }
  assert.throws(() => parsePrivateIngredientSearch({ status: 'verified' }, query), /INVALID_INGREDIENT_RESPONSE/);
});

test('source links permit public HTTPS only, never local/IP/credential/nonstandard-port destinations', () => {
  assert.equal(safeIngredientSourceUrl('https://example.com/products?a=1&b=2'), true);
  assert.equal(safeIngredientSourceUrl('https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'), true);
  for (const url of ['http://oldspice.com', 'javascript:alert(1)', 'data:text/html,hi', 'https://localhost/',
    'https://demo.local/', 'https://demo.internal/', 'https://127.0.0.1/', 'https://[::1]/',
    'https://2130706433/', 'https://169.254.169.254/', 'https://me:secret@example.com/',
    'https://example.com:444/', 'https://example.com/\nnext', 'https://example.com\\@127.0.0.1/',
    'https://oldspice.com./']) assert.equal(safeIngredientSourceUrl(url), false, url);
});

test('Google HTML is accepted unchanged only if passive with HTTPS links and inline branding', () => {
  assert.equal(safeIngredientSuggestionsHtml(answer.searchSuggestionsHtml), true);
  assert.equal(safeIngredientSuggestionsHtml('<img src="data:image/png;base64,YWJj" alt="Google"><a href="https://www.google.com/search?q=x">Search</a>'), true);
  assert.equal(safeIngredientSuggestionsHtml('<style>.logo{background:url(data:image/png;base64,YWJj)}</style><a href="https://www.google.com/search?q=x">Search</a>'), true);
  assert.equal(safeIngredientSuggestionsHtml('<svg><use href="#local-logo"/></svg><a href="https://www.google.com/search?q=x">Search</a>'), true);
  for (const html of ['<script>alert(1)</script>', '<iframe src="https://example.com"></iframe>', '<img onerror="x()" src="x">',
    '<a href="javascript:alert(1)">x</a>', '<a href="data:text/html,hello">x</a>', '<a href="http://example.com">x</a>',
    '<link rel="stylesheet" href="https://example.com/a.css">', '<style>@import "https://example.com"</style>',
    '<style>body{background:url(https://example.com/track)}</style>', '<img src="https://example.com/track">',
    '<img srcset="https://example.com/track">', '<svg><foreignObject>active</foreignObject></svg>',
    '<svg><image href="https://example.com/track"/></svg><a href="https://www.google.com/search?q=x">Search</a>',
    '<svg><use xlink:href="https://example.com/logo.svg#logo"/></svg><a href="https://www.google.com/search?q=x">Search</a>',
    '<svg><feImage href=https://example.com/track /></svg><a href="https://www.google.com/search?q=x">Search</a>',
    '<form action="https://example.com"><input></form>', '<meta http-equiv="refresh" content="0;url=https://example.com">']) {
    assert.equal(safeIngredientSuggestionsHtml(html), false, html);
    assert.throws(() => parsePrivateIngredientSearch({ ...answer, searchSuggestionsHtml: html }, query), /INVALID_INGREDIENT_RESPONSE/);
  }
});

test('answer document escapes the whole original answer and source titles while preserving literal Google suggestions', () => {
  const document = privateIngredientAnswerDocument({ ...answer, sources: [{ title: '<script>not markup</script>', url: 'https://example.com?a=1&b=2' }] });
  assert.ok(document.includes(answer.searchSuggestionsHtml));
  assert.ok(document.includes('This may be a different regional formula. &lt;do not execute&gt;'));
  assert.ok(document.includes('&lt;script&gt;not markup&lt;/script&gt;'));
  assert.match(document, /default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:/);
  assert.match(document, /base-uri 'none'; form-action 'none'/);
});

test('request sends only barcode/name/brand/size and pins owner + query before and after await', async () => {
  let currentOwner: string | null = owner, currentKey = ingredientQueryKey(query), calls = 0;
  const client = { functions: { invoke: async (name: string, options: { body: object }) => {
    calls++; assert.equal(name, 'private-ingredient-search'); assert.deepEqual(options.body, query);
    return { data: answer, error: null };
  } } };
  assert.deepEqual(await requestPrivateIngredientSearch(query, owner, () => currentOwner, () => currentKey, client), answer);
  currentKey = 'other-product';
  await assert.rejects(requestPrivateIngredientSearch(query, owner, () => currentOwner, () => currentKey, client), /INGREDIENT_SCOPE_CHANGED/);
  assert.equal(calls, 1); currentKey = ingredientQueryKey(query);
  const stale = { functions: { invoke: async () => { currentOwner = null; return { data: answer, error: null }; } } };
  await assert.rejects(requestPrivateIngredientSearch(query, owner, () => currentOwner, () => currentKey, stale), /INGREDIENT_SCOPE_CHANGED/);
  currentOwner = owner;
  const staleQuery = { functions: { invoke: async () => { currentKey = 'changed'; return { data: answer, error: null }; } } };
  await assert.rejects(requestPrivateIngredientSearch(query, owner, () => currentOwner, () => currentKey, staleQuery), /INGREDIENT_SCOPE_CHANGED/);
});

test('SDK error responses expose quota/configuration/unavailable without retrying', async () => {
  let calls = 0;
  for (const [status, body, expected] of [[429, null, 'rate_limited'], [503, { status: 'configuration_required' }, 'configuration_required'],
    [503, { status: 'unavailable' }, 'unavailable']] as const) {
    const result = await requestPrivateIngredientSearch(query, owner, () => owner, () => ingredientQueryKey(query), {
      functions: { invoke: async () => { calls++; return { data: null, error: { context: new Response(JSON.stringify(body), { status }) } }; } },
    });
    assert.equal(result.status, expected);
  }
  assert.equal(calls, 3);
  for (const [status, code] of [[403, 'PRIVATE_TESTER_REQUIRED'], [401, 'SIGN_IN_REQUIRED']] as const) {
    await assert.rejects(requestPrivateIngredientSearch(query, owner, () => owner, () => ingredientQueryKey(query), {
      functions: { invoke: async () => ({ data: null, error: { context: { status } } }) },
    }), new RegExp(code));
  }
});

test('controller is manual-only, double-tap deduplicated, owner/query cancellation cannot publish stale responses', async () => {
  let resolve!: (value: PrivateIngredientSearch) => void, calls = 0;
  let scope = owner + ':' + ingredientQueryKey(query);
  const states: PrivateIngredientState[] = [];
  const waiting = new Promise<PrivateIngredientSearch>(done => { resolve = done; });
  const controller = createPrivateIngredientController({ ownerId: owner, queryKey: ingredientQueryKey(query), currentScope: () => scope,
    request: () => { calls++; return waiting; }, publish: state => states.push(state) });
  assert.equal(calls, 0);
  const pending = controller.run(); await controller.run(); assert.equal(calls, 1);
  scope = 'another-owner:another-query'; resolve(answer); await pending;
  assert.deepEqual(states.map(state => state.kind), ['loading']); await controller.run(); assert.equal(calls, 1);
  scope = owner + ':' + ingredientQueryKey(query); controller.dispose(); await controller.run(); assert.equal(calls, 1);
});

test('native display uses isolated no-script/no-cache WebView and exact manually-triggered client; web never queries', () => {
  const native = readFileSync(new URL('../src/components/check/PrivateIngredientSearch.tsx', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../src/components/check/PrivateIngredientSearch.web.tsx', import.meta.url), 'utf8');
  const parent = readFileSync(new URL('../src/components/check/PrivateUpcFallback.tsx', import.meta.url), 'utf8');
  assert.match(native, /javaScriptEnabled=\{false\}/);
  assert.match(native, /mixedContentMode="never" allowFileAccess=\{false\}/);
  assert.match(native, /allowUniversalAccessFromFileURLs=\{false\}/);
  assert.match(native, /incognito cacheEnabled=\{false\}/);
  assert.match(native, /onShouldStartLoadWithRequest/); assert.match(native, /Linking.openURL/);
  assert.match(native, /Not package-verified ingredients, medical advice or a personal-fit result/);
  assert.match(parent, /<PrivateIngredientSearch ownerId=\{ownerId\} query=\{\{ barcode: candidate.observedBarcode/);
  assert.doesNotMatch(native, /from ['"][^'"]*analytics|analytics\.(?:track|capture)|recordFreeCheck|evaluateProduct|\.insert\(|\.upsert\(/);
  assert.doesNotMatch(web, /requestPrivateIngredientSearch|WebView|dangerouslySetInnerHTML/);
});
