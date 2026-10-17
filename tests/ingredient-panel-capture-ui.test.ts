import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import type { CatalogProductSummary } from '../src/contracts/ProductCatalog.ts';

function button(nodes: ReturnType<ReturnType<typeof componentHarness>['render']>, label: string) {
  const contains = (value: any): boolean => value === label || (Array.isArray(value) ? value.some(contains) : Boolean(value && typeof value === 'object' && contains(value.props?.children)));
  const node = nodes.find(node => node.type === 'Pressable' && (node.props.accessibilityLabel === label || contains(node.props.children)));
  assert.ok(node, `Missing button: ${label}`); return node;
}
async function check(node: ReturnType<typeof button>) { node.props.onPress(); await new Promise<void>(resolve => setImmediate(resolve)); }

function setup() {
  let calls = 0, deliveries = 0, links = 0, closes = 0;
  const bridge = createCheckCaptureBridge({ async process() { calls++; return { state: 'insufficient_evidence', candidates: [], ingredientPanelFailure: 'unreadable' }; } });
  const h = componentHarness('src/components/check/capture/ProductEvidenceCapture.tsx', 'ProductEvidenceCapture', {
    onClose() { closes++; }, onEvidenceReady() { deliveries++; }, onProductLink() { links++; }, onCatalogSelect() {},
    catalogSearch: async () => [], hostOwnsResults: true, initialRole: 'ingredients', initialEvidence: [{ kind: 'local_photo', role: 'ingredients', value: 'file:///first.jpg' }],
    photoCaptureEnabled: true, processor: bridge.processor, ingredientPanels: bridge.ingredientPanels,
  }, { modules: {
    '../../ui/Icon': { Icon: 'Icon' },
    'expo-haptics': { impactAsync: async () => {}, notificationAsync: async () => {}, selectionAsync: async () => {},
      ImpactFeedbackStyle: { Light: 'Light' }, NotificationFeedbackType: { Success: 'Success', Error: 'Error' } },
    '../../catalog/CatalogProductSearch': { CatalogProductSearch: 'CatalogProductSearch' },
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'View',
      ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' }, PanResponder: { create: () => ({ panHandlers: {} }) },
      LayoutAnimation: { configureNext() {}, Types: { easeInEaseOut: '' }, Properties: { opacity: '' } },
      Keyboard: { dismiss() {} }, Linking: { openSettings() {} }, useWindowDimensions: () => ({ height: 844 }), StyleSheet: { create: (x: unknown) => x } },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, () => {}] },
    'expo-blur': { BlurView: 'BlurView' },
  } });
  return { h, bridge, calls: () => calls, deliveries: () => deliveries, links: () => links, closes: () => closes };
}

test('first failed panel offers one observed-reason guided retake without an incomplete verdict or human review', async () => {
  const s = setup(); const staleCheck = button(s.h.render(), 'Check product');
  await check(staleCheck);
  const nodes = s.h.render();
  assert.match(textContent(nodes), /not readable.*focus.*glare/i);
  assert.ok(button(nodes, 'Retake ingredient panel'));
  assert.equal(nodes.some(node => node.props.accessibilityLabel === 'Check product'), false);
  assert.doesNotMatch(textContent(nodes), /human review|founder|safe to use|compatibility|incomplete formula verdict/i);
  assert.equal(s.deliveries(), 0);
  press(button(nodes, 'Retake ingredient panel'));
  assert.ok(button(s.h.render(), 'Take Ingredients photo'));
  assert.equal(s.bridge.ingredientPanels.getState().attempts, 1);
});

test('second failure removes capture/retry controls and stale handlers cannot dispatch a third panel', async () => {
  const s = setup(); const oldCheck = button(s.h.render(), 'Check product');
  await check(oldCheck);
  await assert.rejects(s.bridge.processor.process([{ kind: 'local_photo', role: 'ingredients', value: 'file:///second.jpg' }]));
  let nodes = s.h.render();
  assert.ok(button(nodes, 'Use product link')); assert.ok(button(nodes, 'Search verified catalog')); assert.ok(button(nodes, 'Retry later'));
  assert.equal(nodes.some(node => node.type === 'CameraView'), false);
  assert.doesNotMatch(textContent(nodes), /Retake ingredient panel|Check product|Try review again|Continue with evidence/);
  await check(oldCheck);
  assert.equal(s.calls(), 2); assert.equal(s.deliveries(), 0);
  press(button(nodes, 'Use product link')); assert.equal(s.links(), 1);
  nodes = s.h.render(); press(button(nodes, 'Retry later')); assert.equal(s.closes(), 1);
});

test('fallback search shortlists verified catalog formulas and still asks for the exact variant', async () => {
  const s = setup();
  await assert.rejects(s.bridge.processor.process([{ kind: 'local_photo', role: 'ingredients', value: 'file:///a.jpg' }]));
  await assert.rejects(s.bridge.processor.process([{ kind: 'local_photo', role: 'ingredients', value: 'file:///b.jpg' }]));
  const base: CatalogProductSummary = { productId: 'verified', brand: 'Synthetic', name: 'Fixture', category: 'other', imageUrl: null,
    isCatalogStandard: true, variantCount: 1, formulaState: 'verified_variant_available' };
  s.h.render({ catalogSearch: async () => [base, { ...base, productId: 'guess', formulaState: 'unverified' }] });
  press(button(s.h.render(), 'Search verified catalog'));
  const nodes = s.h.render(); const search = nodes.find(node => node.type === 'CatalogProductSearch')!;
  assert.ok(search); assert.deepEqual(await search.props.search('Synthetic'), [base]);
  assert.match(textContent(nodes), /exact.*variant|exact.*size/i);
  assert.equal(s.bridge.ingredientPanels.getState().attempts, 2);
});
