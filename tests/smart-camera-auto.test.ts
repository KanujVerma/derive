import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { initialCaptureIntent, shutterPhotoRole, stillPhotoRole, canObserveLiveBarcode, isObservedGtin, isObservedRetailBarcode } from '../src/presentation/capture/autoCapture.ts';
import { createCaptureOperationGate } from '../src/presentation/capture/captureOperationGate.ts';
import { createCaptureSession, reduceCapture } from '../src/presentation/capture/productEvidence.ts';

test('Auto does not guess a photo role; explicit correction supplies only routing', () => {
  assert.equal(stillPhotoRole('auto'), null);
  assert.equal(stillPhotoRole('barcode'), null);
  for (const role of ['front_label', 'ingredients', 'packaging'] as const) assert.equal(stillPhotoRole(role), role);
});
test('the Auto shutter explicitly starts a front-label photo without an extra role tap', () => {
  assert.equal(shutterPhotoRole('auto'), 'front_label');
  assert.equal(shutterPhotoRole('ingredients'), 'ingredients');
  assert.equal(shutterPhotoRole('barcode'), null);
});
test('an ingredients request opens in ingredients mode and captures ingredients evidence', () => {
  const requestedIntent = initialCaptureIntent('ingredients');
  assert.equal(requestedIntent, 'ingredients');
  assert.equal(shutterPhotoRole(requestedIntent), 'ingredients');
  assert.equal(canObserveLiveBarcode(requestedIntent, { busy: false, hasPreview: false, locked: false }), false);
  assert.equal(initialCaptureIntent('front_label'), 'front_label');
  assert.equal(initialCaptureIntent('packaging'), 'packaging');
  assert.equal(initialCaptureIntent('barcode'), 'auto');
  const source = readFileSync(new URL('../src/components/check/capture/ProductEvidenceCapture.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<CaptureIntent>\(\(\) => initialCaptureIntent\(initialRole\)\)/);
  assert.match(source, /setPreviewRole\(shutterPhotoRole\(intent\)\)/);
});
test('continuous barcode signal stops during a photo, preview, or locked result', () => {
  const idle = { busy: false, hasPreview: false, locked: false };
  assert.equal(canObserveLiveBarcode('auto', idle), true);
  assert.equal(canObserveLiveBarcode('barcode', idle), true);
  assert.equal(canObserveLiveBarcode('ingredients', idle), false);
  for (const field of ['busy', 'hasPreview', 'locked'] as const) {
    assert.equal(canObserveLiveBarcode('auto', { ...idle, [field]: true }), false);
  }
});
test('observed barcode validates GTIN lengths and check digit, never arbitrary numeric labels', () => {
  for (const gtin of ['96385074', '036000291452', '4006381333931', '10012345000017']) assert.equal(isObservedGtin(gtin), true, gtin);
  for (const gtin of ['123456789', '036000291453', '12345678901', 'data', ' 96385074']) assert.equal(isObservedGtin(gtin), false);
});
test('observed retail barcode binds the declared symbology and rejects unsupported compressed UPC-E', () => {
  for (const [value, type] of [['96385074', 'ean8'], ['036000291452', 'upc_a'], ['4006381333931', 'ean13']]) {
    assert.equal(isObservedRetailBarcode(value, type), true);
  }
  for (const [value, type] of [['96385074', 'upc_e'], ['96385074', 'ean13'], ['036000291452', 'qr'], ['10012345000017', 'upc_a']]) {
    assert.equal(isObservedRetailBarcode(value, type), false);
  }
});
test('Expo iOS UPC-A normalization retains EAN-13 type with twelve validated digits', () => {
  assert.equal(isObservedRetailBarcode('036000291452', 'ean13'), true);
  assert.equal(isObservedRetailBarcode('0036000291452', 'ean13'), true);
  assert.equal(isObservedRetailBarcode('036000291453', 'ean13'), false);
  assert.equal(isObservedRetailBarcode('03600029145', 'ean13'), false);
  assert.equal(isObservedRetailBarcode('036000291452', 'upc_e'), false);
});
test('a barcode callback cannot finish while the synchronous camera gate is busy', async () => {
  const gate = createCaptureOperationGate();
  let release!: () => void;
  let finishes = 0;
  const pending = gate.run(() => new Promise<void>((resolve) => { release = resolve; }));
  gate.whenIdle(() => finishes++);
  assert.equal(finishes, 0);
  release(); await pending;
  gate.whenIdle(() => finishes++);
  assert.equal(finishes, 1);
});
test('Auto camera remains a local leaf and asks for a part only when the photo role is unknown', () => {
  const source = readFileSync(new URL('../src/components/check/capture/ProductEvidenceCapture.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<CaptureIntent>\(\(\) => initialCaptureIntent\(initialRole\)\)/);
  assert.match(source, /showCorrection && !previewUri && <CameraGlass style=\{styles\.modeMenu\}>/);
  assert.match(source, /\(showCorrection \|\| !previewRole\) && <CameraGlass style=\{styles\.previewMenu\}>/);
  assert.match(source, /Which part is in this photo\?/);
  assert.match(source, /label="Add photo of ingredient list"/);
  assert.match(source, /Automatic photo identification is not available yet\./);
  assert.doesNotMatch(source, /This barcode isn't in the catalog\./);
  assert.match(source, /if \(!hostOwnsResults\) setNotice\(\{ kind: 'status', title: 'Barcode captured'/);
  assert.doesNotMatch(source, /accessibilityLabel="Change part"/);
  assert.doesNotMatch(source, /Photos do not verify the formula/);
  assert.match(source, /setRole\('barcode'\);\n\s*setIntent\('auto'\)/);
  assert.match(source, /previewRole && <Action label=\{session\.evidence\.some\([\s\S]*'Replace photo' : 'Use photo'\}/);
  assert.match(source, /onBarcodeScanned=\{liveBarcode \? onBarcode : undefined\}/);
  assert.doesNotMatch(source, /fetch\(|Gemini|stream.*frames|Ingredient list detected/);
});

test('same-tick barcode then review uses the current evidence, not the previous render', async () => {
  const rendered = reduceCapture(createCaptureSession(), { type: 'photo', role: 'front_label', uri: 'private-photo' });
  const currentSession = { current: rendered };
  const gate = createCaptureOperationGate();
  gate.whenIdle(() => {
    currentSession.current = reduceCapture(currentSession.current, { type: 'barcode', value: '036000291452' });
  });
  await gate.run(async () => {
    const evidence = currentSession.current.evidence;
    currentSession.current = reduceCapture(currentSession.current, { type: 'process' });
    assert.equal(rendered.evidence.length, 1, 'React has not rendered the barcode yet');
    assert.equal(evidence.length, 2);
    assert.equal(evidence[0].value, '036000291452');
    assert.equal(evidence[1].value, 'private-photo');
    gate.whenIdle(() => assert.fail('another barcode cannot interrupt review'));
  });
  const source = readFileSync(new URL('../src/components/check/capture/ProductEvidenceCapture.tsx', import.meta.url), 'utf8');
  const processBody = source.slice(source.indexOf('const processEvidence ='), source.indexOf('const collectMore ='));
  assert.match(processBody, /const evidence = currentSession\.current\.evidence;/);
  assert.doesNotMatch(processBody, /const evidence = session\.evidence;/);
  assert.match(source, /toCaptureHandoff\(currentSession\.current\)/);
});
