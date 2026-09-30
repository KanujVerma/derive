import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { searchPreviewCatalog, getPreviewCatalogDetail } from '../src/commerce/checkPreview.ts';

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
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, denyNetwork] },
    'expo-haptics': { selectionAsync: async () => {} },
    '@/src/config/environment': { publicEnvironment: { buildFlavor: 'development', supabaseUrl: '' } },
    '@/src/services/DeriveService': { isRemoteServiceEnabled: () => false },
    '@/src/utils/shellPresentation': { resolveShellPresentation: () => 'scanner_first_preview' },
    '@/src/stores/authStore': { useAuthStore: storeHook(auth) },
    '@/src/stores/freeAccessStore': { useFreeAccessStore: storeHook(access) },
    '@/src/stores/routineStore': { useRoutineStore: () => ({ routine: [], userProducts: [], checkIns: [] }) },
    '@/src/stores/onboardingStore': { useOnboardingStore: () => ({ productReactions: [] }) },
    '@/src/stores/scanContextStore': { useScanContextStore: { getState: denyNetwork } },
    '@/src/services/productCatalog': { createCatalogRequestId: () => 'preview-operation', getCatalogProductDetail: denyNetwork, resolveCatalogIdentity: denyNetwork },
    '@/src/services/deriveClient': { evaluateProduct: denyNetwork },
    '@/src/services/remote/freeContext': { recordFreeCheck: denyNetwork },
    '@/src/services/supabase': { supabase: {} },
    '@/src/services/productLinks': { resolveProductLink: denyNetwork, ProductLinkError: Error },
    '@/src/services/analytics': { analytics: { track() {} } },
    '@/src/commerce/useShopAudience': { useShopAudience: () => 'member' },
    '@/src/commerce/checkPreview': { searchPreviewCatalog, getPreviewCatalogDetail },
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

for (const input of ['entry search', 'camera search']) test(`${input} opens the same factual sheet and can close and reopen`, async () => {
  const context = previewModules();
  const flow = componentHarness('app/(tabs)/check.tsx', 'default', {}, context);
  flow.render();
  let nodes = flow.render();
  const [sample] = await searchPreviewCatalog('CeraVe');
  for (let repeat = 0; repeat < 2; repeat++) {
    if (input === 'camera search') {
      press(control(nodes, 'Open camera'));
      const capture = flow.render().find(node => node.type === 'CheckCaptureHost')!;
      assert.equal(capture.props.catalogSearch, searchPreviewCatalog);
      capture.props.onCatalogSelect(sample);
    } else {
      const search = nodes.find(node => node.type === 'CatalogProductSearch')!;
      assert.equal(search.props.search, searchPreviewCatalog);
      search.props.onSelect(sample);
    }
    nodes = flow.render();
    assert.ok(!nodes.some(node => node.type === 'CheckCaptureHost'));
    const sheet = nodes.find(node => node.type === 'CheckResultPresentation')!;
    assert.equal(sheet.props.visible, true);
    assert.equal(sheet.props.input.catalogFacts.name, 'Renewing SA Cleanser');
    assert.equal(sheet.props.input.snapshot, null);
    assert.equal(sheet.props.input.fit.kind, 'preview_unavailable');
    sheet.props.onClose();
    nodes = flow.render();
    assert.equal(nodes.find(node => node.type === 'CheckResultPresentation')!.props.visible, false);
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
  assert.equal(search.props.search, searchPreviewCatalog);
  search.props.onSelect((await search.props.search('CeraVe'))[0]);
  assert.match(textContent(setup.render()), /CeraVe Renewing SA Cleanser/);
  press(control(setup.render(), 'Continue'));
  search = setup.render().find(node => node.type === 'CatalogProductSearch')!;
  assert.equal(search.props.search, searchPreviewCatalog);
  press(control(setup.render(), 'Continue'));
  assert.match(textContent(setup.render()), /Step\s+5\s+of\s+5/);
  press(control(setup.render(), 'Done'));
  assert.equal(context.returns(), 1);
  assert.equal(params.fresh, '1');
});
