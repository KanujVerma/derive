import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
const searchStart = check.indexOf('if (isSearching) {');
const entryStart = check.indexOf('\n  if (targetShell) {');
const entryEnd = check.indexOf('\n  if (isCheckingProduct)', entryStart);
const search = check.slice(searchStart, check.indexOf('\n  // 3. PERMISSION SCREEN', searchStart));
const entry = check.slice(entryStart, entryEnd);

test('current Check has one plain camera entry and a visible name-search fallback', () => {
  assert.ok(entryStart > 0 && entryEnd > entryStart && searchStart > entryEnd);
  assert.match(entry, /<Button label="Open camera" variant="brand"[^>]*onPress=\{\(\) => \{ abandonProductLink\(\); openCapture\('barcode'\); \}\}/);
  assert.match(entry, /<CatalogProductSearch[\s\S]*label="Search by name"/);
  assert.match(entry, /accessibilityLabel="Product link"/);
  assert.match(entry, /Search by product link/);
  assert.match(entry, /accessibilityLabel="Check link"/);
  assert.match(entry, /preserveSelection[\s\S]*focusKey=\{searchFocusKey\}/);
  assert.match(entry, /onScroll=[\s\S]*entryScrollOffset\.current/);
  assert.match(entry, /<CheckResultPresentation visible=\{!partOneVisible && isCheckFocused/);
  assert.match(entry, /visibleProductLinkState\?\.kind === 'label_candidate'[\s\S]*<Button label="Search by name"/, 'link recovery remains contextual');
  assert.doesNotMatch(entry, /<CaptureEntry|Other ways to identify|Scan barcode/);
});

test('search returns to the same Auto camera host', () => {
  assert.match(search, /label=\{targetShell \? 'Open camera' : 'Use barcode camera'\}/);
  assert.match(search, /if \(targetShell\) openCapture\('barcode'\)/);
  assert.match(check, /<CheckCaptureHost[\s\S]*initialRole=\{captureRole\}/);
});
