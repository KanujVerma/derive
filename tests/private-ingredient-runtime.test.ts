import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrivateIngredientRequest } from '../src/contracts/PrivateIngredientSearch.ts';
import type { PrivateIngredientContextSnapshot } from '../supabase/functions/_shared/private-ingredient-runtime.ts';
import { runPrivateIngredientSearch } from '../supabase/functions/_shared/private-ingredient-runtime.ts';

const query = { barcode: '0037000734130', name: 'Old Spice Captain Deodorant 3 oz', brand: 'Old Spice', size: '3 oz' };
const personal = { ...query, personalization: 'basic_skin_context' as const, contextSharingConsent: true as const };
const text = 'Published ingredients for the named candidate.\nYour saved skin context: the exact formula is uncertain; compare the printed label.';
const html = '<style>.chip{color:#222}</style><a href="https://www.google.com/search?q=Old+Spice">Search</a>';
const snapshot: PrivateIngredientContextSnapshot = {
  context: { goals: ['dryness', 'simplify'], skinBehavior: 'dry_tight', reactivity: 'reacts_easily' },
  version: 'opaque-profile-version',
};
const provider = () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] },
  groundingMetadata: { webSearchQueries: ['Old Spice Captain ingredients'], searchEntryPoint: { renderedContent: html },
    groundingChunks: [{ web: { title: 'Manufacturer', uri: 'https://oldspice.com/products/captain' } }],
    groundingSupports: [{ segment: { startIndex: 0, endIndex: new TextEncoder().encode(text).length, text }, groundingChunkIndices: [0] }] },
}] });
const unused = async (): Promise<never> => { throw Error('Unexpected side effect'); };
const success: typeof fetch = async () => new Response(JSON.stringify(provider()));
const deps = () => ({ apiKey: 'synthetic-server-key', personalContextApproved: true,
  loadContext: async () => snapshot, reserveRequest: async (): Promise<'reserved'> => 'reserved', fetcher: success });

test('product-only runtime never reads saved context or sends personal fields', async () => {
  let calls = 0, reservations = 0;
  const result = await runPrivateIngredientSearch(query, { ...deps(), loadContext: unused,
    reserveRequest: async () => { reservations++; return 'reserved'; },
    fetcher: async (_url, init) => {
      calls++;
      const body = JSON.parse(init!.body as string);
      assert.equal(body.contents[0].parts[0].text.split(': ').slice(1).join(': '), JSON.stringify(query));
      assert.doesNotMatch(body.contents[0].parts[0].text, /saved cosmetic context|dryness|reacts_easily|opaque-profile/);
      return new Response(JSON.stringify(provider()));
    } });
  assert.equal(result.status, 'grounded_answer');
  if (result.status !== 'grounded_answer') return;
  assert.equal(result.answerKind, 'published_ingredients');
  assert.equal('contextVersion' in result, false);
  assert.equal(calls, 1); assert.equal(reservations, 1);
});

test('personal request requires paired explicit consent before any side effect', async () => {
  for (const request of [
    { ...query, personalization: 'basic_skin_context' },
    { ...query, contextSharingConsent: true },
    { ...personal, contextSharingConsent: false },
    { ...personal, contextSharingConsent: 'yes' },
    { ...personal, personalization: 'all_medical_context' },
    { ...personal, profile: snapshot.context },
  ]) {
    await assert.rejects(runPrivateIngredientSearch(request as PrivateIngredientRequest,
      { ...deps(), loadContext: unused, reserveRequest: unused, fetcher: unused }), /INVALID_INGREDIENT_QUERY/);
  }
});

test('disabled personal processing stops before key access, context, budget or provider', async () => {
  const blocked = { ...deps(), personalContextApproved: false, loadContext: unused, reserveRequest: unused, fetcher: unused };
  Object.defineProperty(blocked, 'apiKey', { get: () => { throw Error('Key must not be read'); } });
  assert.deepEqual(await runPrivateIngredientSearch(personal, blocked), { status: 'personalization_disabled' });
});

test('missing key stops before reading a saved profile or reserving Google usage', async () => {
  assert.deepEqual(await runPrivateIngredientSearch(personal,
    { ...deps(), apiKey: ' ', loadContext: unused, reserveRequest: unused, fetcher: unused }), { status: 'configuration_required' });
  assert.deepEqual(await runPrivateIngredientSearch(query,
    { ...deps(), apiKey: '', loadContext: unused, reserveRequest: unused, fetcher: unused }), { status: 'configuration_required' });
});

test('missing or failed profile read stops before budget and provider', async () => {
  assert.deepEqual(await runPrivateIngredientSearch(personal,
    { ...deps(), loadContext: async () => null, reserveRequest: unused, fetcher: unused }), { status: 'profile_missing' });
  assert.deepEqual(await runPrivateIngredientSearch(personal,
    { ...deps(), loadContext: async () => { throw Error('Synthetic database failure'); }, reserveRequest: unused, fetcher: unused }),
  { status: 'context_unavailable' });
});

test('approved consent sends only minimal cosmetic projection and returns untouched grounded answer', async () => {
  let reads = 0, calls = 0, reservations = 0;
  const loaded = { ...snapshot, ownerId: 'private-owner-id', medicalHistory: 'private-medical-history', reactions: ['private-reaction'] };
  const result = await runPrivateIngredientSearch(personal, { ...deps(),
    loadContext: async () => { reads++; return loaded; },
    reserveRequest: async () => { reservations++; return 'reserved'; },
    fetcher: async (_url, init) => {
      calls++;
      const body = JSON.parse(init!.body as string);
      const content = body.contents[0].parts[0].text;
      assert.ok(content.includes(JSON.stringify(query)));
      assert.ok(content.includes(JSON.stringify(snapshot.context)));
      assert.doesNotMatch(content, /private-owner-id|private-medical-history|private-reaction|opaque-profile-version|contextSharingConsent|personalization/);
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      assert.match(body.systemInstruction.parts[0].text, /Do not send personal skin context in web-search queries/);
      return new Response(JSON.stringify(provider()));
    } });
  assert.equal(result.status, 'grounded_answer');
  if (result.status !== 'grounded_answer') return;
  assert.equal(result.text, text); assert.equal(result.searchSuggestionsHtml, html);
  assert.deepEqual(result.query, query);
  assert.equal(result.answerKind, 'contextual_web_guidance'); assert.equal(result.contextVersion, snapshot.version);
  assert.equal(result.formulaVerified, false); assert.equal(result.canonicalProductId, null);
  assert.equal('context' in result, false); assert.equal('ingredients' in result, false);
  assert.equal(reads, 2); assert.equal(calls, 1); assert.equal(reservations, 1);
});

test('context change or deletion while Google responds suppresses stale personal answer', async () => {
  for (const next of [{ ...snapshot, version: 'changed-version' }, null]) {
    let reads = 0, calls = 0;
    assert.deepEqual(await runPrivateIngredientSearch(personal, { ...deps(),
      loadContext: async () => ++reads === 1 ? snapshot : next,
      fetcher: async () => { calls++; return new Response(JSON.stringify(provider())); },
    }), { status: 'context_changed' });
    assert.equal(reads, 2); assert.equal(calls, 1);
  }
});

test('failed owner-context reread suppresses grounded answer instead of publishing stale guidance', async () => {
  let reads = 0, calls = 0;
  assert.deepEqual(await runPrivateIngredientSearch(personal, { ...deps(),
    loadContext: async () => { if (++reads === 1) return snapshot; throw Error('Synthetic reread failure'); },
    fetcher: async () => { calls++; return new Response(JSON.stringify(provider())); },
  }), { status: 'context_unavailable' });
  assert.equal(reads, 2); assert.equal(calls, 1);
});

test('Google quota and local budget denial return rate limit without a second context read or retries', async () => {
  let reads = 0, calls = 0, reservations = 0;
  assert.deepEqual(await runPrivateIngredientSearch(personal, { ...deps(),
    loadContext: async () => { reads++; return snapshot; },
    reserveRequest: async () => { reservations++; return 'reserved'; },
    fetcher: async () => { calls++; return new Response('{}', { status: 429 }); },
  }), { status: 'rate_limited' });
  assert.equal(reads, 1); assert.equal(calls, 1); assert.equal(reservations, 1);
  reads = 0;
  assert.deepEqual(await runPrivateIngredientSearch(personal, { ...deps(),
    loadContext: async () => { reads++; return snapshot; },
    reserveRequest: async () => 'rate_limited', fetcher: unused,
  }), { status: 'rate_limited' });
  assert.equal(reads, 1);
});

test('failed or uncited provider answer makes one attempt and never reruns context or provider', async () => {
  for (const fail of [async () => new Response('{}', { status: 503 }), async () => new Response('{}'),
    async () => { throw Error('Synthetic network failure'); }]) {
    let reads = 0, calls = 0;
    const result = await runPrivateIngredientSearch(personal, { ...deps(),
      loadContext: async () => { reads++; return snapshot; },
      fetcher: async () => { calls++; return fail(); },
    });
    assert.ok(['unavailable', 'no_grounded_answer'].includes(result.status));
    assert.equal(reads, 1); assert.equal(calls, 1);
  }
});
