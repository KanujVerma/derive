import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseIngredientExplanation, requestIngredientExplanation } from '../src/presentation/external-products/ingredientExplanation.ts';
const req = { productName: 'Fixture lotion', ingredientsText: 'Water, Glycerin', category: 'skincare' as const, contextSharingConsent: true as const };
const answer = { status: 'answer', sentences: ['Glycerin is commonly used in moisturizers.'], model: 'fixture',
  retrievedAt: '2026-09-30T00:00:00Z', contextVersion: 'a'.repeat(64), basis: 'ai_guidance', formulaVerified: false };
test('client projects narrow answer and rejects forged trust, empty/oversized model output', () => {
  assert.deepEqual(parseIngredientExplanation({ ...answer, score: 100 }), answer);
  for (const change of [{ formulaVerified: true }, { basis: 'verified_fit' }, { sentences: [] },
    { sentences: ['x'.repeat(501)] }, { contextVersion: 'x' }]) assert.throws(() => parseIngredientExplanation({ ...answer, ...change }));
});
test('client sends only consented ingredient/product data, never supplied owner/profile/history', async () => {
  const result = await requestIngredientExplanation(req, 'scope', () => 'scope', { functions: {
    invoke: async (name, args) => { assert.equal(name, 'private-ingredient-explanation'); assert.deepEqual(args.body, req); return { data: answer, error: null }; },
  } });
  assert.equal(result.status, 'answer');
});
test('owner/profile/product switch suppresses in-flight model response', async () => {
  let scope = 'scope';
  await assert.rejects(requestIngredientExplanation(req, scope, () => scope, { functions: {
    invoke: async () => { scope = 'changed'; return { data: answer, error: null }; },
  } }), /SCOPE_CHANGED/);
});
test('client preserves privacy/provider activation failures and forbids non-consent', async () => {
  const result = await requestIngredientExplanation(req, 'scope', () => 'scope', { functions: {
    invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ status: 'personalization_disabled' }), { status: 503 }) } }),
  } });
  assert.equal(result.status, 'personalization_disabled');
  await assert.rejects(requestIngredientExplanation({ ...req, contextSharingConsent: false } as unknown as typeof req,
    'scope', () => 'scope', { functions: { invoke: async () => { throw Error('must not run'); } } }), /INVALID_EXPLANATION_REQUEST/);
});
test('AI consent action is fenced by component lifecycle and scopes, with bounded product names', () => {
  const source = readFileSync(new URL('../src/components/check/PrivateIngredientExplanation.tsx', import.meta.url), 'utf8');
  assert.match(source, /return \(\) => \{ lifecycle.current.mounted = false; lifecycle.current.generation \+= 1/);
  assert.match(source, /lifecycle.current.mounted && useAuthStore/);
  assert.match(source, /lifecycle.current.generation === selectedGeneration && current\(\) === selectedScope/);
  assert.match(source, /props.productName.length > 180/);
});
