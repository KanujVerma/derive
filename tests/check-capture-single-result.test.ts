import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, textContent } from './ux-profile-render.ts';
import type { CaptureHandoff } from '../src/presentation/capture/productEvidence.ts';
function capture(initial: Record<string, unknown>, onEvidenceReady: (handoff: CaptureHandoff) => void) {
  return componentHarness('src/components/check/capture/ProductEvidenceCapture.tsx', 'ProductEvidenceCapture', {
    onClose() {}, onEvidenceReady, hostOwnsResults: true, autoFinishBarcode: true, ...initial,
  }, { modules: {
    '../../ui/Icon': { Icon: 'Icon' },
    'react-native': { View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'View',
      ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' }, PanResponder: { create: () => ({ panHandlers: {} }) },
      LayoutAnimation: { configureNext() {}, Types: { easeInEaseOut: '' }, Properties: { opacity: '' } },
      Keyboard: { dismiss() {} }, Linking: { openSettings() {} }, useWindowDimensions: () => ({ height: 844 }), StyleSheet: { create: (x: any) => x } },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, () => {}] },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-haptics': { notificationAsync: async () => {}, selectionAsync: async () => {}, impactAsync: async () => {},
      NotificationFeedbackType: { Success: 'success' }, ImpactFeedbackStyle: { Light: 'light' } },
  } });
}
test('capture observation hands off once and owns no catalog miss or second result surface', () => {
  const handedOff: CaptureHandoff[] = [];
  const h = capture({}, handoff => handedOff.push(handoff));
  const nodes = h.render(); const barcode = nodes.find(node => node.type === 'CameraView')!.props.onBarcodeScanned;
  barcode({ data: '036000291452', type: 'upc_a' }); barcode({ data: '036000291452', type: 'upc_a' });
  assert.equal(handedOff.length, 1);
  assert.deepEqual(handedOff[0].evidence, [{ kind: 'barcode', role: 'barcode', value: '036000291452' }]);
  assert.doesNotMatch(textContent(h.render()), /No product match|This barcode|No verified match|Product not confirmed/);
});
test('requested photo mode retains the same barcode and useful photos without silently returning to Auto', () => {
  const evidence = [{ role: 'barcode', kind: 'barcode', value: '036000291452' }, { role: 'packaging', kind: 'local_photo', value: 'file:///package.jpg' }];
  const h = capture({ initialRole: 'ingredients', initialEvidence: evidence }, () => {});
  const nodes = h.render(); assert.match(textContent(nodes), /Fill the frame with the ingredient list/);
  assert.ok(nodes.find(node => node.props.accessibilityLabel === 'Take Ingredients photo'));
  assert.ok(nodes.find(node => node.props.accessibilityLabel === 'Packaging photo saved. Tap to view'));
});
test('paused or late barcode events cannot deliver another product result', () => {
  let handoffs = 0;
  const h = capture({}, () => { handoffs++; }); const nodes = h.render();
  const staleCallback = nodes.find(node => node.type === 'CameraView')!.props.onBarcodeScanned;
  const paused = h.render({ detectionPaused: true });
  assert.equal(paused.find(node => node.type === 'CameraView')!.props.onBarcodeScanned, undefined);
  // Current callbacks are removed while paused; the local scan lock also rejects repeated observations after handoff.
  staleCallback({ data: '036000291452', type: 'upc_a' }); staleCallback({ data: '036000291452', type: 'upc_a' });
  assert.equal(handoffs, 0);
});
