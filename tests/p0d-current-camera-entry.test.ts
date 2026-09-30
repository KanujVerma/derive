import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
const searchStart = check.indexOf('if (isSearching) {');
const entryStart = check.indexOf('\n  if (targetShell) {', searchStart);
const entryEnd = check.indexOf('\n  // 3. PERMISSION SCREEN', entryStart);
const search = check.slice(searchStart, entryStart);
const entry = check.slice(entryStart, entryEnd);

test('current Check has one plain camera entry and a visible name-search fallback', () => {
  assert.ok(searchStart > 0 && entryStart > searchStart && entryEnd > entryStart);
  assert.match(entry, /<Button label="Open camera" variant="brand"[^\n]*onPress=\{\(\) => \{ abandonProductLink\(\); openCapture\('barcode'\); \}\}/);
  assert.match(entry, /<CatalogProductSearch[\s\S]*label="Search by name"/);
  assert.match(entry, /accessibilityLabel="Product link"/);
  assert.match(entry, /Search by product link/);
  assert.match(entry, /accessibilityLabel="Check link"/);
  assert.match(entry, /visibleProductLinkState\?\.kind === 'label_candidate'[\s\S]*<Button label="Search by name"/, 'name-search button is contextual recovery, not a duplicate default entry action');
  assert.doesNotMatch(entry, /<CaptureEntry|Other ways to identify|Scan barcode/);
});

test('search returns to the same Auto camera host', () => {
  assert.match(search, /label=\{targetShell \? 'Open camera' : 'Use barcode camera'\}/);
  assert.match(search, /if \(targetShell\) openCapture\('barcode'\)/);
  assert.match(check, /<CheckCaptureHost[\s\S]*initialRole=\{captureRole\}/);
});
