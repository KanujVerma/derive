import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const host = read('src/components/check/capture/CheckCaptureHost.tsx');
const capture = read('src/components/check/capture/ProductEvidenceCapture.tsx');

// Boundary guards, not pixel/device acceptance. Physical QA is recorded separately.
test('capture is presented above the tab navigator with a fresh native safe-area boundary', () => {
  assert.match(host, /<Modal[\s\S]*presentationStyle="fullScreen"[\s\S]*onRequestClose=\{onClose\}/);
  assert.match(host, /<SafeAreaProvider>[\s\S]*<ProductEvidenceCapture[\s\S]*<\/SafeAreaProvider>[\s\S]*<\/Modal>/);
  assert.match(host, /processor=\{bridge\.processor\}/);
  assert.match(host, /onCaptureReady\(bridge\.handoff\(handoff\)\)/);
});

test('capture options scroll independently of the shutter and expose all roles', () => {
  const collecting = capture.slice(capture.indexOf('<View style={styles.collecting}>'), capture.indexOf('<View style={[styles.outcomeWrap'));
  assert.match(collecting, /<ScrollView style=\{styles\.controlScroll\}/);
  assert.ok(collecting.indexOf('</ScrollView>') < collecting.indexOf('<View style={styles.captureActions}>'));
  assert.doesNotMatch(collecting, /<ScrollView horizontal/);
  assert.match(capture, /roleRow: \{[^\n]*flexDirection: 'column'/);
  assert.match(capture, /accessibilityState=\{\{ selected: previewUri \? previewRole === item : intent === item, disabled: busy \}\}/);
  assert.match(capture, /paddingBottom: Math\.max\(insets\.bottom, spacing\.md\)/);
});

test('barcode guide is visual-only and the camera/shutter retain existing safety controls', () => {
  assert.match(capture, /pointerEvents="none" style=\{styles\.guideArea\}/);
  assert.match(capture, /\(intent === 'auto' \|\| intent === 'barcode'\) && !currentEvidence && !previewUri/);
  assert.match(capture, /testID="barcode-alignment-guide"/);
  assert.match(capture, /onBarcodeScanned=\{intent === 'auto' \|\| intent === 'barcode' \? onBarcode : undefined\}/);
  assert.match(capture, /accessibilityState=\{\{ disabled: busy, busy \}\}/);
  assert.match(capture, /disabled=\{busy\} onPress=\{\(\) => void capturePhoto\(\)\}/);
  assert.match(capture, /operations\.cancel\(\)/);
});
