import assert from 'node:assert/strict';
import test from 'node:test';
import type { IngredientExplanationRequest, IngredientExplanationResult } from '../src/contracts/IngredientExplanation.ts';
import type { PrivateIngredientContextSnapshot } from '../supabase/functions/_shared/private-ingredient-runtime.ts';
import { parseIngredientExplanationRequest, runIngredientExplanation } from '../supabase/functions/_shared/ingredient-explanation-runtime.ts';
import { handleIngredientExplanation } from '../supabase/functions/private-ingredient-explanation/handler.ts';

const request: IngredientExplanationRequest = { productName: 'Synthetic gentle cleanser',
  ingredientsText: 'Water, Glycerin, Fragrance', category: 'skincare', contextSharingConsent: true };
const snapshot: PrivateIngredientContextSnapshot = { context: { goals: ['dryness'],
  skinBehavior: 'dry_tight', reactivity: 'reacts_easily' }, version: 'synthetic-profile-version' };
const sentences = ['Glycerin may help retain moisture, which relates to your dryness goal.',
  'The listed fragrance warrants extra caution given your reported reactivity, but individual tolerance is uncertain.'];
const provider = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP',
  content: { parts: [{ text: JSON.stringify({ sentences }) }] } }] }), { headers: { 'Content-Type': 'application/json' } });
const unused = async (): Promise<never> => { throw Error('Unexpected side effect'); };
const deps = () => ({ apiKey: 'synthetic-server-key', personalContextApproved: true,
  loadContext: async () => snapshot, reserveRequest: async (): Promise<'reserved'> => 'reserved',
  fetcher: async () => provider() });

test('explanation input requires exactly bounded product evidence and explicit consent', () => {
  assert.deepEqual(parseIngredientExplanationRequest(request), request);
  for (const value of [null, [], {}, { ...request, userId: 'owner' }, { ...request, profile: snapshot.context },
    { ...request, history: [] }, { ...request, photo: 'x' }, { ...request, contextSharingConsent: false },
    { ...request, contextSharingConsent: 'true' }, { ...request, productName: '' },
    { ...request, productName: 'a'.repeat(181) }, { ...request, ingredientsText: 'a'.repeat(24_001) },
    { ...request, ingredientsText: ' ' }, { ...request, ingredientsText: 'x\u0000' },
    { ...request, productName: 'x\n' }, { ...request, category: 'food' }]) {
    assert.throws(() => parseIngredientExplanationRequest(value), /INVALID_EXPLANATION_REQUEST/);
  }
});

test('invalid request rejects before key, profile, budget or provider', async () => {
  await assert.rejects(runIngredientExplanation({ ...request, ownerId: 'other' } as IngredientExplanationRequest,
    { ...deps(), loadContext: unused, reserveRequest: unused, fetcher: unused }), /INVALID_EXPLANATION_REQUEST/);
});

test('operator privacy gate stops before even reading the key', async () => {
  const disabled = { ...deps(), personalContextApproved: false, loadContext: unused, reserveRequest: unused, fetcher: unused };
  Object.defineProperty(disabled, 'apiKey', { get: () => { throw Error('Key must not be read'); } });
  assert.deepEqual(await runIngredientExplanation(request, disabled), { status: 'personalization_disabled' });
});

test('blank key, missing profile and failed profile stop before model usage', async () => {
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), apiKey: ' ',
    loadContext: unused, reserveRequest: unused, fetcher: unused }), { status: 'configuration_required' });
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), loadContext: async () => null,
    reserveRequest: unused, fetcher: unused }), { status: 'profile_missing' });
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), loadContext: unused,
    reserveRequest: unused, fetcher: unused }), { status: 'context_unavailable' });
});

test('one approved synthetic flow generates sentences without search or leaking context envelopes', async () => {
  let reads = 0, reservations = 0, calls = 0;
  const loaded = { ...snapshot, ownerId: 'synthetic-owner', medicalHistory: 'synthetic-private-history',
    context: { ...snapshot.context, prescriptions: ['synthetic-private-rx'], reactionHistory: 'synthetic-private-reaction' } };
  const result = await runIngredientExplanation(request, { ...deps(), loadContext: async () => { reads++; return loaded; },
    reserveRequest: async () => { reservations++; return 'reserved'; }, fetcher: async (url, init) => {
      calls++;
      assert.match(String(url), /generateContent$/);
      const body = JSON.parse(init!.body as string);
      assert.equal('tools' in body, false);
      const content = body.contents[0].parts[0].text;
      const input = JSON.parse(content);
      assert.deepEqual(input.context, snapshot.context);
      assert.equal(input.productName, request.productName);
      assert.equal(input.ingredientsText, request.ingredientsText);
      assert.doesNotMatch(content, /synthetic-owner|synthetic-private|synthetic-profile-version|contextSharingConsent/);
      return provider();
    } });
  assert.equal(result.status, 'answer');
  if (result.status !== 'answer') return;
  assert.deepEqual(result.sentences, sentences); assert.equal(result.contextVersion, snapshot.version);
  assert.equal(result.formulaVerified, false); assert.equal(result.basis, 'ai_guidance');
  assert.ok(Number.isFinite(Date.parse(result.retrievedAt)));
  assert.equal('context' in result, false); assert.equal('score' in result, false);
  assert.equal(reads, 2); assert.equal(reservations, 1); assert.equal(calls, 1);
});

test('other personal care cannot transmit facial goals or facial skin type', async () => {
  const result = await runIngredientExplanation({ ...request, category: 'other_personal_care' }, { ...deps(),
    fetcher: async (_url, init) => {
      const input = JSON.parse(JSON.parse(init!.body as string).contents[0].parts[0].text);
      assert.deepEqual(input.context, { goals: [], skinBehavior: 'unanswered', reactivity: 'reacts_easily' });
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{
        text: JSON.stringify({ sentences: ['The listed fragrance may merit caution given your reported reactivity; tolerance remains uncertain.'] }),
      }] } }] }), { headers: { 'Content-Type': 'application/json' } });
    } });
  assert.equal(result.status, 'answer');
});

test('explanation uses the server-selected model rather than a hardcoded model', async () => {
  const result = await runIngredientExplanation(request, { ...deps(), model: 'gemini-configured-test',
    fetcher: async (url) => {
      assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-configured-test:generateContent');
      return provider();
    } });
  assert.equal(result.status, 'answer');
  if (result.status === 'answer') assert.equal(result.model, 'gemini-configured-test');
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), model: '../untrusted',
    fetcher: unused }), { status: 'configuration_required' });
});

test('profile changes, deletion and failed re-read suppress a stale answer', async () => {
  for (const next of [{ ...snapshot, version: 'new-version' }, null, 'failure']) {
    let reads = 0;
    const result = await runIngredientExplanation(request, { ...deps(), loadContext: async () => {
      if (++reads === 1) return snapshot;
      if (next === 'failure') throw Error('Synthetic reread failure');
      return next as PrivateIngredientContextSnapshot | null;
    } });
    assert.equal(result.status, next === 'failure' ? 'context_unavailable' : 'context_changed');
    assert.equal(reads, 2);
  }
});

test('denied or failed budget never contacts model, and provider failures do not retry', async () => {
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), reserveRequest: async () => 'rate_limited',
    fetcher: unused }), { status: 'rate_limited' });
  assert.deepEqual(await runIngredientExplanation(request, { ...deps(), reserveRequest: unused,
    fetcher: unused }), { status: 'unavailable' });
  for (const [http, status] of [[429, 'rate_limited'], [503, 'unavailable'], [403, 'configuration_required']] as const) {
    let reads = 0, calls = 0;
    const result = await runIngredientExplanation(request, { ...deps(), loadContext: async () => { reads++; return snapshot; },
      fetcher: async () => { calls++; return new Response('{}', { status: http }); } });
    assert.equal(result.status, status); assert.equal(reads, 1); assert.equal(calls, 1);
  }
});

const owner = 'synthetic-authenticated-owner';
const handlerDeps = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  explain: async (): Promise<IngredientExplanationResult> => ({ status: 'no_answer' }),
  failure: (code: string, _message: string, status: number) => Object.assign(new Error(code), { status }),
  respond: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
  errorResponse: (error: unknown) => new Response(null, { status: (error as { status?: number }).status ?? 500 }),
  corsHeaders: { 'Access-Control-Allow-Origin': '*' } });
const httpRequest = (body: unknown = request) => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('handler checks method, private flag, exact tester identity, auth and payload before explain', async () => {
  const blocked = { ...handlerDeps(), explain: unused };
  assert.equal((await handleIngredientExplanation(httpRequest(), { ...blocked, enabled: false })).status, 503);
  assert.equal((await handleIngredientExplanation(httpRequest(), { ...blocked, allowedUserIds: [] })).status, 503);
  assert.equal((await handleIngredientExplanation(httpRequest(), { ...blocked, authenticate: async () => ({ userId: 'other' }) })).status, 403);
  assert.equal((await handleIngredientExplanation(httpRequest(), { ...blocked, authenticate: async () => {
    throw Object.assign(Error('Synthetic auth failure'), { status: 401 });
  } })).status, 401);
  assert.equal((await handleIngredientExplanation(httpRequest({ ...request, profile: {} }), blocked)).status, 400);
  assert.equal((await handleIngredientExplanation(new Request('https://example.com'), blocked)).status, 405);
  const options = await handleIngredientExplanation(new Request('https://example.com', { method: 'OPTIONS' }), blocked);
  assert.equal(options.status, 200); assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*');
});

test('handler limits actual streamed bytes including multibyte text and rejects malformed encoding/JSON', async () => {
  const blocked = { ...handlerDeps(), explain: unused };
  assert.equal((await handleIngredientExplanation(httpRequest({ ...request, ingredientsText: 'a'.repeat(33_000) }), blocked)).status, 413);
  assert.equal((await handleIngredientExplanation(httpRequest({ ...request, ingredientsText: 'é'.repeat(24_000) }), blocked)).status, 413);
  assert.equal((await handleIngredientExplanation(new Request('https://example.com', { method: 'POST', body: '{bad' }), blocked)).status, 400);
  assert.equal((await handleIngredientExplanation(new Request('https://example.com', { method: 'POST', body: new Uint8Array([255]) }), blocked)).status, 400);
  assert.equal((await handleIngredientExplanation(new Request('https://example.com', { method: 'POST' }), blocked)).status, 400);
});

test('handler forwards parsed fields with authenticated identity and maps typed statuses', async () => {
  for (const [status, http] of [['rate_limited', 429], ['personalization_disabled', 503], ['configuration_required', 503],
    ['context_unavailable', 503], ['unavailable', 503], ['context_changed', 200], ['profile_missing', 200], ['no_answer', 200]] as const) {
    const response = await handleIngredientExplanation(httpRequest(), { ...handlerDeps(), explain: async (input, identity) => {
      assert.deepEqual(input, request); assert.equal(identity.userId, owner); return { status };
    } });
    assert.equal(response.status, http);
    assert.deepEqual(await response.json(), { status });
  }
});

test('synthetic HTTP flow runs authentication, saved context, budget, model and version binding end to end', async () => {
  let authCalls = 0, reads = 0, reservations = 0, providerCalls = 0;
  const response = await handleIngredientExplanation(httpRequest(), { ...handlerDeps(),
    authenticate: async () => { authCalls++; return { userId: owner }; },
    explain: async (input, identity) => {
      assert.equal(identity.userId, owner);
      return runIngredientExplanation(input, { ...deps(),
        loadContext: async () => { reads++; return snapshot; },
        reserveRequest: async () => { reservations++; return 'reserved'; },
        fetcher: async () => { providerCalls++; return provider(); },
      });
    },
  });
  assert.equal(response.status, 200);
  const answer = await response.json();
  assert.equal(answer.status, 'answer'); assert.deepEqual(answer.sentences, sentences);
  assert.equal(answer.contextVersion, snapshot.version); assert.equal(answer.basis, 'ai_guidance');
  assert.equal(answer.formulaVerified, false);
  assert.deepEqual({ authCalls, reads, reservations, providerCalls }, { authCalls: 1, reads: 2, reservations: 1, providerCalls: 1 });
});
