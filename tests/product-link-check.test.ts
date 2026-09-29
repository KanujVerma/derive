import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProductLinkController } from '../src/presentation/product-links/controller.ts';
import { resolveProductLink } from '../src/services/productLinks.ts';
import { canPublishCheckResult, validateCheckResolution } from '../src/presentation/check/checkMemory.ts';
import { unresolvedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';

const source = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
const linkAction = source.slice(source.indexOf('const checkProductLink'), source.indexOf('const handleResetScan'));
const requestId = '2f2f6f97-f988-4d46-b871-aeb8c2e2aa21';
const url = 'https://world.openbeautyfacts.org/product/036000291452';

test('real Check submits integrated links through the request controller and existing resolution gate', () => {
  assert.match(source, /createProductLinkController\(\{[\s\S]*createRequestId: createCatalogRequestId/);
  assert.match(source, /getCurrentOwner: \(\) => linkOwnerGetterRef\.current\(\)/);
  assert.match(linkAction, /if \(integrated\)/);
  assert.match(linkAction, /await productLinkController\.submit\(\)/);
  assert.match(linkAction, /requestSequence !== resolutionSequenceRef\.current/);
  assert.match(linkAction, /liveCheckOwner !== currentLiveCheckOwner\(\)/);
  assert.ok(linkAction.indexOf('getState().ownerId !== liveCheckOwner') < linkAction.indexOf('productLinkController.setInput(productLink)'), 'old rendered input is rejected before setting a new owner input');
  assert.match(linkAction, /if \(result\.status === 'resolution'\)[\s\S]*await showResolution\(async \(\) => result\.resolution, undefined, result\.barcode\)/);
  assert.ok(linkAction.indexOf('await productLinkController.submit()') < linkAction.indexOf('matchPreviewProductLink'), 'fixture handling is not the live transport');
});

test('the supported URL journey validates the transport payload before Check consumes the same owner-bound case', async () => {
  let calls = 0;
  const controller = createProductLinkController({ createRequestId: () => requestId, getCurrentOwner: () => 'owner',
    transport: (input) => resolveProductLink(input, { functions: { invoke: async (name, options) => {
      calls++;
      assert.equal(name, 'resolve-product-link');
      assert.deepEqual(options.body, { requestId, url });
      return { error: null, data: { status: 'resolution', source: 'open_beauty_facts_url', sourceUrl: url, barcode: '036000291452',
        resolution: { caseId: unresolvedProductTruth.resolutionCaseId, state: 'insufficient_evidence', candidates: [],
          nextAction: 'manual_review', requiresFounderReview: false, truthSnapshot: unresolvedProductTruth } } };
    } } }) });
  controller.setOwner('owner'); controller.setInput(url);
  const result = await controller.submit();
  assert.equal(calls, 1);
  assert.equal(result?.status, 'resolution');
  if (result?.status !== 'resolution') assert.fail('expected a resolver case');
  assert.equal(validateCheckResolution(result.resolution).caseId, unresolvedProductTruth.resolutionCaseId);
  assert.equal(result.resolution.state, 'insufficient_evidence', 'a valid URL alone is not product/formula truth');
  assert.equal(canPublishCheckResult(true, 'owner', 'owner'), true);
  assert.equal(canPublishCheckResult(true, 'owner', 'another-owner'), false);
});

test('Check resets owner/input and abandons links before camera or name search without exposing raw errors', () => {
  assert.match(source, /productLinkController\.setOwner\(liveCheckOwner\);[\s\S]*setProductLink\(''\);[\s\S]*setLinkNote\(null\)/);
  assert.match(source, /const abandonProductLink = \(\) => \{[\s\S]*productLinkController\.reset\(\);[\s\S]*resolutionSequenceRef\.current \+= 1/);
  const reset = source.slice(source.indexOf('const handleResetScan'), source.indexOf('const handleRetryScan'));
  assert.match(reset, /abandonProductLink\(\)/);
  const entry = source.slice(source.indexOf('<Text style={styles.linkLabel}>'), source.indexOf('// 3. PERMISSION SCREEN'));
  assert.match(entry, /productLinkController\.setInput\(value\);[\s\S]*resolutionSequenceRef\.current \+= 1/);
  assert.match(source, /abandonProductLink\(\); openCapture\('barcode'\)/);
  assert.match(source, /abandonProductLink\(\); handleSelectSearchResult\(item\)/);
  assert.doesNotMatch(entry, /\.reason|String\(error\)|error\.message|dangerouslySetInnerHTML/);
});

test('label/recovery/quota remain entry-only outcomes with explicit retry and accessible loading state', () => {
  const entry = source.slice(source.indexOf('<Text style={styles.linkLabel}>'), source.indexOf('// 3. PERMISSION SCREEN'));
  assert.match(entry, /Possible published label:/);
  assert.match(entry, /visibleProductLinkState\.result\.candidate\.title/);
  assert.match(entry, /accessibilityLiveRegion="polite"/);
  assert.match(entry, /visibleProductLinkState\?\.kind === 'loading'/);
  assert.match(source, /<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle=\{\[styles\.entryContent/);
  assert.match(entry, /returnKeyType="go"[\s\S]*onSubmitEditing=\{checkProductLink\}/);
  assert.match(entry, /label="Search by name"/);
  assert.doesNotMatch(linkAction, /evaluateProduct\(|openResolution\(|setConfirmedProduct\(|setCatalogDetail\(/);
  assert.match(linkAction, /getState\(\)\.kind === 'loading'\) return/);
  assert.doesNotMatch(linkAction, /setTimeout|setInterval/);
});
