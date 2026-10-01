import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import type { PrivateUpcCandidate, PrivateUpcLookup } from '../src/contracts/PrivateUpcLookup.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

/** Component execution with explicit effect flushing; native hosts/network are inert. */
function hooks() {
  const slots: any[] = [];
  let cursor = 0;
  const effects: Array<() => void> = [];
  const runtime = { ...React,
    useState(initial: any) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (update: any) => { slots[slot] = typeof update === 'function' ? update(slots[slot]) : update; }];
    },
    useRef(initial: any) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const slot = cursor++;
      const previous = slots[slot];
      if (previous && deps.every((value, index) => Object.is(value, previous.deps[index]))) return;
      const next = { deps, cleanup: undefined as void | (() => void) };
      slots[slot] = next;
      effects.push(() => { previous?.cleanup?.(); next.cleanup = effect(); });
    },
    useLayoutEffect() {},
    useCallback(callback: any) { return callback; },
  };
  return { runtime, reset: () => { cursor = 0; }, flush: () => { effects.splice(0).forEach(effect => effect()); } };
}

const owner = 'e6000000-0000-4000-8000-000000000003';
const barcode = '0012044038840';
const candidate: PrivateUpcCandidate = {
  source: 'upcitemdb', rightsPolicy: 'internal_evaluation_only', sourceRecordId: barcode,
  sourceUrl: `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
  retrievedAt: '2026-10-01T12:00:00Z', observedBarcode: barcode, sourceBarcode: barcode,
  brand: 'Old Spice', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 Oz',
  size: 'One 3oz. Stick', category: 'Deodorant', canonicalProductId: null, formulaVerified: false,
};
const found: PrivateUpcLookup = { status: 'found', candidates: [candidate], truncated: false };
const settle = async () => { for (let turn = 0; turn < 8; turn++) await Promise.resolve(); };

function fallbackHarness(request: () => Promise<PrivateUpcLookup>) {
  const lifecycle = hooks();
  let sessionOwner: string | null = owner;
  let calls = 0, closes = 0;
  const authStore = Object.assign((selector: any) => selector({ sessionUserId: sessionOwner }), {
    getState: () => ({ sessionUserId: sessionOwner }),
  });
  const harness = componentHarness('src/components/check/PrivateUpcFallback.tsx', 'PrivateUpcFallback', {
    barcode, ownerId: owner, sheet: { presentationKey: 'case-1', onClose: () => { closes++; } },
    children: React.createElement('RecoveryAction', { label: 'Search by name' }),
  }, { modules: {
    react: lifecycle.runtime,
    '@/src/config/environment': { publicEnvironment: { buildFlavor: 'development' } },
    '@/src/services/supabase': { supabase: { functions: { invoke: async () => { calls++; return { data: await request(), error: null }; } } } },
    '@/src/stores/authStore': { useAuthStore: authStore },
    '@/src/components/check/PublishedProductIngredients': { PublishedProductIngredients: 'PublishedProductIngredients' },
    '@/src/components/check/ExternalProductActions': { ExternalProductActions: 'ExternalProductActions' },
    '@/src/components/check/result-sheet/CheckResultContent': { CheckResultView: 'CheckResultView' },
    '@/src/components/check/result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('ResultSheetSurface', props, props.summary, props.children) },
  } });
  return {
    render(props?: Record<string, any>) { lifecycle.reset(); return harness.render(props); },
    flush: lifecycle.flush,
    switchOwner: (next: string | null) => { sessionOwner = next; },
    calls: () => calls, closes: () => closes,
  };
}

async function withPrivateFlag(run: () => Promise<void>) {
  const previous = process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED;
  process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED = 'true';
  try { await run(); } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED;
    else process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED = previous;
  }
}

test('external match uses Kanuj sheet with real candidate identity and existing ingredient/save children, not a fabricated verdict', async () => {
  await withPrivateFlag(async () => {
    const app = fallbackHarness(async () => found);
    assert.match(textContent(app.render()), /Looking for a possible barcode match/);
    app.flush(); await settle();
    const nodes = app.render();
    const surface = nodes.find(node => node.type === 'ResultSheetSurface')!;
    const summary = nodes.find(node => node.type === 'CheckResultView')!;
    assert.equal(summary.props.facts.name, candidate.name);
    assert.equal(summary.props.facts.brand, 'Old Spice');
    assert.equal(summary.props.facts.categoryLabel, candidate.size);
    assert.equal(summary.props.facts.formula, null);
    assert.equal(summary.props.verdict.state, 'unknown');
    assert.equal(surface.props.keepDetailsMounted, true);
    assert.equal(surface.props.presentationKey, JSON.stringify([owner, barcode, 'case-1']));
    const ingredients = nodes.find(node => node.type === 'PublishedProductIngredients')!;
    assert.deepEqual(ingredients.props.query, { barcode, name: candidate.name, brand: candidate.brand, size: candidate.size });
    assert.equal(ingredients.props.ownerId, owner);
    assert.equal(nodes.filter(node => node.type === 'ExternalProductActions').length, 1);
    assert.ok(nodes.some(node => node.type === 'RecoveryAction'));
    assert.match(textContent(nodes), /Ingredients, formula and personal fit are not verified/);
    app.flush(); await settle(); app.render();
    assert.equal(app.calls(), 1, 'rendering the sheet must not start a second lookup');
    surface.props.onClose(); assert.equal(app.closes(), 1);
    press(control(nodes, 'Retry external lookup')); await settle(); app.render();
    assert.equal(app.calls(), 2, 'only an explicit retry starts another lookup');
  });
});

test('owner switch hides candidate before effects and blocks old in-flight result publication', async () => {
  await withPrivateFlag(async () => {
    let finish!: (value: PrivateUpcLookup) => void;
    const app = fallbackHarness(() => new Promise(resolve => { finish = resolve; }));
    app.render(); app.flush(); assert.equal(app.calls(), 1);
    app.switchOwner('different-owner');
    const hidden = app.render();
    assert.match(textContent(hidden), /signed-in test session/);
    assert.equal(hidden.some(node => node.type === 'ResultSheetSurface'), false);
    assert.equal(hidden.some(node => node.type === 'PublishedProductIngredients'), false);
    app.flush(); finish(found); await settle();
    assert.equal(app.render().some(node => node.type === 'CheckResultView'), false);
    assert.equal(app.calls(), 1);
  });
});

test('ambiguous identity remains a confirmation list and never picks one candidate for ingredient matching', async () => {
  await withPrivateFlag(async () => {
    const app = fallbackHarness(async () => ({ status: 'ambiguous', candidates: [candidate], truncated: false }));
    app.render(); app.flush(); await settle();
    const nodes = app.render();
    assert.equal(nodes.find(node => node.type === 'CheckResultView')!.props.facts.name, 'Confirm the matching product');
    assert.match(textContent(nodes), /Check that this matches your label/);
    assert.deepEqual(nodes.find(node => node.type === 'PublishedProductIngredients')!.props.query,
      { barcode, name: null, brand: null, size: null });
  });
});

test('private detail subtree stays mounted and editor value survives expanding/collapsing; collapsed controls are hidden from accessibility', () => {
  const lifecycle = hooks();
  const native = {
    View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', Modal: 'Modal',
    AccessibilityInfo: {}, findNodeHandle: () => null, Platform: { OS: 'web' },
    useWindowDimensions: () => ({ width: 390, height: 844 }), StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
  };
  const Editor = () => {
    const [draft, setDraft] = lifecycle.runtime.useState('');
    return React.createElement('TextInput', { accessibilityLabel: 'Label ingredient draft', value: draft, onChangeText: setDraft });
  };
  const harness = componentHarness('src/components/check/result-sheet/ResultSheetSurface.tsx', 'ResultSheetSurface', {
    presentationKey: 'one-case', inline: true, summary: React.createElement('Summary'),
    keepDetailsMounted: true, onClose() {}, children: React.createElement(Editor),
  }, { modules: {
    react: lifecycle.runtime, 'react-native': native,
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reanimated': { ReduceMotion: { System: 'system' } },
    '@gorhom/bottom-sheet': { __esModule: true, default: 'BottomSheet', BottomSheetBackdrop: 'BottomSheetBackdrop', BottomSheetScrollView: 'BottomSheetScrollView' },
    '../../ui/Icon': { Icon: 'Icon' },
  } });
  const render = () => { lifecycle.reset(); return harness.render(); };
  let nodes = render();
  const details = () => nodes.find(node => node.type === 'View' && 'importantForAccessibility' in node.props)!;
  assert.deepEqual(details().props.style, { display: 'none' });
  assert.equal(details().props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(details().props.accessibilityElementsHidden, true);
  nodes.find(node => node.type === 'BottomSheet')!.props.onChange(1); nodes = render();
  assert.equal(details().props.style, undefined);
  control(nodes, 'Label ingredient draft').props.onChangeText('Water, glycerin');
  nodes = render();
  nodes.find(node => node.type === 'BottomSheet')!.props.onChange(0); nodes = render();
  assert.equal(control(nodes, 'Label ingredient draft').props.value, 'Water, glycerin');
  assert.equal(details().props.accessibilityElementsHidden, true);
  nodes.find(node => node.type === 'BottomSheet')!.props.onChange(1); nodes = render();
  assert.equal(control(nodes, 'Label ingredient draft').props.value, 'Water, glycerin');
  assert.equal(details().props.importantForAccessibility, 'auto');
});
