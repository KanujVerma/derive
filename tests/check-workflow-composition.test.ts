import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import type { CatalogProductSummary } from '../src/contracts/ProductCatalog.ts';
import type { ScanRequest, ScanResult } from '../src/contracts/PartOne.ts';
import type { PartOneTransport } from '../src/presentation/part-one/resultController.ts';
import { createCatalogSearchController } from '../src/presentation/catalog/searchController.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const candidate: CatalogProductSummary = {
  productId: id(100), brand: 'Synthetic public source', name: 'Synthetic cleanser', category: '236 ml',
  imageUrl: null, isCatalogStandard: true, variantCount: 1, formulaState: 'unverified',
  sourceLookup: { barcode: '3337875597197', provider: 'open_facts', variantText: '236 ml',
    sourceUrl: 'https://world.openbeautyfacts.org/product/3337875597197', observedAt: '2026-10-03T00:00:00Z',
    expiresAt: '2099-01-01T00:00:00Z', policyVersion: 'synthetic-test-only' },
};
function result(request: ScanRequest): ScanResult {
  return { schemaVersion: 1, requestId: request.requestId, scanId: request.clientScanId,
    generation: request.generation, resultRevision: 1, identity: 'exact', itemId: candidate.productId,
    candidateIds: [], snapshotId: id(101), declarationId: null, declarationState: 'none', scope: 'public',
    packageConfirmation: 'unconfirmed', work: 'complete', jobId: id(102), subscriptionId: id(103), nextCheckAfter: null,
    display: { resultRevision: 1, selectedIdentity: { id: candidate.productId, name: candidate.name,
      brand: candidate.brand, variantText: '236 ml', expiresAt: '2099-01-01T00:00:00Z', image: null },
      candidates: [], sections: [], sources: [], limitations: ['Synthetic source response; package and formula unconfirmed.'] },
    reasonCodes: ['ingredients_missing'], conflictIds: [], evidenceIds: [], allowedActions: ['save_partial', 'rescan'],
    freshness: { observedAt: '2026-10-03T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', state: 'fresh' } };
}
const settle = async () => { for (let n = 0; n < 6; n++) await Promise.resolve(); };

/** Real Check/controller and catalog handlers, inert native hosts, synthetic transport only.
 * These tests establish client composition, never provider coverage or live lookup. */
function integration(captureEnabled = false, readScan?: PartOneTransport['read']) {
  const auth = { sessionUserId: id(1), status: 'SIGNED_IN' };
  const access = { status: 'READY', userId: id(1), access: { userId: id(1) } };
  function store(state: object) {
    const listeners = new Set<() => void>();
    return Object.assign((select: (value: any) => unknown) => select(state), {
      getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
      emit: () => { for (const listener of listeners) listener(); },
    });
  }
  const authStore = store(auth), accessStore = store(access);
  const scans: { request: ScanRequest; resolve: (response: ScanResult) => void; reject: (error: Error) => void }[] = [];
  const names: string[] = [], released: string[] = [];
  const forbidden = () => { throw Error('Unexpected legacy, model, or private network operation'); };
  const transport: PartOneTransport = {
    scan: request => new Promise((resolve, reject) => { scans.push({ request, resolve, reject }); }),
    read: readScan ?? (async () => { throw Error('No automatic read expected in a bounded composition test'); }),
    subscribe: forbidden, unsubscribe: async subscription => { released.push(subscription); },
    select: forbidden, save: forbidden, capture: async (scanId, generation) => ({ schemaVersion: 1, captureSessionId: id(400), packageObservationId: id(401), scanId, generation, captureRevision: 0, deletionEpoch: 0, itemId: candidate.productId, candidateId: null }),
  };
  let sequence = 200, focus: (() => (() => void)) | undefined, cleanupFocus: (() => void) | undefined;
  let keyboardDismissals = 0;
  const customerState = { ownerId: null, status: 'idle', context: null, decision: { kind: 'idle' } };
  const modules: Record<string, any> = {
    'expo-router': { useRouter: () => ({ push: forbidden }), useLocalSearchParams: () => ({}),
      // Native navigation focus is driven explicitly; only Check's first focus subscription owns sheet visibility.
      useFocusEffect: (effect: () => (() => void)) => { focus ??= effect; } },
    '@gorhom/bottom-sheet': { BottomSheetTextInput: 'BottomSheetTextInput' },
    'expo-camera': { useCameraPermissions: () => [{ granted: true }, forbidden] },
    '@/src/config/environment': { publicEnvironment: { buildFlavor: 'development', supabaseUrl: 'http://127.0.0.1:59631' } },
    '@/src/services/DeriveService': { isRemoteServiceEnabled: () => true },
    '@/src/stores/authStore': { useAuthStore: authStore }, '@/src/stores/freeAccessStore': { useFreeAccessStore: accessStore },
    '@/src/stores/routineStore': { useRoutineStore: () => ({ routine: [], userProducts: [], checkIns: [] }) },
    '@/src/stores/onboardingStore': { useOnboardingStore: () => ({ productReactions: [] }) },
    '@/src/stores/scanContextStore': { useScanContextStore: { getState: forbidden } },
    '@/src/services/productCatalog': { createCatalogRequestId: () => id(sequence++), searchCatalogProducts: forbidden,
      getCatalogProductDetail: forbidden, resolveCatalogIdentity: forbidden },
    '@/src/services/partOne': { PART_ONE_ENABLED: true, partOneTransport: transport,
      searchPartOneProducts: async (query: string) => { names.push(query); return [candidate]; } },
    '@/src/services/partOnePrivate': { PART_ONE_PRIVATE_ENABLED: false, partOnePrivateTransport: {} },
    '../../../modules/derive-label-ocr': { preparePrivateLabelUpload: forbidden },
    '@/src/presentation/capture/liveFreeEvidenceProcessor': { createLiveIngredientContinuationProcessor: forbidden },
    '@/src/services/deriveClient': { evaluateProduct: forbidden },
    '@/src/services/remote/freeContext': { recordFreeCheck: forbidden },
    '@/src/services/supabase': { supabase: {} },
    '@/src/services/productLinks': { resolveProductLink: forbidden, ProductLinkError: Error },
    '@/src/services/analytics': { analytics: { track() {} } },
    '@/src/commerce/useShopAudience': { useShopAudience: () => 'non_member' },
    '@/src/presentation/personalization/gateway': { personalizationGateway: {}, resolvePersonalizationOwnerId: () => null },
    '@/src/presentation/personal-decision/customerGateway': { currentCustomerOwner: () => auth.sessionUserId,
      customerController: { subscribe: () => () => {}, getState: () => customerState, setOwner() {}, setOriginSnapshot() {} },
      ownerPinnedLegacyGateway: {} },
    '@/src/presentation/personal-decision/customerController': { selectVisibleCustomerDecision: () => null,
      describeCanonicalMyStuff: () => ({ kind: 'unavailable' }), canShowLegacyPersonalFit: () => false },
    '@/src/components/check/part-one/PartOneLabelCapture': { PART_ONE_LOCAL_CAPTURE_AVAILABLE: captureEnabled, purgeLocalCaptureFile() {}, PartOneLabelCapture: 'PartOneLabelCapture' },
    './PartOneLabelCapture': { PartOneLabelCapture: 'PartOneLabelCapture' },
    '@/src/components/catalog/CatalogProductSearch': { CatalogProductSearch: 'CatalogProductSearch' },
    '@/src/components/check/capture/CheckCaptureHost': { CheckCaptureHost: 'CheckCaptureHost' },
    '@/src/components/check/part-one/PartOneResultSheet': { PartOneResultSheet: (props: any) => React.createElement('PartOneResultSheet', props, props.captureContent) },
    '@/src/components/check/result-sheet/ScanResultSheet': { ScanResultSheet: 'ScanResultSheet' },
    '@/src/components/check/result-sheet/CheckResultPresentation': { CheckResultPresentation: 'CheckResultPresentation' },
    '@/src/components/check/contribution/MissingProductContribution': { MissingProductContribution: 'MissingProductContribution' },
    '@/src/components/account/AccountSettingsButton': { AccountSettingsButton: 'AccountSettingsButton' },
    '@/src/components/shell/RootShellHeader': { RootShellHeader: 'RootShellHeader' },
    '@/src/components/my-stuff/MyStuffContent': { MyStuffContent: 'MyStuffContent' },
    '@/src/presentation/my-stuff/myStuffRemote': { myStuffStore: {} },
    zustand: { useStore: (_store: unknown, select: (state: any) => unknown) => select({ ownerId: null, status: 'idle', model: null, error: null, cursors: {}, loadingMore: false }) },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
      Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      Keyboard: { dismiss() { keyboardDismissals++; } }, Linking: {}, StyleSheet: { create: (value: unknown) => value } },
  };
  const flow = componentHarness('src/components/check/CheckProductScreen.tsx', 'default', {}, { modules, effects: true });
  flow.render(); cleanupFocus = focus!(); flow.render();
  const render = () => flow.render();
  const search = () => render().find(node => node.type === 'CatalogProductSearch')!;
  const sheet = () => render().find(node => node.type === 'PartOneResultSheet');
  const catalog = () => componentHarness('src/components/catalog/CatalogProductSearch.tsx', 'CatalogProductSearch', search().props,
    { modules: { '../../services/productCatalog': { searchCatalogProducts: forbidden }, '../ui/Icon': { Icon: 'Icon' } } });
  return { flow, render, search, sheet, catalog, scans, names, released, keyboardDismissals: () => keyboardDismissals,
    blur() { cleanupFocus?.(); }, focus() { cleanupFocus = focus!(); },
    switchOwner(owner: string) { auth.sessionUserId = owner; access.userId = owner; access.access.userId = owner; authStore.emit(); accessStore.emit(); render(); render(); },
  };
}

test('normal Part 1 Check explicitly searches names, resolves selected barcode in one sheet and restores retained query on close', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  const catalog = f.catalog(); t.after(() => catalog.dispose());
  control(catalog.render(), 'Search catalog products').props.onChangeText('Synthetic');
  assert.deepEqual(f.names, []); assert.equal(f.scans.length, 0);
  await f.search().props.controller.submit();
  assert.deepEqual(f.names, ['Synthetic']);
  press(control(catalog.render(), `Check ${candidate.brand} ${candidate.name} · 236 ml`));
  assert.equal(f.scans.length, 1); assert.equal(f.scans[0].request.code.raw, candidate.sourceLookup!.barcode);
  assert.equal(f.sheet()!.props.view.loading, true); assert.equal(f.sheet()!.props.inline, false);
  f.scans[0].resolve(result(f.scans[0].request)); await settle();
  const nodes = f.render(); assert.equal(nodes.filter(node => node.type === 'PartOneResultSheet').length, 1);
  assert.equal(nodes.find(node => node.type === 'CheckResultPresentation')!.props.visible, false);
  assert.equal(f.sheet()!.props.view.result.packageConfirmation, 'unconfirmed');
  assert.equal(f.sheet()!.props.view.result.declarationState, 'none');
  const focusKey = f.search().props.focusKey; f.sheet()!.props.onClose();
  assert.equal(f.sheet(), undefined); assert.equal(f.search().props.controller.getState().query, 'Synthetic');
  assert.equal(f.search().props.focusKey, focusKey + 1); assert.deepEqual(f.released, [id(103)]);
  assert(f.keyboardDismissals() > 0);
});

test('typed barcode dispatches Part 1 immediately without name lookup, and close fences a late response', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  const catalog = f.catalog(); t.after(() => catalog.dispose());
  const input = control(catalog.render(), 'Search catalog products');
  input.props.onChangeText('3337875597197'); input.props.onSubmitEditing();
  assert.deepEqual(f.names, []); assert.equal(f.scans.length, 1); assert.equal(f.sheet()!.props.view.loading, true);
  assert.equal(f.scans[0].request.code.namespace, 'gtin'); assert.equal(f.scans[0].request.requestedMarket, null);
  f.sheet()!.props.onClose(); f.scans[0].resolve(result(f.scans[0].request)); await settle();
  assert.equal(f.sheet(), undefined); assert.equal(f.search().props.controller.getState().query, '3337875597197');
});

test('unfocused Check hides pending and completed Part 1 results, then restores the retained result on focus', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  f.search().props.onSelect(candidate); assert.equal(f.sheet()!.props.view.loading, true);
  f.blur(); assert.equal(f.sheet(), undefined);
  f.scans[0].resolve(result(f.scans[0].request)); await settle(); assert.equal(f.sheet(), undefined);
  assert.equal(f.render().find(node => node.type === 'CheckResultPresentation')!.props.visible, false);
  f.focus(); assert.equal(f.sheet()!.props.view.result.display.selectedIdentity.name, candidate.name);
  assert.equal(f.scans.length, 1);
});

test('owner change rejects an old pending result, and a fresh owner can independently check the same public product', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  f.search().props.onSelect(candidate); const old = f.scans[0];
  f.switchOwner(id(2)); old.resolve(result(old.request)); await settle(); assert.equal(f.sheet(), undefined);
  f.search().props.onSelect(candidate); assert.equal(f.sheet()!.props.view.owner, id(2));
  f.scans[1].resolve(result(f.scans[1].request)); await settle();
  assert.equal(f.sheet()!.props.view.owner, id(2)); assert.equal(f.sheet()!.props.view.result.requestId, f.scans[1].request.requestId);
});

test('initial transport failure retries the same request and a newer check rejects the earlier request completion', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  f.search().props.onSelect(candidate); f.scans[0].reject(Error('Synthetic transport failure')); await settle();
  assert.match(f.sheet()!.props.view.error, /unavailable/);
  f.sheet()!.props.onRefresh(); assert.deepEqual(f.scans[1].request, f.scans[0].request);
  f.search().props.onSelect({ ...candidate, sourceLookup: { ...candidate.sourceLookup!, barcode: '4006381333931' } });
  f.scans[1].resolve(result(f.scans[1].request)); await settle(); assert.equal(f.sheet()!.props.view.result, null);
  f.scans[2].resolve(result(f.scans[2].request)); await settle();
  assert.equal(f.sheet()!.props.view.result.requestId, f.scans[2].request.requestId); assert.equal(f.sheet()!.props.view.error, null);
});

test('public catalog rows expire while idle, reject a stale tap and require explicit refresh; failed images have a placeholder', async t => {
  let clock = Date.parse('2026-10-03T00:00:00Z'), searches = 0, selections = 0;
  const originalNow = Date.now; Date.now = () => clock; t.after(() => { Date.now = originalNow; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const imageUrl = 'https://images.openbeautyfacts.org/images/products/333/787/559/7197/front_en.5.400.jpg';
  const row = { ...candidate, imageUrl, sourceLookup: { ...candidate.sourceLookup!, expiresAt: '2026-10-03T00:00:01Z' } };
  const controller = createCatalogSearchController(async () => { searches++; return [row]; }, () => {}, { automatic: false });
  t.after(() => controller.dispose()); controller.setQuery('Synthetic'); await controller.submit();
  const catalog = componentHarness('src/components/catalog/CatalogProductSearch.tsx', 'CatalogProductSearch', {
    controller, preserveSelection: true, onSelect: () => { selections++; },
  }, { effects: true, modules: { '../../services/productCatalog': { searchCatalogProducts: async () => [] } } });
  t.after(() => catalog.dispose());
  let nodes = catalog.render(); const staleRow = control(nodes, `Add ${candidate.brand} ${candidate.name} · 236 ml`);
  const image = nodes.find(node => node.props.source?.uri === imageUrl)!; assert(image);
  image.props.onError(); nodes = catalog.render(); assert(!nodes.some(node => node.props.source?.uri === imageUrl));
  assert(control(nodes, 'No product image available'));
  clock += 1001; t.mock.timers.tick(1001); nodes = catalog.render();
  assert(!textContent(nodes).includes(candidate.name)); assert(!nodes.some(node => node.props.source?.uri === imageUrl));
  assert.match(textContent(nodes), /source results expired/); assert.equal(searches, 1);
  press(staleRow); assert.equal(selections, 0); assert.equal(searches, 1);
  press(control(nodes, 'Resume product search')); await settle(); assert.equal(searches, 2);
});

test('actual Part 1 sheet starts its canonical P2 read while collapsed and reveals source only through disclosure', t => {
  let expanded = false, reads = 0;
  const transport = { normalize: async () => { reads++; return new Promise<unknown>(() => {}); } };
  const scan = result({ schemaVersion: 1, requestId: id(300), clientScanId: id(301), idempotencyKey: 'synthetic', generation: 0,
    code: { raw: '3337875597197', symbology: null, namespace: 'gtin', retailerId: null }, requestedMarket: null, categoryHint: null });
  scan.display.sources = [{ observationId: id(302), policyId: id(303), label: 'Synthetic source attribution',
    url: 'https://world.openbeautyfacts.org/product/3337875597197', observedAt: '2026-10-03T00:00:00Z',
    sourceUpdatedAt: null, expiresAt: '2099-01-01T00:00:00Z' }];
  const sheet = componentHarness('src/components/check/part-one/PartOneResultSheet.tsx', 'PartOneResultSheet', {
    view: { owner: id(1), result: scan, loading: false, error: null, saved: false, scrollOffset: 0 },
    ingredientEnabled: true, ingredientTransport: transport,
    onClose() {}, onRefresh() {}, onSelect() {}, onSave() {}, onSearch() {}, onFullChange() {},
  }, { effects: true, modules: {
    '../../ui/Button': { Button: 'Button' },
    '../../../services/productCatalog': { createCatalogRequestId: () => id(304) },
    '../../../services/partTwo': { PART_TWO_ENABLED: true, partTwoTransport: transport },
    '../result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => React.createElement('Surface', props,
      props.summary, props.compactActions, expanded ? props.children : undefined) },
  } });
  t.after(() => sheet.dispose());
  let nodes = sheet.render(); assert.equal(reads, 1); assert.match(textContent(nodes), /Not enough information/);
  assert(textContent(nodes).includes(candidate.name)); assert(!textContent(nodes).includes('Synthetic source attribution'));
  assert(!nodes.some(node => node.props.accessibilityLabel === 'Source'));
  expanded = true; nodes = sheet.render(); assert(control(nodes, 'Source'));
  assert(!textContent(nodes).includes('Synthetic source attribution'));
  press(control(nodes, 'Source')); assert(textContent(sheet.render()).includes('Synthetic source attribution'));
  assert.equal(reads, 1);
});

test('normal entry result opens supported ingredient capture and returns to the same retained product', async t => {
 const f = integration(true); t.after(() => f.flow.dispose());
 f.search().props.onSelect(candidate); f.scans[0].resolve(result(f.scans[0].request)); await settle();
 const original = f.sheet()!.props.view.result;
 assert.equal(f.sheet()!.props.inline, false); assert.equal(typeof f.sheet()!.props.onCapture, 'function');
 f.sheet()!.props.onCapture(); await settle();
 let capture = f.render().find(node => node.type === 'PartOneLabelCapture');
 assert(capture, 'entry-origin capture must render visibly through the actual active-capture boundary');
 assert.equal(f.sheet()!.props.captureContent.props.open, true, 'capture is hosted by the retained result presentation');
 assert.equal(f.render().filter(node => node.type === 'PartOneLabelCapture').length, 1);
 assert.equal(capture.props.binding.scanId, original.scanId); assert.equal(capture.props.binding.itemId, original.itemId);
 assert.equal(capture.props.productLabel, 'Synthetic public source Synthetic cleanser 236 ml');
 const binding = capture.props.binding;
 const draft = capture.props.draft;
 assert.notEqual(draft.addPhoto(binding, id(402), 'file:///synthetic-managed-capture.img'), 'cap_reached');
 capture.props.onClose(); assert(!f.render().some(node => node.type === 'PartOneLabelCapture'));
 assert.equal(f.sheet()!.props.view.result.scanId, original.scanId);
 f.sheet()!.props.onCapture(); await settle(); capture = f.render().find(node => node.type === 'PartOneLabelCapture');
 assert(capture, 'review can reopen the retained memory draft');
 assert.equal(capture.props.binding.captureSessionId, id(400)); assert.deepEqual(capture.props.binding, binding);
 assert.equal(capture.props.draft, draft); assert.equal(draft.read(binding).shots[0].uri, 'file:///synthetic-managed-capture.img');
 f.blur(); assert(!f.render().some(node => node.type === 'PartOneLabelCapture'), 'capture cannot outlive current result visibility');
 f.focus(); assert(f.render().some(node => node.type === 'PartOneLabelCapture'));
});

test('replacement search cancellation restores the retained result and capture draft', async t => {
 const f=integration(true);t.after(()=>f.flow.dispose());
 f.search().props.onSelect(candidate);f.scans[0].resolve(result(f.scans[0].request));await settle();
 const original=f.sheet()!.props.view.result;f.sheet()!.props.onCapture();await settle();
 const capture=f.render().find(node=>node.type==='PartOneLabelCapture')!;const binding=capture.props.binding;capture.props.onClose();
 f.sheet()!.props.onSearch();assert(f.sheet()!.props.searchContent);
 f.sheet()!.props.onClose();assert.equal(f.sheet()!.props.searchContent,undefined);assert.equal(f.sheet()!.props.view.result.scanId,original.scanId);
 f.sheet()!.props.onCapture();await settle();assert.deepEqual(f.render().find(node=>node.type==='PartOneLabelCapture')!.props.binding,binding);
});

test('actual Check observes queued worker completion after one second and retains completed polling cadence', async t => {
 t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse('2026-10-03T00:00:00Z') });
 let reads = 0, completed!: ScanResult;
 const f = integration(false, async () => { reads++; return completed; }); t.after(() => f.flow.dispose());
 f.search().props.onSelect(candidate);
 completed = { ...result(f.scans[0].request), resultRevision: 2 };
 completed.display = { ...completed.display, resultRevision: 2 };
 const queued = result(f.scans[0].request); queued.work = 'queued'; queued.identity = 'pending'; queued.display.selectedIdentity = null;
 f.scans[0].resolve(queued); await settle(); f.render(); f.render();
 t.mock.timers.tick(999); assert.equal(reads, 0);
 t.mock.timers.tick(1); assert.equal(reads, 1); await settle(); f.render(); f.render();
 assert.equal(f.sheet()!.props.view.result.identity, 'exact'); assert.equal(f.sheet()!.props.view.result.work, 'complete');
 t.mock.timers.tick(9999); assert.equal(reads, 1);
 t.mock.timers.tick(1); assert.equal(reads, 2, 'completed evidence retains the preceding ten-second reauthorization read');
 await settle();
});


test('normal typed-barcode completion has no empty name-match copy and can explicitly check again after close', async t => {
  const f = integration(); t.after(() => f.flow.dispose());
  const catalog = f.catalog(); t.after(() => catalog.dispose());
  const input = control(catalog.render(), 'Search catalog products');
  input.props.onChangeText('3337875597197'); input.props.onSubmitEditing(); await settle();
  f.scans[0].resolve(result(f.scans[0].request)); await settle(); f.sheet()!.props.onClose();
  let nodes = catalog.render();
  assert.equal(f.search().props.barcodeEntry, true);
  assert.doesNotMatch(textContent(nodes), /No products found/);
  assert.equal(f.scans.length, 1, 'closing a result does not silently repeat the lookup');
  press(control(nodes, 'Resume product search')); await settle();
  assert.equal(f.scans.length, 2); assert.equal(f.sheet()!.props.view.loading, true);
  assert.deepEqual(f.names, []); assert.equal(f.scans[1].request.code.raw, '3337875597197');
  f.sheet()!.props.onClose();
  // The ordinary name-match empty result remains distinct from barcode dispatch.
  const controller = createCatalogSearchController(async () => [], () => {}, { automatic: false });
  t.after(() => controller.dispose()); controller.setQuery('Synthetic missing name'); await controller.submit();
  nodes = catalog.render({ controller }); assert.match(textContent(nodes), /No products found/);
});
