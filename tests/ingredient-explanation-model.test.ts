import assert from 'node:assert/strict';
import test from 'node:test';
import type { IngredientCosmeticContext } from '../src/domain/ingredient-context.ts';
import { explainIngredientContext } from '../supabase/functions/_shared/ingredient-explanation-model.ts';

const context: IngredientCosmeticContext = { goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'reacts_easily' };
const input = { ingredientsText: 'Water, Glycerin, Fragrance', context, productName: 'Synthetic moisturizer', category: 'skincare' as const };
const envelope = (value: unknown, extra: Record<string, unknown> = {}) => ({ candidates: [{ finishReason: 'STOP',
  content: { parts: [{ text: JSON.stringify(value) }] }, ...extra }] });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const answer = { sentences: ['The published list includes glycerin, a humectant that may be relevant to your dryness goal.',
  'Because you reported easy reactivity, the listed fragrance is a reason to introduce this product cautiously.'] };

test('one fixed no-search request sends only projected cosmetic context and bounded schema', async () => {
  let calls = 0;
  const privateContext = { ...context, ownerId: 'DO_NOT_SEND', reproductive: { pregnancy: 'DO_NOT_SEND' },
    treatments: ['DO_NOT_SEND'], get history(): never { throw Error('history must not be read'); } };
  const result = await explainIngredientContext({ ...input, context: privateContext }, { apiKey: 'synthetic-key', fetch: async (url, opts) => {
    calls++; assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.equal(opts?.method, 'POST'); assert.equal(opts?.redirect, 'error'); assert.equal(opts?.credentials, 'omit'); assert.ok(opts?.signal);
    const body = JSON.parse(String(opts?.body));
    assert.equal('tools' in body, false); assert.equal('labels' in body, false); assert.equal('cachedContent' in body, false); assert.equal(body.store, false);
    assert.equal(String(opts?.body).includes('DO_NOT_SEND'), false);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), input);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.additionalProperties, false);
    assert.equal(body.generationConfig.responseJsonSchema.properties.sentences.maxItems, 4);
    assert.equal(body.generationConfig.responseJsonSchema.properties.sentences.items.maxLength, 500);
    return response(envelope(answer));
  } });
  assert.equal(calls, 1); assert.deepEqual(result, { status: 'answer', sentences: answer.sentences, model: 'gemini-3.8-flash' });
});

test('other personal care excludes facial goals/type and refuses facial recommendations', async () => {
  const personalCare = { ...input, category: 'other_personal_care' as const, productName: 'Synthetic deodorant' };
  const result = await explainIngredientContext(personalCare, { apiKey: 'synthetic-key', fetch: async (_url, opts) => {
    const body = JSON.parse(String(opts?.body));
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).context, { goals: [], skinBehavior: 'unanswered', reactivity: 'reacts_easily' });
    return response(envelope({ sentences: ['The listed fragrance may warrant caution given your reported reactivity.'] }));
  } });
  assert.equal(result.status, 'answer');
  assert.equal((await explainIngredientContext(personalCare, { apiKey: 'synthetic-key', fetch: async () => response(envelope({ sentences: ['This deodorant helps your facial dryness.'] })) })).status, 'no_answer');
});

test('unsafe configurations and invalid/minimally unsupported input never call provider', async () => {
  const never: typeof fetch = async () => { throw Error('must not run'); };
  for (const opts of [{ apiKey: '' }, { apiKey: 'key\n' }, { apiKey: 'key', model: '../secret' }])
    assert.equal((await explainIngredientContext(input, { ...opts, fetch: never })).status, 'configuration_required');
  for (const bad of [{ ...input, ingredientsText: '' }, { ...input, ingredientsText: 'x'.repeat(24001) },
    { ...input, productName: 'x'.repeat(501) }, { ...input, context: { ...context, goals: ['private instruction'] } }])
    assert.equal((await explainIngredientContext(bad as typeof input, { apiKey: 'synthetic-key', fetch: never })).status, 'no_answer');
});

test('refuses scores, diagnostic claims, safety promises and allergy causation', async () => {
  for (const unsafe of ['Your score is 85/100.', 'This is safe for you.', 'Clinically proven safe.',
    'This treats your acne.', 'You have dermatitis.', 'You are allergic to fragrance.',
    'Fragrance caused your burning.', 'Fragrance is the culprit.', 'This will not irritate your skin.',
    'This cannot cause an allergic reaction.', 'Fragrance triggers your skin reaction.', 'You have acne.',
    'This is harmless.', 'This is non-irritating.', 'Read https://example.com.', '<b>Good</b>']) {
    assert.equal((await explainIngredientContext(input, { apiKey: 'synthetic-key', fetch: async () => response(envelope({ sentences: [unsafe] })) })).status, 'no_answer', unsafe);
  }
});

test('requires STOP and strict bounded nonempty JSON, excludes thoughts and function calls', async () => {
  const failures = [envelope(answer, { finishReason: 'MAX_TOKENS' }), envelope({ sentences: [] }), envelope({ sentences: [''] }),
    envelope({ sentences: Array(5).fill('A consideration.') }), envelope({ sentences: ['x'.repeat(501)] }),
    envelope({ sentences: ['A consideration.'], score: 99 }), { candidates: [] },
    envelope(answer, { content: { parts: [{ functionCall: { name: 'search', args: {} } }] } }),
    envelope(answer, { content: { parts: [{ text: JSON.stringify(answer), thought: true }] } }),
    envelope(answer, { content: { parts: [{ text: 'not json' }] } }),
  ];
  for (const value of failures) assert.equal((await explainIngredientContext(input, { apiKey: 'synthetic-key', fetch: async () => response(value) })).status, 'no_answer');
  const result = await explainIngredientContext(input, { apiKey: 'synthetic-key', model: 'gemini-test', fetch: async () => response(envelope(answer,
    { content: { parts: [{ text: 'hidden thoughts', thought: true }, { text: JSON.stringify(answer) }] } })) });
  assert.equal(result.status, 'answer'); if (result.status === 'answer') assert.equal(result.model, 'gemini-test');
});

test('provider errors are typed and network/oversized/malformed bodies are unavailable', async () => {
  for (const [code, expected] of [[429, 'rate_limited'], [400, 'configuration_required'], [401, 'configuration_required'],
    [403, 'configuration_required'], [404, 'configuration_required'], [500, 'unavailable']] as const)
    assert.equal((await explainIngredientContext(input, { apiKey: 'synthetic-key', fetch: async () => response({}, code) })).status, expected);
  for (const fake of [
    async () => { throw Error('network'); },
    async () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    async () => new Response('{}', { headers: { 'content-type': 'text/html' } }),
    async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '65537' } }),
    async () => new Response('x'.repeat(65537), { headers: { 'content-type': 'application/json' } }),
  ]) assert.equal((await explainIngredientContext(input, { apiKey: 'synthetic-key', fetch: fake })).status, 'unavailable');
});

test('generated customer copy uses plain sentences without colon or dash punctuation', async () => {
  for (const sentence of ['Your skin: consider fragrance.', 'Fragrance may irritate — introduce cautiously.',
    'Fragrance may irritate – introduce cautiously.', 'This is a skin-friendly formula.']) {
    assert.equal((await explainIngredientContext(input, { apiKey: 'synthetic-key',
      fetch: async () => response(envelope({ sentences: [sentence] })) })).status, 'no_answer');
  }
});
