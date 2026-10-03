import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { Script } from 'node:vm';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import { createCatalogSearchController } from '../src/presentation/catalog/searchController.ts';
import { verifiedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';

// React Native cannot execute in Node. Replace only host/native primitives;
// the actual result renderers and validation/projection modules run unchanged.
const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (element: React.ReactNode) => string };
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
function renderer(interactive = false) {
  const cache = new Map<string, { exports: any }>();
  const views: any[] = [];
  const native = (tag: string) => (props: any) => { views.push(props); return React.createElement(tag, {}, props.children); };
  const sheets: any[] = [];
  const effects: Array<() => any> = [];
  const captures: any[] = [];
  const appState = { currentState: 'active', listener: (_state: string) => {} };
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
      if (name === 'react' && interactive) return { ...React, useRef: (initial: any) => { const index = stateCursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; }, useEffect: (effect: () => any) => { effects.push(effect); }, useSyncExternalStore: (_subscribe: any, getState: any) => getState(), useState: (initial: any) => {
        const index = stateCursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], (next: any) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      } };
      if (name === 'react-native') return { Modal: native('div'), KeyboardAvoidingView: native('div'), View: native('div'), Text: native('span'), Image: native('img'), ActivityIndicator: native('i'), ScrollView: native('div'),
        Keyboard: { dismiss() {} }, AppState: { currentState: appState.currentState, addEventListener: (_event: string, listener: (state: string) => void) => { appState.listener = listener; return { remove: () => {} }; } },
        StyleSheet: { create: (value: unknown) => value, absoluteFill: {}, hairlineWidth: 1 }, Platform: { OS: 'ios' }, useWindowDimensions: () => ({ height: 844, width: 390, fontScale: 1 }), AccessibilityInfo: {}, findNodeHandle: () => null,
        TextInput: native('input'), TouchableOpacity: (props: any) => { pressables.push(props); return React.createElement('button', {}, props.children); },
        Pressable: (props: any) => { pressables.push(props); return React.createElement('button', {}, props.children); } };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: native('div'), useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) };
      if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: (props: any) => { modalScopes.push(props); return React.createElement('div', {}, props.children); } };
      if (name === 'react-native-reanimated') return { ReduceMotion: { System: 'system' } };
      if (name === '@gorhom/bottom-sheet') return { __esModule: true, default: sheet, BottomSheetScrollView: (props: any) => { scrollScopes.push(props); return React.createElement('div', {}, props.children); }, BottomSheetBackdrop: native('div') };
      if (name.endsWith('/ProductEvidenceCapture')) return { ProductEvidenceCapture: (props: any) => { captures.push(props); return React.createElement('div'); } };
      if (name.endsWith('/liveFreeEvidenceProcessor')) return { createLiveFreeEvidenceProcessor: () => { throw new Error('Live capture must not run in host fixture'); } };
      if (name.endsWith('/services/productCatalog')) return { searchCatalogProducts: async () => { throw new Error('Default lookup must not run in host fixture'); } };
      if (name.endsWith('/Icon')) return { Icon: native('i') };
      if (name.endsWith('/Button')) return { Button: ({ label }: any) => React.createElement('button', {}, label) };
      if (name.startsWith('.') || name.startsWith('@/')) return load(name.startsWith('@/') ? name.slice(2) : resolve(dirname(file), name));
      return require(name);
    };
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(dependency, module, module.exports);
    return module.exports;
  }
  return { load, views, sheets, modalScopes, scrollScopes, pressables, effects, captures, appState, render: (component: any, props: any) => {
    stateCursor = 0; pressables.length = 0; views.length = 0;
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

test('fixed verdict and substantive findings stay visible while only Source toggles provenance', () => {
  for (const id of ['moisturizer', 'cleanser', 'sunscreen']) {
    const r = renderer(true);
    const { CheckResultView } = r.load('src/components/check/result-sheet/CheckResultContent');
    const { describeResultExample } = r.load('src/presentation/check/result-sheet/examples');
    const props = describeResultExample(id);
    const render = () => r.render(CheckResultView, props);
    let html = render();
    assert.ok(html.indexOf(props.facts.name) < html.indexOf('PERSONAL FIT'));
    for (const finding of props.verdict.findings) {
      assert.match(html, new RegExp(finding.title));
      assert.ok(html.includes(finding.reason));
      for (const limit of finding.limits) assert.ok(html.includes(limit), 'material limits remain visible with sources closed');
    }
    assert.doesNotMatch(html, /Evidence &amp; limits|Why this result|Fictional skin profile|Fictional package label/);
    assert.equal(r.pressables.length, 3, 'no verdict or finding-title expander');
    for (let i = 0; i < r.pressables.length; i++) {
      const control = r.pressables[i];
      assert.equal(control.accessibilityRole, 'button'); assert.equal(control.accessibilityState.expanded, false);
      assert.ok(control.style.minHeight >= 44); assert.ok(control.style.minWidth >= 44);
      assert.equal(control.accessibilityLabel, `Show sources for ${props.verdict.findings[i].title}`);
    }
    r.pressables[0].onPress(); html = render();
    assert.match(html, /Fictional package label/);
    assert.equal(r.pressables[0].accessibilityState.expanded, true);
    assert.equal(r.pressables[1].accessibilityState.expanded, false);
    assert.ok(html.includes(props.verdict.reason));
    for (const finding of props.verdict.findings) assert.ok(html.includes(finding.reason), 'Source cannot hide main reasoning');
    r.pressables[1].onPress(); html = render();
    assert.equal(r.pressables[1].accessibilityState.expanded, true);
    r.pressables[0].onPress(); html = render();
    assert.equal(r.pressables[0].accessibilityState.expanded, false);
    assert.equal(r.pressables[1].accessibilityState.expanded, true);
    if (id !== 'sunscreen') { assert.doesNotMatch(html, /Fictional package label/); assert.match(html, /Recorded steps/); }
  }
});

test('live cautions and unknowns remain visible with all sources closed', () => {
  for (const id of ['caution', 'missing-formula', 'routine-not-provided', 'partial-routine', 'intent-unknown']) {
    const r = renderer(true);
    const { CheckResultView } = r.load('src/components/check/result-sheet/CheckResultContent');
    const { describeResultExample } = r.load('src/presentation/check/result-sheet/examples');
    const props = describeResultExample(id);
    const html = r.render(CheckResultView, props);
    const escaped = (text: string) => renderToStaticMarkup(React.createElement('span', {}, text)).slice(6, -7);
    assert.ok(html.includes(escaped(props.verdict.reason)));
    for (const finding of props.verdict.findings) {
      assert.ok(html.includes(escaped(finding.reason)));
      for (const limit of finding.limits) assert.ok(html.includes(escaped(limit)));
    }
    assert.ok(r.pressables.every(control => control.accessibilityState.expanded === false && control.accessibilityLabel.startsWith('Show sources for')));
  }
});

test('compact fold contains only the complete identity and fixed four-state verdict', () => {
  for (const [id, label] of [['moisturizer', 'Good fit'], ['redundancy', 'Some tradeoffs'], ['caution', 'Not a good fit'], ['missing-formula', 'Not enough information']]) {
    const r = renderer(true);
    const { CheckResultView } = r.load('src/components/check/result-sheet/CheckResultContent');
    const { describeResultExample } = r.load('src/presentation/check/result-sheet/examples');
    const props = describeResultExample(id);
    const html = r.render(CheckResultView, { ...props, section: 'summary' });
    assert.ok(html.includes(props.facts.name)); assert.ok(html.includes(label)); assert.ok(html.includes(props.verdict.reason));
    assert.equal(r.pressables.length, 0, 'verdict has no disclosure or tap action');
    assert.doesNotMatch(html, /Source|For your dryness|In your routine|Texture<\/span>/);
  }
});

test('an unresolved result has an honest compact summary before the recovery swipe', () => {
  const r = renderer();
  const { CheckResultPresentation } = r.load('src/components/check/result-sheet/CheckResultPresentation');
  const html = r.render(CheckResultPresentation, { visible: true, input: null, presentationKey: 'unknown', onClose: () => {} });
  assert.match(html, /Product and formula are unverified/);
});

test('the actual search view exposes loading cancellation, retry and one selection after recovery', async () => {
  const r = renderer(true);
  const { CatalogProductSearch } = r.load('src/components/catalog/CatalogProductSearch');
  let resolve!: (items: any[]) => void;
  let calls = 0, selected = 0;
  const item = { productId: 'sample', brand: 'Example', name: 'Exact variant', category: 'cleanser', imageUrl: null };
  const controller = createCatalogSearchController<any>(async () => {
    calls++;
    if (calls === 2) throw new Error('private transport failure');
    return await new Promise<any[]>(done => { resolve = done; });
  });
  const props = { controller, onSelect: () => { selected++; }, preserveSelection: true };
  controller.setQuery('Example');
  const pending = controller.submit();
  assert.match(r.render(CatalogProductSearch, props), /Searching products/);
  r.pressables.find(p => p.accessibilityLabel === 'Cancel product search').onPress();
  resolve([item]); await pending;
  assert.deepEqual(controller.snapshot().items, []);
  assert.match(r.render(CatalogProductSearch, props), /Search again/);
  await r.pressables.find(p => p.accessibilityLabel === 'Resume product search').onPress();
  await Promise.resolve();
  const failed = r.render(CatalogProductSearch, props);
  assert.match(failed, /Search is unavailable/); assert.match(failed, /Retry/);
  assert.doesNotMatch(failed, /private transport failure/);
  r.pressables.find(p => p.accessibilityLabel === 'Retry product search').onPress();
  resolve([item]); await Promise.resolve(); await Promise.resolve();
  r.render(CatalogProductSearch, props);
  const action = r.pressables.find(p => p.accessibilityLabel === 'Add Example Exact variant');
  assert.ok(action);
  action.onPress(); action.onPress();
  assert.equal(selected, 1);
  controller.releaseSelection(); action.onPress();
  assert.equal(selected, 2);
  controller.dispose();
});

test('the actual capture host pauses detection and delivers interrupted evidence once on foreground', () => {
  const r = renderer(true);
  const { CheckCaptureHost } = r.load('src/components/check/capture/CheckCaptureHost');
  let handedOff = 0;
  const props = { live: false, onClose: () => {}, onCaptureReady: () => { handedOff++; } };
  r.render(CheckCaptureHost, props);
  r.effects.forEach(effect => effect());
  const capture = r.captures.at(-1);
  const evidence = { evidence: [{ kind: 'barcode', role: 'barcode', value: '036000291452' }] };
  r.appState.listener('background');
  capture.onEvidenceReady(evidence);
  assert.equal(handedOff, 0);
  r.render(CheckCaptureHost, props);
  assert.equal(r.captures.at(-1).detectionPaused, true);
  r.appState.listener('active');
  assert.equal(handedOff, 1, 'completed evidence resumes without another shutter or scan');
  capture.onEvidenceReady(evidence);
  r.appState.listener('active');
  assert.equal(handedOff, 1, 'duplicate callbacks and foreground events cannot redeliver');
});

test('compact recovery is visible before any swipe and inline search replaces the same surface', () => {
  const r = renderer();
  const { CheckResultPresentation } = r.load('src/components/check/result-sheet/CheckResultPresentation');
  const props = { visible: true, input: null, presentationKey: 'retained-case', onClose() {},
    compactActions: React.createElement('button', {}, 'Photograph package'), children: React.createElement('p', {}, 'Expanded provenance') };
  const compact = r.render(CheckResultPresentation, props);
  assert.match(compact, /Photograph package/); assert.doesNotMatch(compact, /Expanded provenance/);
  const replaced = r.render(CheckResultPresentation, { ...props, replacement: React.createElement('p', {}, 'Back to result / Search by name') });
  assert.match(replaced, /Back to result/); assert.doesNotMatch(replaced, /Product not confirmed|Photograph package|Expanded provenance/);
  const restored = r.render(CheckResultPresentation, props);
  assert.match(restored, /Product not confirmed/); assert.match(restored, /Photograph package/);
});

test('a bound ingredient action is immediately visible and rejects another owner before capture', () => {
  const r = renderer();
  const { ScanResultSheet } = r.load('src/components/check/result-sheet/ScanResultSheet');
  const { buildScanResultSheet } = r.load('src/presentation/check/result-sheet/model');
  const snapshot = { ...verifiedProductTruth, formula: null, catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null }, state: 'identified_formula_unverified', nextRequiredEvidence: 'ingredients' };
  const resolution = { caseId: snapshot.resolutionCaseId, state: snapshot.state, product: snapshot.product, candidates: [], nextAction: 'photograph_ingredients', truthSnapshot: snapshot };
  const model = buildScanResultSheet({ kind: 'snapshot', snapshot, resolverResult: resolution, ownerId: 'owner-a' });
  let actions = 0;
  const props = { model, currentOwnerId: 'owner-a', currentSnapshot: snapshot, currentResolverResult: resolution,
    currentScanId: 'scan-a', onDismiss() {}, onAddRequestedEvidence() { actions++; } };
  assert.match(r.render(ScanResultSheet, props), /Photograph ingredients/);
  r.pressables.find(p => p.accessibilityLabel === 'Photograph ingredients').onPress();
  assert.equal(actions, 1);
  assert.equal(r.render(ScanResultSheet, { ...props, currentOwnerId: 'owner-b' }), '');
});

test('native result surface uses registered keyboard interaction and keeps dismiss/restore guards', () => {
  const r = renderer(); const { CheckResultPresentation } = r.load('src/components/check/result-sheet/CheckResultPresentation');
  r.render(CheckResultPresentation, { visible: true, input: null, presentationKey: 'keyboard', onClose() {}, compactActions: React.createElement('input') });
  const sheet = r.sheets.at(-1);
  assert.equal(sheet.keyboardBehavior, 'interactive'); assert.equal(sheet.keyboardBlurBehavior, 'restore');
  assert.equal(sheet.enableBlurKeyboardOnGesture, true);
});
test('host rearms one handoff per explicit resume without remounting or delivering old background evidence', () => {
  const r = renderer(true); const { CheckCaptureHost } = r.load('src/components/check/capture/CheckCaptureHost');
  let count = 0; const props = { live: false, onClose() {}, onCaptureReady() { count++; }, resumeKey: 0 };
  r.render(CheckCaptureHost, props); r.effects.forEach(effect => effect());
  const evidence = { evidence: [{ kind: 'barcode', role: 'barcode', value: '036000291452' }] };
  r.captures.at(-1).onEvidenceReady(evidence); assert.equal(count, 1);
  r.render(CheckCaptureHost, { ...props, resumeKey: 1 });
  r.appState.listener('background'); r.captures.at(-1).onEvidenceReady(evidence);
  r.render(CheckCaptureHost, { ...props, resumeKey: 2 }); r.appState.listener('active'); assert.equal(count, 1);
  r.captures.at(-1).onEvidenceReady(evidence); r.captures.at(-1).onEvidenceReady(evidence); assert.equal(count, 2);
});


test('direct Search has one content detent, no empty details, and stable height through typing status changes', () => {
  const r = renderer(true);
  const { ScanResultSheet } = r.load('src/components/check/result-sheet/ScanResultSheet');
  const { buildScanResultSheet } = r.load('src/presentation/check/result-sheet/model');
  const props = { model: buildScanResultSheet({ kind: 'unknown', ownerId: 'owner-a', scanId: 'search-a' }),
    currentOwnerId: 'owner-a', currentSnapshot: null, currentResolverResult: null, currentScanId: 'search-a',
    searchOnly: true, searchEmpty: false, onDismiss() {}, compactActions: React.createElement('input'),
    children: React.createElement('p', {}, 'Not a product result yet') };
  let html = r.render(ScanResultSheet, props);
  assert.doesNotMatch(html, /Not enough information|Not a product result yet/);
  assert.equal(r.sheets.at(-1).snapPoints.length, 1, 'interactive keyboard cannot lift to a full-result detent');
  assert.ok(r.sheets.at(-1).snapPoints[0] <= 200, 'empty search occupies its compact content');
  const measure = (height: number) => r.views.find(p => p.onLayout && String(p.onLayout).includes('setSummaryHeight')).onLayout({ nativeEvent: { layout: { height } } });
  measure(280); r.render(ScanResultSheet, props);
  const withResults = r.sheets.at(-1).snapPoints[0];
  assert.ok(withResults > 300, 'results grow the same search surface');
  measure(90); r.render(ScanResultSheet, props);
  assert.equal(r.sheets.at(-1).snapPoints[0], withResults, 'typing/loading rows cannot shrink and bounce the sheet');
  const handle = r.sheets.at(-1).handleComponent({});
  assert.equal(handle.props.style.paddingTop, handle.props.style.paddingHorizontal, 'X center has equal top/right inset');
  const close = handle.props.children[1];
  assert.equal(close.props.style.width, 44); assert.equal(close.props.style.height, 44);
});


test('capture overlay presents inside the current native result modal outside lazy findings and sheet detents', () => {
  const r = renderer(true);
  const { ResultSheetSurface } = r.load('src/components/check/result-sheet/ResultSheetSurface');
  const overlay = React.createElement('aside', {}, 'Retained label capture');
  const props = { presentationKey: 'retained-result', onClose() {},
    summary: React.createElement('p', {}, 'Product summary'),
    children: React.createElement('p', {}, 'Lazy ingredient finding'), overlay };
  const render = (extra: object = {}) => r.render(ResultSheetSurface, { ...props, ...extra });
  const assertNativeParent = () => {
    const nativeModal = r.views.find(view => view.visible && view.transparent);
    assert(nativeModal, 'normal entry owns one native result modal');
    const provider = nativeModal.children;
    const [body, hostedOverlay] = React.Children.toArray(provider.props.children) as React.ReactElement<any>[];
    assert.equal(hostedOverlay.props.children, 'Retained label capture');
    assert.equal(body.props.overlay, undefined, 'capture is outside SheetBody and its conditional findings');
    assert.equal(nativeModal.children.props.children[1], overlay, 'current native modal owns the actual overlay');
  };
  let html = render(); assertNativeParent();
  assert.match(html, /Retained label capture/); assert.doesNotMatch(html, /Lazy ingredient finding/);
  r.sheets.at(-1).onChange(1); html = render(); assertNativeParent();
  assert.match(html, /Lazy ingredient finding/); assert.match(html, /Retained label capture/);
  html = render({ replacement: React.createElement('p', {}, 'Replacement search') }); assertNativeParent();
  assert.match(html, /Replacement search/); assert.match(html, /Retained label capture/);
  assert.doesNotMatch(html, /Lazy ingredient finding/);
  r.sheets.at(-1).onChange(0); html = render(); assertNativeParent();
  assert.doesNotMatch(html, /Lazy ingredient finding/); assert.match(html, /Retained label capture/);
  html = render({ inline: true });
  assert.match(html, /Retained label capture/);
  assert(!r.views.some(view => view.visible && view.transparent), 'camera retains inline companion presentation');
  assert.equal(render({ visible: false }), '', 'a hidden result cannot leave a capture overlay visible');
});
