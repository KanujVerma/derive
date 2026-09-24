import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const check = read('src/components/check/CheckProductScreen.tsx');
const host = read('src/components/check/capture/CheckCaptureHost.tsx');
const capture = read('src/components/check/capture/ProductEvidenceCapture.tsx');

test('canonical Check opens one host for barcode or a compact package photo path', () => {
  assert.match(check, /<CaptureEntry onOpenCapture=\{openCapture\} onSearchName=\{handleSearchNamePress\}/);
  assert.match(check, /<CheckCaptureHost[\s\S]*initialRole=\{captureRole\}[\s\S]*live=\{integrated\}[\s\S]*onCaptureReady=\{handleCaptureReady\}/);
  assert.equal((check.match(/<CameraView/g) ?? []).length, 1, 'the other camera is legacy member Scan');
  assert.ok(check.indexOf('if (targetShell) {') < check.indexOf('if (permission && !permission.granted)'), 'target entry returns before legacy camera');
});

test('barcode finishes capture without processor review, then Check makes one factual lookup', () => {
  assert.match(host, /autoFinishBarcode/);
  assert.match(capture, /if \(autoFinishBarcode\) \{[\s\S]*?onEvidenceReady\(toCaptureHandoff\(reduceCapture\(createCaptureSession\(\), \{ type: 'barcode', value: data \}\)\)\)/);
  assert.match(check, /if \(handoff\.barcodeLookup\) \{[\s\S]*?openResolution\(\{ consumer: 'scan', barcode: handoff\.barcodeLookup\.barcode \}\);[\s\S]*?return;/);
});

test('photo handoff shows its existing server case and retains K2 result separation', () => {
  assert.match(check, /if \(integrated && handoff\.resolvedCase\) \{[\s\S]*?showResolution\(async \(\) => resolvedCase\)/);
  assert.match(check, /setCandidates\(result\.state === 'ambiguous_candidates' \? result\.candidates : \[\]\)/);
  assert.match(check, /header="Formula Details"/);
  assert.match(check, /<PersonalFitSection state=\{personalFitState\} onPersonalize=\{openPersonalization\}/);
  assert.match(check, /if \(!targetShell && audience !== 'member'\)/);
});

test('unresolved product copy describes evidence limits without implying the owner has no profile', () => {
  const unresolved = check.slice(check.indexOf('if (resolution && !catalogDetail) {'), check.indexOf('if (confirmedProduct && !evaluationError)'));
  assert.match(unresolved, /Personal Fit cannot be assessed/);
  assert.match(unresolved, /We could not identify this product from the photos yet/);
  assert.doesNotMatch(unresolved, /Not personalized yet|profile is missing|answers were not saved/i);
});
