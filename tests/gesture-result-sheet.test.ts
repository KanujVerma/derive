import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';

// React Native cannot execute in Node. Replace only host/native primitives;
// the actual result renderers and validation/projection modules run unchanged.
const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (element: React.ReactNode) => string };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
function renderer(interactive = false) {
  const cache = new Map<string, { exports: any }>();
  const native = (tag: string) => ({ children }: any) => React.createElement(tag, {}, children);
  const sheets: any[] = [];
  const pressables: any[] = [], state: any[] = [];
  let stateCursor = 0;
  const modalScopes: any[] = [], scrollScopes: any[] = [];
  const sheet = (props: any) => { sheets.push(props); return React.createElement('section', {}, props.children); };
  function load(path: string): any {
    path = resolve(root, path);
    const file = [path, `${path}.tsx`, `${path}.ts`].find(existsSync);
    if (!file) throw new Error(`Missing component: ${path}`);
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} as any }; cache.set(file, module);
    const dependency = (name: string): any => {
      if (name === 'react' && interactive) return { ...React, useState: (initial: any) => {
        const index = stateCursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], (next: any) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      } };
      if (name === 'react-native') return { Modal: native('div'), KeyboardAvoidingView: native('div'), View: native('div'), Text: native('span'), Image: native('img'), ActivityIndicator: native('i'), ScrollView: native('div'),
        StyleSheet: { create: (value: unknown) => value, absoluteFill: {}, hairlineWidth: 1 }, Platform: { OS: 'ios' }, useWindowDimensions: () => ({ height: 844, width: 390, fontScale: 1 }), AccessibilityInfo: {}, findNodeHandle: () => null,
        Pressable: (props: any) => { pressables.push(props); return React.createElement('button', {}, props.children); } };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: native('div'), useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) };
      if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: (props: any) => { modalScopes.push(props); return React.createElement('div', {}, props.children); } };
      if (name === 'react-native-reanimated') return { ReduceMotion: { System: 'system' } };
      if (name === '@gorhom/bottom-sheet') return { __esModule: true, default: sheet, BottomSheetScrollView: (props: any) => { scrollScopes.push(props); return React.createElement('div', {}, props.children); }, BottomSheetBackdrop: native('div') };
      if (name.endsWith('/Icon')) return { Icon: native('i') };
      if (name.endsWith('/Button')) return { Button: ({ label }: any) => React.createElement('button', {}, label) };
      if (name.startsWith('.') || name.startsWith('@/')) return load(name.startsWith('@/') ? name.slice(2) : resolve(dirname(file), name));
      return require(name);
    };
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(dependency, module, module.exports);
    return module.exports;
  }
  return { load, sheets, modalScopes, scrollScopes, pressables, render: (component: any, props: any) => {
    stateCursor = 0; pressables.length = 0;
    return renderToStaticMarkup(React.createElement(component, props));
  } };
}

test('sheet continuous mode exposes all bound reasons, evidence and uncertainties without another disclosure', () => {
  const fixture = personalDecisionFixtures.find(item => item.id === 'prior-reaction')!;
  const r = renderer();
  const { PersonalDecisionPanel } = r.load('src/components/personal-decision/PersonalDecisionPanel');
  const html = r.render(PersonalDecisionPanel, { packet: fixture.packet, expectedBinding: fixture.packet.binding, embedded: true, expanded: true, continuous: true });
  assert.doesNotMatch(html, /Why Derive thinks this<\/button>|Review \d+ evidence records|Show more (reasons|evidence records)/);
  assert.match(html, /Evaluation/);
  const { describePersonalDecision } = r.load('src/presentation/personal-decision/result');
  const view = describePersonalDecision(fixture.packet, fixture.packet.binding);
  assert.equal(view.kind, 'ready');
  for (const group of view.detailGroups) for (const row of group.evidence) assert.ok(html.includes(row.label.replaceAll('&', '&amp;')), `missing bound evidence: ${row.label}`);
  for (const caution of view.criticalCautions) assert.ok(html.includes(caution.replaceAll('&', '&amp;')));
});

test('preview product keeps unverified package formula primary and save incapability secondary', () => {
  const r = renderer();
  const { CheckResultContent } = r.load('src/components/check/result-sheet/CheckResultContent');
  const html = r.render(CheckResultContent, { input: { ownerId: null, snapshot: null, catalogFacts: { brand: 'CeraVe', name: 'Moisturizing Cream', categoryLabel: 'Moisturizer', formula: null, source: null }, fit: { kind: 'preview_unavailable' } }, continuous: true });
  assert.match(html, /Not enough information/);
  assert.match(html, /ingredient list for your exact package has not been verified/);
  assert.ok(html.indexOf('ingredient list') < html.indexOf('No personal assessment is saved'));
  assert.doesNotMatch(html, /Personal Fit unavailable in this preview/);
});

test('root result mounts one scroll-connected swipe sheet with complete content and no second-page controls', () => {
  const r = renderer();
  const { CheckResultPresentation } = r.load('src/components/check/result-sheet/CheckResultPresentation');
  const html = r.render(CheckResultPresentation, { visible: true, input: { ownerId: null, snapshot: null, catalogFacts: { brand: 'CeraVe', name: 'Cream', categoryLabel: '', formula: null, source: null }, fit: { kind: 'preview_unavailable' } }, presentationKey: 'case-a', full: false, onFullChange: () => {}, onClose: () => {}, children: React.createElement('p', {}, 'Preserved host extras') });
  assert.equal(r.sheets.length, 1);
  assert.equal(r.sheets[0].enablePanDownToClose, true);
  assert.equal(r.sheets[0].enableDynamicSizing, false);
  assert.equal(r.sheets[0].overrideReduceMotion, 'system');
  assert.ok(r.sheets[0].snapPoints.length >= 2);
  assert.doesNotMatch(html, /Preserved host extras/, 'collapsed fold hides the next section');
  assert.doesNotMatch(html, /View full result|Hide formula details|Check result<\/span>/);
});

test('an old closing animation cannot dismiss a replacement case or deliver twice', () => {
  const r = renderer();
  let exports: any = {};
  try { exports = r.load('src/components/check/result-sheet/ResultSheetSurface'); } catch { /* Missing feature is asserted below. */ }
  assert.equal(typeof exports.createSheetDismissGuard, 'function', 'sheet needs a local mount/key dismissal guard');
  let key = 'case-a';
  const delivered: string[] = [];
  const old = exports.createSheetDismissGuard('case-a', () => delivered.push('case-a'), () => key);
  key = 'case-b';
  old.dismiss();
  assert.equal(delivered.length, 0);
  const current = exports.createSheetDismissGuard('case-b', () => delivered.push('case-b'), () => key);
  current.dismiss(); current.dismiss();
  assert.deepEqual(delivered, ['case-b']);
  const unmounted = exports.createSheetDismissGuard('case-b', () => delivered.push('unmounted'), () => key);
  unmounted.deactivate(); unmounted.dismiss();
  assert.deepEqual(delivered, ['case-b']);
});

test('camera companion preserves host extras and hides completely when the current owner changes', () => {
  const r = renderer();
  const { ScanResultSheet } = r.load('src/components/check/result-sheet/ScanResultSheet');
  const { buildScanResultSheet } = r.load('src/presentation/check/result-sheet/model');
  const model = buildScanResultSheet({ kind: 'loading', ownerId: 'owner-a', scanId: 'scan-a' });
  const props = { model, currentOwnerId: 'owner-a', currentSnapshot: null, currentResolverResult: null, currentScanId: 'scan-a', onDismiss: () => {}, children: React.createElement('p', {}, 'Current camera extras') };
  assert.doesNotMatch(r.render(ScanResultSheet, props), /Current camera extras/);
  assert.equal(r.sheets.length, 1);
  assert.equal(r.render(ScanResultSheet, { ...props, currentOwnerId: 'owner-b' }), '');
  assert.equal(r.sheets.length, 1, 'stale owner must not mount another gesture surface');
});


test('VoiceOver modal scope includes the handle and Close as well as the scroll content', () => {
  const r = renderer();
  const { CheckResultPresentation } = r.load('src/components/check/result-sheet/CheckResultPresentation');
  r.render(CheckResultPresentation, { visible: true, presentationKey: 'accessible-case', input: null, onClose: () => {} });
  assert.equal(r.modalScopes[0].accessibilityViewIsModal, true);
  assert.equal(r.scrollScopes[0].accessibilityViewIsModal, undefined);
});

test('first expanded detent reveals findings and host actions directly', () => {
  const r = renderer();
  const { ResultSheetSurface } = r.load('src/components/check/result-sheet/ResultSheetSurface');
  const html = r.render(ResultSheetSurface, { presentationKey: 'expanded', onClose() {}, initialDetent: 1,
    summary: React.createElement('p', {}, 'Product and verdict'), children: React.createElement('p', {}, 'Substantive finding and action') });
  assert.match(html, /Product and verdict/); assert.match(html, /Substantive finding and action/);
  assert.equal(r.sheets[0].index, 1);
});

test('fact rows and verdict disclose their own evidence with accessible state and comfortable targets', () => {
  const r = renderer(true);
  const { CheckResultView } = r.load('src/components/check/result-sheet/CheckResultContent');
  const { describeResultExample } = r.load('src/presentation/check/result-sheet/examples');
  const props = describeResultExample('moisturizer');
  const render = () => r.render(CheckResultView, props);
  let html = render();
  assert.ok(html.indexOf('Comfort Moisturizing Cream') < html.indexOf('PERSONAL FIT'));
  assert.ok(html.indexOf('PERSONAL FIT') < html.indexOf('In your routine'));
  assert.match(html, /Rich cream · Your preferred texture/);
  assert.match(html, /In your routine/); assert.match(html, /Evening, after cleanser/);
  assert.doesNotMatch(html, /Your goal|Evidence &amp; limits|Why this result|Fictional preference/);
  assert.equal(r.pressables.length, 2);
  for (const row of r.pressables) {
    assert.equal(row.accessibilityRole, 'button'); assert.equal(row.accessibilityState.expanded, false);
    assert.ok(row.style.minHeight >= 44); assert.match(row.accessibilityLabel, /Show evidence/);
  }
  r.pressables[0].onPress(); html = render();
  assert.match(html, /Fictional preference: richer evening cream/);
  assert.match(html, /Package description/); assert.match(html, /does not establish hydration/);
  assert.equal(r.pressables[0].accessibilityState.expanded, true);
  assert.equal(r.pressables[1].accessibilityState.expanded, false);
  r.pressables[1].onPress(); html = render();
  assert.match(html, /Recorded steps/); assert.match(html, /Intent: add an evening moisturizer/);
  assert.equal(r.pressables[1].accessibilityState.expanded, true);
  r.pressables[0].onPress(); html = render();
  assert.doesNotMatch(html, /Fictional preference/); assert.match(html, /Recorded steps/);
});
