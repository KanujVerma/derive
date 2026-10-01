import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import React from 'react';
import ts from 'typescript';
import test from 'node:test';
import { parseWebProductIngredientLookup, requestWebProductIngredients, safeWebIngredientSourceUrl,
  validWebIngredientQuery, webProductIngredientKey } from '../src/presentation/external-products/webProductIngredients.ts';
import type { WebIngredientEvidence, WebProductIngredientLookup } from '../src/contracts/WebProductIngredients.ts';
import { colors, radii, spacing, typography } from '../src/constants/theme.ts';

const owner = 'e6000000-0000-4000-8000-000000000001';
const query = { barcode: '0012044038840', name: 'Fixture Deodorant', brand: 'Fixture Brand', size: '3 oz' };
const evidence: WebIngredientEvidence = { productName: 'Fixture Deodorant',
  ingredientsText: 'Water, Alcohol Denat., PEG-8\nFragrance (Parfum)', sourceUrl: 'https://www.example.com/products/deodorant?variant=123',
  sourceName: 'Fixture Brand', retrievedAt: '2026-09-30T00:00:00Z', basis: 'published_web', formulaVerified: false };
const found = { status: 'found' as const, evidence };
const scope = owner + ':' + webProductIngredientKey(query);

test('client keeps complete published text and strips unexpected verdict and owner properties', () => {
  const value = parseWebProductIngredientLookup({ ...found, ownerId: owner, score: 100,
    evidence: { ...evidence, personalFit: 'safe', canonicalProductId: owner } });
  assert.deepEqual(value, found);
  assert.equal(value.status, 'found');
  if (value.status === 'found') assert.equal(value.evidence.ingredientsText, evidence.ingredientsText);
});

test('client fails closed for missing fields, malformed dates, excessive content and forged trust', () => {
  for (const change of [{ productName: '' }, { productName: 'x'.repeat(241) }, { sourceName: '' },
    { sourceName: 'x'.repeat(181) }, { ingredientsText: '' }, { ingredientsText: 'x'.repeat(16001) },
    { ingredientsText: 'Water\u0000Glycerin' }, { retrievedAt: 'yesterday' },
    { retrievedAt: '2026-02-30T00:00:00Z' }, { retrievedAt: '2026-09-30' },
    { basis: 'verified_formula' }, { formulaVerified: true }, { sourceUrl: 'http://example.com/product' }]) {
    assert.throws(() => parseWebProductIngredientLookup({ ...found, evidence: { ...evidence, ...change } }), /INVALID_WEB_INGREDIENT_RESPONSE/);
  }
  for (const value of [null, {}, { status: 'found' }, { status: 'unknown' }, { status: 'not_found', evidence },
    { status: 'found', evidence: [evidence] }]) assert.throws(() => parseWebProductIngredientLookup(value));
  for (const status of ['not_found', 'ambiguous', 'rate_limited', 'configuration_required', 'unavailable']) {
    assert.deepEqual(parseWebProductIngredientLookup({ status, secret: 'ignored' }), { status });
  }
});

test('citations accept public HTTPS pages and reject credentials, local hosts and secret parameters', () => {
  assert.equal(safeWebIngredientSourceUrl(evidence.sourceUrl), true);
  for (const value of ['https://user:password@example.com/product', 'https://example.com:8443/product',
    'https://localhost/product', 'https://127.0.0.1/product', 'https://[::1]/product',
    'https://example.internal/product', 'https://example.com/product#token', 'https://example.com/product\n',
    'https://example.com/\\product', 'https://example.com/product?api_key=secret',
    'https://example.com/product?%74oken=secret', 'https://example.com/product?X-Amz-Signature=secret',
    'https://example.com/product?authorization=secret', 'https://example.com/product?session_id=secret']) {
    assert.equal(safeWebIngredientSourceUrl(value), false, value);
  }
});

test('invalid product queries fail before outbound work, including blank names and invalid barcodes', async () => {
  let calls = 0;
  const client = { functions: { invoke: async () => { calls++; return { data: found, error: null }; } } };
  for (const value of [{ ...query, name: null }, { ...query, name: ' ' }, { ...query, name: 'x'.repeat(181) },
    { ...query, name: 'Fixture\nDeodorant' }, { ...query, barcode: '12345678' }, { ...query, brand: '' },
    { ...query, size: 'x'.repeat(81) }]) {
    assert.equal(validWebIngredientQuery(value), false);
    await assert.rejects(requestWebProductIngredients(value, owner, () => scope, client), /INVALID_WEB_INGREDIENT_REQUEST/);
  }
  await assert.rejects(requestWebProductIngredients(query, owner, () => '', client), /SCOPE_CHANGED/);
  assert.equal(calls, 0);
});

test('one identity only request is sent, with no profile, owner or history fields', async () => {
  let calls = 0;
  const untrustedQuery = { ...query, ownerId: owner, skinProfile: { goals: ['dryness'] } };
  const result = await requestWebProductIngredients(untrustedQuery, owner, () => scope,
    { functions: { invoke: async (name, options) => {
      calls++;
      assert.equal(name, 'private-web-product-ingredients');
      assert.deepEqual(options.body, query);
      return { data: found, error: null };
    } } });
  assert.deepEqual(result, found);
  assert.equal(calls, 1);
});

test('owner or product changes suppress an in flight response without retrying', async () => {
  for (const next of ['', 'another-owner:' + webProductIngredientKey(query), owner + ':' + webProductIngredientKey({ ...query, size: '2 oz' })]) {
    let current = scope, calls = 0;
    await assert.rejects(requestWebProductIngredients(query, owner, () => current, { functions: { invoke: async () => {
      calls++; current = next; return { data: found, error: null };
    } } }), /SCOPE_CHANGED/);
    assert.equal(calls, 1);
  }
});

test('typed quota and setup failures survive HTTP bodies but authentication errors do not', async () => {
  for (const [status, code] of [[429, 'rate_limited'], [503, 'configuration_required'], [503, 'unavailable']] as const) {
    const result = await requestWebProductIngredients(query, owner, () => scope, { functions: { invoke: async () => ({
      data: null, error: { context: new Response(JSON.stringify({ status: code }), { status }) },
    }) } });
    assert.equal(result.status, code);
  }
  for (const [status, code] of [[401, 'SIGN_IN_REQUIRED'], [403, 'PRIVATE_TESTER_REQUIRED'], [500, 'WEB_INGREDIENT_UNAVAILABLE']] as const) {
    await assert.rejects(requestWebProductIngredients(query, owner, () => scope, { functions: { invoke: async () => ({
      data: found, error: { context: new Response(null, { status }) },
    }) } }), new RegExp(code));
  }
  await assert.rejects(requestWebProductIngredients(query, owner, () => scope, { functions: { invoke: async () => ({
    data: found, error: { context: new Response(null, { status: 503 }) },
  }) } }), /WEB_INGREDIENT_UNAVAILABLE/);
});

test('owner is rechecked after asynchronous error body parsing', async () => {
  let current = scope;
  await assert.rejects(requestWebProductIngredients(query, owner, () => current, { functions: { invoke: async () => ({
    data: null, error: { context: { status: 503, clone: () => ({ json: async () => {
      current = ''; return { status: 'configuration_required' };
    } }) } },
  }) } }), /SCOPE_CHANGED/);
});

test('inline display memoizes product fields, deduplicates effect replay and fences current owner and lifecycle', () => {
  const source = readFileSync(new URL('../src/components/check/WebProductIngredients.tsx', import.meta.url), 'utf8');
  assert.match(source, /\[query.barcode, query.name, query.brand, query.size\]/);
  assert.match(source, /if \(!memo.current\) memo.current/);
  assert.match(source, /mounted.current && live.current.enabled/);
  assert.match(source, /live.current.epoch === epoch/);
  assert.match(source, /currentCustomerOwner\(\) === ownerId/);
  assert.match(source, /callback.current\?\.\(enabled && scope \? evidence : null\)/);
  assert.match(source, /const complete = useRef\(onComplete\)/);
  assert.equal([...source.matchAll(/complete.current\?\.\(\)/g)].length, 2);
  assert.match(source, /\{evidence.ingredientsText\}/);
  assert.doesNotMatch(source, /Linking|openURL|WebView|fetch\(|getPersonalContext|requestIngredientExplanation/);
  assert.doesNotMatch(source, /ingredientsText\.slice|numberOfLines/);
});

test('authored interface copy contains no colons or dash punctuation while source text is preserved', () => {
  const source = readFileSync(new URL('../src/components/check/WebProductIngredients.tsx', import.meta.url), 'utf8');
  const messages = source.slice(source.indexOf('const messages'), source.indexOf('/** Ephemeral'));
  const authored = [...messages.matchAll(/\w+: '([^']+)'/g),
    ...source.matchAll(/(?:label|accessibilityLabel)="([^"]+)"/g), ...source.matchAll(/>([^<{]+)</g)]
    .map(match => match[1].trim()).filter(Boolean);
  assert.ok(authored.length >= 10);
  for (const copy of authored) assert.doesNotMatch(copy, /[:\-\u2013\u2014]/);
  const result = parseWebProductIngredientLookup(found);
  if (result.status === 'found') assert.match(result.evidence.ingredientsText, /PEG-8/);
});

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server');
type RenderState = { scope: string; epoch: number; kind: 'result'; result: WebProductIngredientLookup }
  | { scope: string; epoch: number; kind: 'loading' | 'error' };
function renderWebIngredients(selected: RenderState, activeOwner = owner, enabled = true) {
  let stateIndex = 0;
  const native = (tag: string) => ({ children }: { children?: React.ReactNode }) => React.createElement(tag, {}, children);
  const authState = { sessionUserId: activeOwner, status: 'SIGNED_IN' };
  const accessState = { status: 'READY', userId: activeOwner, access: { userId: activeOwner } };
  const dependency = (name: string) => {
    if (name === 'react') return { ...React, useEffect: () => {}, useMemo: (create: () => unknown) => create(),
      useRef: (initial: unknown) => ({ current: initial }), useState: (initial: unknown) => [stateIndex++ === 1 ? selected : initial, () => {}] };
    if (name === 'react-native') return { View: native('div'), Text: native('span'), ActivityIndicator: native('i'),
      StyleSheet: { create: (value: unknown) => value } };
    if (name.endsWith('/Button')) return { Button: ({ label }: { label: string }) => React.createElement('button', {}, label) };
    if (name.endsWith('/theme')) return { colors, radii, spacing, typography };
    if (name.endsWith('/webProductIngredients')) return { webProductIngredientKey, validWebIngredientQuery,
      requestWebProductIngredients: () => { throw Error('Static fixture must not request web evidence'); } };
    if (name.endsWith('/customerGateway')) return { currentCustomerOwner: () => activeOwner };
    if (name.endsWith('/supabase')) return { supabase: null };
    if (name.endsWith('/authStore')) return { useAuthStore: (select: (state: typeof authState) => unknown) => select(authState) };
    if (name.endsWith('/freeAccessStore')) return { useFreeAccessStore: (select: (state: typeof accessState) => unknown) => select(accessState) };
    throw Error('Unexpected render dependency ' + name);
  };
  const module = { exports: {} as { WebProductIngredients?: React.ComponentType<{ ownerId: string; query: typeof query; enabled: boolean }> } };
  const source = readFileSync(new URL('../src/components/check/WebProductIngredients.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
    esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(dependency, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.WebProductIngredients!, { ownerId: owner, query, enabled }));
}

test('actual web ingredient display includes complete escaped source text and provenance inline', () => {
  const ingredientText = 'Water, <script>alert(1)</script>, PEG-8, ' + 'Glycerin, '.repeat(400) + 'Final ingredient';
  const synthetic = { ...evidence, ingredientsText: ingredientText, sourceName: 'Synthetic <brand>',
    productName: 'Synthetic <deodorant>', retrievedAt: '2026-09-30T12:00:00Z' };
  const html = renderWebIngredients({ scope, epoch: 0, kind: 'result', result: { status: 'found', evidence: synthetic } });
  const escaped = ingredientText.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  assert.ok(html.includes(escaped), 'The entire list must render without truncation');
  assert.match(html, /Ingredient list/);
  assert.match(html, /Published online/);
  assert.match(html, /Synthetic &lt;deodorant&gt;/);
  assert.match(html, /Synthetic &lt;brand&gt;/);
  const date = new Date(synthetic.retrievedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  assert.ok(html.includes('Retrieved ' + date));
  assert.match(html, /This published list may differ from your package/);
  assert.match(html, /Compare it with the ingredients printed on your bottle/);
  assert.doesNotMatch(html, /<a\b|<iframe\b|<script\b|Finding your ingredient list|Try ingredient search again/);
});

test('actual web display suppresses another owner, another product, disabled state and stale epoch', () => {
  const selected: RenderState = { scope, epoch: 0, kind: 'result', result: found };
  assert.equal(renderWebIngredients(selected, 'another-owner'), '');
  assert.equal(renderWebIngredients(selected, owner, false), '');
  for (const change of [{ scope: owner + ':another-product' }, { epoch: 1 }]) {
    const html = renderWebIngredients({ ...selected, ...change });
    assert.doesNotMatch(html, /Fixture Deodorant|Fragrance \(Parfum\)/);
    assert.match(html, /Finding your ingredient list/);
  }
});

test('actual web display renders setup failure and loading with distinct conversational copy', () => {
  const unavailable = renderWebIngredients({ scope, epoch: 0, kind: 'result', result: { status: 'configuration_required' } });
  assert.match(unavailable, /Web ingredient search is not available in this test yet/);
  assert.match(unavailable, /Try ingredient search again/);
  const loading = renderWebIngredients({ scope, epoch: 0, kind: 'loading' });
  assert.match(loading, /Finding your ingredient list/);
  assert.match(loading, /Checking published product pages for a matching list/);
  assert.doesNotMatch(loading, /Your package can fill the gap|Try ingredient search again|Fixture Deodorant/);
});
