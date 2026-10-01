import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const check = read('src/components/check/CheckProductScreen.tsx');
const host = read('src/components/check/capture/CheckCaptureHost.tsx');
const capture = read('src/components/check/capture/ProductEvidenceCapture.tsx');

test('canonical Check opens one Auto host for barcode or package photo', () => {
  assert.match(check, /<Button label="Open camera" variant="brand"[^\n]*onPress=\{\(\) => \{ abandonProductLink\(\); openCapture\('barcode'\); \}\}/);
  assert.match(check, /<CheckCaptureHost[\s\S]*initialRole=\{captureRole\}[\s\S]*live=\{integrated\}[\s\S]*onCaptureReady=\{handleCaptureReady\}/);
  assert.equal((check.match(/<CameraView/g) ?? []).length, 1, 'the other camera is legacy member Scan');
  assert.ok(check.indexOf('if (targetShell) {') < check.indexOf('if (permission && !permission.granted)'), 'target entry returns before legacy camera');
});

test('barcode-only finishes capture while existing photos require reviewed mixed evidence', () => {
  assert.match(host, /autoFinishBarcode/);
  assert.match(capture, /if \(autoFinishBarcode && !currentSession\.current\.evidence\.some\(\(item\) => item\.kind === 'local_photo'\)\) \{[\s\S]*?onEvidenceReady\(toCaptureHandoff\(reduceCapture\(currentSession\.current, \{ type: 'barcode', value: data \}\)\)\)/);
  assert.match(check, /if \(handoff\.barcodeLookup\) \{[\s\S]*?openResolution\(\{ consumer: 'scan', barcode: handoff\.barcodeLookup\.barcode \}\);[\s\S]*?return;/);
});

test('photo handoff shows its existing server case and shares Personal Fit content', () => {
  assert.match(check, /if \(integrated && handoff\.resolvedCase\) \{[\s\S]*?showResolution\(async \(\) => resolvedCase\)/);
  assert.match(check, /setCandidates\(result\.state === 'ambiguous_candidates' \? result\.candidates : \[\]\)/);
  assert.match(check, /contentInput=\{sharedResultInput \?\? undefined\}/);
  assert.match(check, /<CheckResultPresentation[\s\S]*input=\{sharedResultInput\}/);
  assert.match(check, /if \(!targetShell && audience !== 'member'\)/);
});

test('unresolved product copy describes evidence limits without implying the owner has no profile', () => {
  const unresolved = check.slice(check.indexOf('if (resolution && !catalogDetail) {'), check.indexOf('if (confirmedProduct && !evaluationError)'));
  assert.match(unresolved, /Personal Fit cannot be assessed/);
  assert.match(unresolved, /We could not identify this product from the photos yet/);
  assert.doesNotMatch(unresolved, /Not personalized yet|profile is missing|answers were not saved/i);
});
