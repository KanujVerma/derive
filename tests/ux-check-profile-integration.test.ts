import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { searchPreviewCatalog, getPreviewCatalogDetail } from '../src/commerce/checkPreview.ts';
import { searchSetupPreviewCatalog } from '../src/fixtures/p0b-personalization/setupCatalog.ts';

/** Host state/handlers and projections run normally; native hosts, stores and network I/O are inert. */
function previewModules() {
  const destinations: any[] = [];
  let returns = 0;
  const auth = { sessionUserId: null, status: 'SIGNED_OUT' };
  const access = { status: 'IDLE', userId: null, access: null };
  const storeHook = (state: any) => Object.assign((select: any) => select(state), { getState: () => state });
  const state = { ownerId: null, status: 'idle', context: null, decision: { kind: 'idle' } };
  const denyNetwork = () => { throw new Error('Preview attempted live I/O'); };
  const modules: Record<string, any> = {
    'expo-router': { useRouter: () => ({ push: (value: any) => destinations.push(value), back: () => returns++, canGoBack: () => true }), useLocalSearchParams: () => ({}), useFocusEffect: (effect: any) => effect() },
    '@gorhom/bottom-sheet': { BottomSheetTextInput: 'BottomSheetTextInput' },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, denyNetwork] },
    'expo-haptics': { selectionAsync: async () => {} },
    '@/src/config/environment': { publicEnvironment: { buildFlavor: 'development', supabaseUrl: '' } },
    '@/src/services/DeriveService': { isRemoteServiceEnabled: () => false },
    '@/src/utils/shellPresentation': { resolveShellPresentation: () => 'scanner_first_preview', isFreeIntegrationShell: (shell: string) => shell === 'local_free_integration' || shell === 'hosted_free_integration' },
    '@/src/stores/authStore': { useAuthStore: storeHook(auth) },
    '@/src/stores/freeAccessStore': { useFreeAccessStore: storeHook(access) },
    '@/src/stores/routineStore': { useRoutineStore: () => ({ routine: [], userProducts: [], checkIns: [] }) },
    '@/src/stores/onboardingStore': { useOnboardingStore: () => ({ productReactions: [] }) },
    '@/src/stores/scanContextStore': { useScanContextStore: { getState: denyNetwork } },
    '@/src/services/productCatalog': { createCatalogRequestId: () => 'preview-operation', getCatalogProductDetail: denyNetwork, resolveCatalogIdentity: denyNetwork },
    '@/src/presentation/capture/liveFreeEvidenceProcessor': { createLiveIngredientContinuationProcessor: denyNetwork },
    '@/src/services/deriveClient': { evaluateProduct: denyNetwork },
    '@/src/services/remote/freeContext': { recordFreeCheck: denyNetwork },
    '@/src/services/supabase': { supabase: {} },
    '@/src/services/productLinks': { resolveProductLink: denyNetwork, ProductLinkError: Error },
    '@/src/services/analytics': { analytics: { track() {} } },
    '@/src/commerce/useShopAudience': { useShopAudience: () => 'member' },
    '@/src/commerce/checkPreview': { searchPreviewCatalog, getPreviewCatalogDetail },
    '@/src/fixtures/p0b-personalization/setupCatalog': { searchSetupPreviewCatalog },
    '@/src/presentation/personalization/gateway': { personalizationGateway: { lastSaveStatus: () => null }, resolvePersonalizationOwnerId: () => null },
    '@/src/presentation/personal-decision/customerGateway': { currentCustomerOwner: () => null, customerController: { subscribe() {}, getState: () => state, setOwner() {}, setOriginSnapshot() {} } },
    '@/src/presentation/personal-decision/customerController': { selectVisibleCustomerDecision: () => null, describeCanonicalMyStuff: () => ({ kind: 'unavailable' }), canShowLegacyPersonalFit: () => true },
    '@/src/components/catalog/CatalogProductSearch': { CatalogProductSearch: 'CatalogProductSearch' },
    '@/src/components/check/capture/CheckCaptureHost': { CheckCaptureHost: 'CheckCaptureHost' },
    '@/src/components/check/result-sheet/ScanResultSheet': { ScanResultSheet: 'ScanResultSheet' },
    '@/src/components/check/result-sheet/CheckResultPresentation': { CheckResultPresentation: 'CheckResultPresentation' },
    '@/src/components/check/contribution/MissingProductContribution': { MissingProductContribution: 'MissingProductContribution' },
    '@/src/components/account/AccountSettingsButton': { AccountSettingsButton: 'AccountSettingsButton' },
    '@/src/components/shell/RootShellHeader': { RootShellHeader: 'RootShellHeader' },
    '@/src/components/my-stuff/MyStuffContent': { MyStuffContent: 'MyStuffContent' },
    '@/src/presentation/my-stuff/myStuffRemote': { myStuffStore: {} },
    zustand: { useStore: (_store: any, select: any) => select({ ownerId: null, status: 'idle', model: null, error: null, cursors: {}, loadingMore: false }) },
  };
  return { modules, destinations, returns: () => returns };
}

test('entry search opens the factual sheet and can close and reopen', async () => {
  const context = previewModules(); const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
  flow.render(); const [sample] = await searchPreviewCatalog('CeraVe');
  for (let repeat = 0; repeat < 2; repeat++) {
    flow.render().find(node => node.type === 'CatalogProductSearch')!.props.onSelect(sample);
    let sheet = flow.render().find(node => node.type === 'CheckResultPresentation')!;
    assert.equal(sheet.props.visible, true); assert.equal(sheet.props.input.catalogFacts.name, 'Renewing SA Cleanser');
    sheet.props.onClose(); sheet = flow.render().find(node => node.type === 'CheckResultPresentation')!;
    assert.equal(sheet.props.visible, false);
  }
});

test('My Stuff opens fresh five-step setup, uses local searches and Done returns to the same preview', async () => {
  const context = previewModules();
  const myStuff = componentHarness('app/(tabs)/my-stuff.tsx', 'default', {}, context);
  myStuff.render().find(node => node.type === 'MyStuffContent')!.props.onEditProfile();
  assert.deepEqual(context.destinations, [{ pathname: '/personalize/fixture', params: { mode: 'profile', fresh: '1', focused: '1' } }]);
  const params = context.destinations[0].params;
  context.modules['expo-router'].useLocalSearchParams = () => params;
  const setup = componentHarness('app/personalize/fixture.tsx', 'default', {}, context);
  assert.match(textContent(setup.render()), /Step\s+1\s+of\s+5/);
  press(control(setup.render(), 'Continue'));
  press(control(setup.render(), 'Continue'));
  let search = setup.render().find(node => node.type === 'CatalogProductSearch')!;
  assert.equal(search.props.search, searchSetupPreviewCatalog);
  search.props.onSelect((await search.props.search('CeraVe'))[0]);
  assert.match(textContent(setup.render()), /CeraVe Renewing SA Cleanser/);
  press(control(setup.render(), 'Continue'));
  search = setup.render().find(node => node.type === 'CatalogProductSearch')!;
  assert.equal(search.props.search, searchSetupPreviewCatalog);
  press(control(setup.render(), 'Continue'));
  assert.match(textContent(setup.render()), /Step\s+5\s+of\s+5/);
  press(control(setup.render(), 'Done'));
  assert.equal(context.returns(), 1);
  assert.equal(params.fresh, '1');
});

function element(root: any, label: string): any {
  if (!root || typeof root !== 'object') return null;
  if (Array.isArray(root)) return root.map(item => element(item, label)).find(Boolean);
  if (root.props?.label === label) return root;
  return element(root.props?.children, label);
}
test('barcode miss embeds registered search directly and dismissal rearms the same camera mount', () => {
  const context = previewModules(); const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
  flow.render(); press(control(flow.render(), 'Open camera'));
  let capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  const key = (capture as any).key;
  const evidence = [{ role: 'barcode', kind: 'barcode', value: '036000291452' }];
  capture.props.onCaptureReady({ authority: 'customer_evidence', evidence, barcodeLookup: { barcode: '036000291452' }, localPhotos: [], review: { state: 'pending', selectedCandidateId: null } });
  capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  assert.equal(capture.props.companion.props.model.title, 'No verified match for this barcode.');
  const search = element(capture.props.companion.props.compactActions, 'Search by name');
  assert.equal(search.props.InputComponent, 'BottomSheetTextInput'); assert.equal(search.props.focusKey, undefined);
  assert.equal(capture.props.companion.props.replacement, undefined);
  assert.ok(!element(capture.props.companion.props.compactActions, 'Photograph package'));
  assert.equal(capture.props.companion.props.onAddRequestedEvidence, undefined);
  search.props.onQueryChange('CeraVe');
  capture.props.companion.props.onDismiss(); capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  assert.equal((capture as any).key, key); assert.equal(capture.props.resumeKey, 1);
  assert.equal(capture.props.initialRole, 'barcode'); assert.equal(capture.props.companion, null);
  assert.equal(capture.props.photoCaptureEnabled, false);
});
test('camera Search uses the same direct field and catalog selection keeps camera mounted without photo dead ends', async () => {
  const context = previewModules(); const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
  flow.render(); press(control(flow.render(), 'Open camera'));
  let capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  const key = (capture as any).key; capture.props.onSearch();
  capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  assert.equal(capture.props.companion.props.searchOnly, true);
  assert.equal(capture.props.companion.props.searchEmpty, true);
  const search = element(capture.props.companion.props.compactActions, 'Search by name');
  search.props.onSelect((await searchPreviewCatalog('CeraVe'))[0]);
  capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  assert.equal((capture as any).key, key);
  const sheet = capture.props.companion;
  assert.equal(sheet.props.input.catalogFacts.name, 'Renewing SA Cleanser');
  assert.ok(!element(sheet.props.compactActions, 'Photograph ingredients'));
  sheet.props.onClose(); capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
  assert.equal((capture as any).key, key); assert.equal(capture.props.companion, null);
});


test('normal Check has no example entry; examples remain on their guarded developer route', () => {
  const context = previewModules(); const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
  assert.doesNotMatch(textContent(flow.render()), /Result examples/);
});


for (const surface of ['entry', 'camera'] as const) {
  test(`${surface} search accepts partial catalog matches and has only concise empty copy for no match`, async () => {
    const context = previewModules(); const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
    flow.render();
    if (surface === 'camera') {
      press(control(flow.render(), 'Open camera'));
      flow.render().find(node => node.type === 'CheckCaptureHost')!.props.onSearch();
    }
    const hostSearch = () => surface === 'entry'
      ? flow.render().find(node => node.type === 'CatalogProductSearch')!
      : element(flow.render().find(node => node.type === 'CheckCaptureHost')!.props.companion.props.compactActions, 'Search by name');
    const searchProps = hostSearch().props;
    const search = componentHarness('src/components/catalog/CatalogProductSearch.tsx', 'CatalogProductSearch', searchProps,
      { modules: { '../../services/productCatalog': { searchCatalogProducts: () => { throw new Error('Unexpected live search'); } }, '../ui/Icon': { Icon: 'Icon' } } });
    const query = async (value: string) => {
      control(search.render(), 'Search catalog products').props.onChangeText(value);
      await searchProps.controller.submit();
      return search.render();
    };
    let view = await query('cer');
    assert.match(textContent(view), /CeraVe.*Renewing SA Cleanser/);
    assert.doesNotMatch(textContent(flow.render()), /Check name as entered/);
    assert.ok(!flow.render().some(node => node.props.label === 'Check name as entered'));
    view = await query('zzzz no matching product');
    assert.equal(textContent(view), 'Search by name No products found');
    assert.ok(!view.some(node => node.type === 'TouchableOpacity'), 'settled no match adds no fallback action');
    assert.ok(!flow.render().some(node => node.props.label === 'Check name as entered'));
    view = await query('cer');
    press(control(view, 'Check CeraVe Renewing SA Cleanser'));
    const result = surface === 'entry'
      ? flow.render().find(node => node.type === 'CheckResultPresentation')!
      : flow.render().find(node => node.type === 'CheckCaptureHost')!.props.companion;
    assert.equal(result.props.input.catalogFacts.name, 'Renewing SA Cleanser', 'selecting the actual matched product remains supported');
    searchProps.controller.dispose();
  });
}
