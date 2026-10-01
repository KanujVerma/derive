import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import React from 'react';
import ts from 'typescript';
import test from 'node:test';
import { colors, radii, spacing, typography } from '../src/constants/theme.ts';
import type { PublishedIngredientEvidence } from '../src/contracts/ProductIngredientLookup.ts';
import { ingredientLookupCopy } from '../src/presentation/external-products/ingredientLookupCopy.ts';

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server');
const file = new URL('../src/components/check/PublishedProductIngredients.tsx', import.meta.url);
const item: PublishedIngredientEvidence = { source: 'open_beauty_facts',
  sourceUrl: 'https://world.openbeautyfacts.org/product/0012044038840', sourceLicense: 'ODbL-1.0',
  retrievedAt: '2026-09-30T00:00:00Z', sourceModifiedAt: null, barcode: '0012044038840',
  productName: 'Synthetic cosmetic fixture', brand: 'Fixture', quantity: null,
  ingredientsText: 'Water, Glycerin, <script>alert(1)</script>, Parfum', matchBasis: 'barcode',
  formulaVerified: false, canonicalProductId: null };
function render(expanded = false, evidence = item) {
  const identity = JSON.stringify([evidence.source, evidence.sourceUrl, evidence.retrievedAt, evidence.ingredientsText]);
  const native = (tag: string) => ({ children }: { children?: React.ReactNode }) => React.createElement(tag, {}, children);
  const dependency = (name: string) => {
    if (name === 'react') return expanded ? { ...React, useState: () => [identity, () => {}] } : React;
    if (name === 'react-native') return { View: native('div'), Text: native('span'), ActivityIndicator: native('i'), StyleSheet: { create: (v: unknown) => v } };
    if (name.endsWith('/Button')) return { Button: ({ label }: { label: string }) => React.createElement('button', {}, label) };
    if (name.endsWith('/theme')) return { colors, radii, spacing, typography };
    if (name.endsWith('/productIngredients')) return {};
    if (name.endsWith('/PersonalIngredientNotes')) return {};
    if (name.endsWith('/WebProductIngredients')) return {};
    if (name.endsWith('/ingredientLookupCopy')) return { ingredientLookupCopy };
    if (name.endsWith('/supabase')) return {};
    if (name.endsWith('/authStore')) return {};
    throw Error('Unexpected render dependency: ' + name);
  };
  const module = { exports: {} as { IngredientEvidenceCard?: React.ComponentType<{ item: PublishedIngredientEvidence }> } };
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(dependency, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.IngredientEvidenceCard!, { item: evidence }));
}
test('actual ingredient card displays complete list inline, escapes source text and never redirects', () => {
  const html = render();
  assert.match(html, /Ingredient list|Published list/);
  assert.match(html, /Water, Glycerin, &lt;script&gt;alert\(1\)&lt;\/script&gt;, Parfum/);
  assert.match(html, /Source details/);
  assert.doesNotMatch(html, /<a\b|<iframe\b|<script\b|Open manufacturer|Open ingredient source/);
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /Linking\.openURL|<WebView|manufacturerIngredientPage|import[^\n]*Linking/);
});
test('expanded provenance remains inline and does not claim a verified formula', () => {
  const html = render(true);
  assert.match(html, /ODbL 1.0/);
  assert.match(html, /world.openbeautyfacts.org\/product/);
  assert.match(html, /has not been confirmed against your package/);
  assert.match(html, /Hide source details/);
  const dailymed = render(true, { ...item, source: 'dailymed', sourceLicense: 'DailyMed-public-label',
    matchBasis: 'name_variant', barcode: null, sourceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fixture' });
  assert.match(dailymed, /Name \/ variant match/);
  assert.match(dailymed, /not barcode verification/);
});
test('ingredients precede reported history and explicit saving remains present', () => {
  const parent = readFileSync(new URL('../src/components/check/PrivateUpcFallback.tsx', import.meta.url), 'utf8');
  assert.ok(parent.indexOf('<PublishedProductIngredients') < parent.indexOf('<ExternalProductActions'));
  const actions = readFileSync(new URL('../src/components/check/ExternalProductActions.tsx', import.meta.url), 'utf8');
  assert.match(actions, /Save product to My Stuff/);
  assert.match(actions, /historyScope === JSON.stringify\(\[ownerId, key\]\)/);
});
test('visual fixture is development-only and explicitly synthetic, not provider evidence', () => {
  const source = readFileSync(new URL('../app/personalize/ingredients-preview.tsx', import.meta.url), 'utf8');
  assert.match(source, /!__DEV__ \|\| publicEnvironment.buildFlavor !== 'development'/);
  assert.match(source, /DEVELOPMENT PREVIEW · SYNTHETIC DATA/);
  assert.doesNotMatch(source, /requestProductIngredients|\.invoke\(|fetch\(/);
});
