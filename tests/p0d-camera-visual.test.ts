import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const capture = readFileSync(new URL('../src/components/check/capture/ProductEvidenceCapture.tsx', import.meta.url), 'utf8');

test('live camera uses borderless Mineral top circles and a current-mode pill beside the shutter', () => {
  assert.match(capture, /<CameraView[\s\S]*style=\{StyleSheet\.absoluteFill\}/);
  assert.match(capture, /<CameraGlass style=\{styles\.topControl\}/);
  assert.match(capture, /<CameraGlass style=\{styles\.selectorPill\}>/);
  assert.match(capture, /accessibilityLabel=\{`Capture options, \$\{intent === 'auto' \? 'Auto' : roleLabels\[role\]\}`\}/);
  assert.match(capture, /\{intent === 'auto' \? 'Auto' : roleLabels\[role\]\}/);
  assert.match(capture, /backgroundColor: 'rgba\(30,54,44,0\.72\)'/);
  assert.match(capture, /cameraGlass: \{[^\n]*borderWidth: 0/);
  assert.match(capture, /<BlurView intensity=\{35\} tint="dark" style=\{StyleSheet\.absoluteFill\}/);
  assert.doesNotMatch(capture, /<CameraGlass style=\{styles\.panel\}/);
  assert.doesNotMatch(capture, /<Text style=\{styles\.prompt\}>Point at a barcode or package<\/Text>/);
  assert.doesNotMatch(capture, /<GlassContainer/);
  assert.doesNotMatch(capture, /<Text style=\{styles\.topTitle\}>Capture product<\/Text>/);
  assert.doesNotMatch(capture, /backgroundColor: 'rgba\(23,26,24,0\.94\)'/);
});

test('auto barcode guide uses four corners without implying verified identity', () => {
  assert.match(capture, /testID="barcode-alignment-guide"/);
  assert.match(capture, /styles\.guideTopLeft/);
  assert.match(capture, /styles\.guideTopRight/);
  assert.match(capture, /styles\.guideBottomLeft/);
  assert.match(capture, /styles\.guideBottomRight/);
  assert.match(capture, /guideCorner: \{[^\n]*width: 38, height: 38[^\n]*\}/);
  assert.match(capture, /guideTopLeft: \{[^\n]*borderTopLeftRadius: radii\.xs/);
  assert.doesNotMatch(capture, /guideCorner: \{[^\n]*borderRadius:/);
  assert.match(capture, /Alignment aid only: Expo still detects barcodes across the whole preview/);
  assert.match(capture, /Photos do not verify the formula/);
});

test('capture and recovery controls stay accessible and scroll clear of the footer', () => {
  assert.match(capture, /minWidth: layout\.minTouchTarget, minHeight: layout\.minTouchTarget/);
  assert.match(capture, /<ScrollView style=\{styles\.controlScroll\}/);
  assert.match(capture, /paddingBottom: Math\.max\(insets\.bottom, spacing\.md\)/);
  for (const label of ['Capture options', 'Retake', 'Use photo', 'Check product']) {
    assert.ok(capture.includes(label), `missing ${label}`);
  }
});

test('default Auto keeps one visible shutter while the five modes open in a compact vertical popover', () => {
  assert.match(capture, /\(showCorrection \|\| \(previewUri && !previewRole\)\) && <CameraGlass style=\{styles\.modeMenu\}>/);
  assert.match(capture, /accessibilityLabel="Change part"/);
  assert.match(capture, /roleRow: \{[^\n]*flexDirection: 'column'/);
  assert.match(capture, /roleChip: \{[^\n]*minHeight: layout\.minTouchTarget/);
  assert.match(capture, /selected && <Icon name="check"/);
  assert.match(capture, /!previewUri && !currentEvidence && <View style=\{\[styles\.selectorSlot/);
  assert.match(capture, /LayoutAnimation\.configureNext\(\{ duration: 180/);
  assert.match(capture, /intent !== 'auto' && <CameraGlass style=\{styles\.guidancePill\}>/);
  assert.match(capture, /session\.evidence\.length > 0 && <Action label="Check product"/);
  assert.doesNotMatch(capture, /<View style=\{styles\.panel\}>/);
});

test('photo shutter keeps a high-contrast ivory ring around the mineral center', () => {
  assert.match(capture, /shutter: \{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors\.inkInverse/);
  assert.match(capture, /shutterInner: \{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors\.brand/);
});
