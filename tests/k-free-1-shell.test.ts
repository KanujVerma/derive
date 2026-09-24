import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  LEGACY_ROOT_TABS, TARGET_ROOT_TABS, resolveShellLanding,
  resolveShellPresentation, resolveShellShopAudience,
} from '../src/utils/shellPresentation.ts';
import { getPreviewCatalogDetail, searchPreviewCatalog } from '../src/commerce/checkPreview.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('K-FREE-1: only local development Mock activates the target presentation', () => {
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: false }), 'scanner_first_preview');
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'remote-staging', remoteEnabled: true }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'remote-staging', remoteEnabled: false }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'production', remoteEnabled: false }), 'legacy');
  assert.doesNotMatch(read('src/utils/shellPresentation.ts'), /process\.env|EXPO_PUBLIC_/);
});

test('K-FREE-1: target roots and landing are deterministic without a backend access contract', () => {
  assert.deepEqual(TARGET_ROOT_TABS, ['check', 'my-stuff', 'plan', 'shop']);
  assert.deepEqual(LEGACY_ROOT_TABS, ['index', 'plan', 'shop', 'ask', 'progress']);
  assert.equal(resolveShellLanding('scanner_first_preview', 'free'), '/(tabs)/check');
  assert.equal(resolveShellLanding('scanner_first_preview', 'managed'), '/(tabs)/plan');
  assert.equal(resolveShellLanding('legacy', 'free'), '/(tabs)');
  assert.equal(resolveShellLanding('legacy', 'managed'), '/(tabs)');
});

test('K-FREE-1: preview Shop does not inherit a mock active membership', () => {
  assert.equal(resolveShellShopAudience('scanner_first_preview', 'member'), 'non_member');
  assert.equal(resolveShellShopAudience('legacy', 'member'), 'member');
  assert.equal(resolveShellShopAudience('legacy', 'guest'), 'guest');
});

test('K-FREE-1: sourced local Check sample has no invented package or formula', async () => {
  const match = await searchPreviewCatalog('CeraVe SA');
  assert.equal(match.length, 1);
  assert.equal(match[0].name, 'Renewing SA Cleanser');
  assert.equal(match[0].formulaState, 'unverified');
  assert.equal('variants' in match[0], false, 'preview search returns a bounded summary');
  assert.deepEqual(await searchPreviewCatalog('unknown brand'), []);
  const detail = getPreviewCatalogDetail(match[0].productId);
  assert.ok(detail?.sourceReference?.startsWith('https://www.cerave.com/'));
  assert.deepEqual(detail?.variants, []);
  assert.equal(detail?.variantCount, 0);
});

test('K-FREE-1: one Check component serves both target and legacy routes', () => {
  const target = read('app/(tabs)/check.tsx');
  const legacy = read('app/shop/scan.tsx');
  const shared = read('src/components/check/CheckProductScreen.tsx');
  assert.match(target, /CheckProductScreen/);
  assert.match(legacy, /CheckProductScreen/);
  assert.doesNotMatch(target + legacy, /CameraView|CatalogProductSearch/);
  assert.match(shared, /CameraView/);
  assert.match(shared, /CatalogProductSearch/);
  assert.match(shared, /FORMULA DETAILS/);
  assert.doesNotMatch(shared, /FORMULA QUALITY/);
  assert.match(shared, /if \(!targetShell && !showProviderFeatures\)/, 'Remote Staging still hides Check');
  assert.match(shared, /if \(!targetShell && audience !== 'member'\)/);
  assert.ok(shared.indexOf('if (preview) {') < shared.indexOf('await resolveCatalogIdentity'), 'preview never calls S6');
  assert.match(shared, /setUnknownBarcode\(evidence\.barcode \?\? null\)/, 'unknown preview barcodes remain unresolved');
});

test('K-FREE-1: tab layout hides old roots only in the target preview', () => {
  const layout = read('app/(tabs)/_layout.tsx');
  for (const route of TARGET_ROOT_TABS) assert.match(layout, new RegExp(`name="${route}"`));
  for (const route of LEGACY_ROOT_TABS) assert.match(layout, new RegExp(`name="${route}"`));
  assert.match(layout, /href: targetShell \? null : undefined/);
  assert.match(read('app/index.tsx'), /resolveShellLanding\(shell, 'free'\)/);
  assert.match(read('app/(tabs)/index.tsx'), /Redirect href="\/\(tabs\)\/check"/);
});

test('K-FREE-1: target preview keeps managed hydration out of Plan and sample data out of My Stuff', () => {
  const plan = read('app/(tabs)/plan.tsx');
  const stuff = read('app/(tabs)/my-stuff.tsx');
  assert.match(plan, /scanner_first_preview/);
  assert.match(plan, /ensureInitialRoutineProposal/);
  assert.ok(plan.indexOf('scanner_first_preview') < plan.indexOf('ensureInitialRoutineProposal().catch'));
  assert.doesNotMatch(stuff, /loadArthur|useRoutineStore|hydrateProgress|ensureInitialRoutineProposal/);
  assert.match(stuff, /RootShellHeader/);
  assert.match(read('src/components/account/AccountSettingsButton.tsx'), /Account and Settings/);
  assert.match(read('src/components/shell/RootShellHeader.tsx'), /AccountSettingsButton/);
  assert.match(read('src/components/shop/PreviewShopShell.tsx'), /RootShellHeader/);
  assert.match(read('src/components/plan/PreviewPlanShell.tsx'), /RootShellHeader/);
  assert.match(read('src/components/check/CheckProductScreen.tsx'), /RootShellHeader/);
  assert.match(read('app/(tabs)/shop.tsx'), /if \(targetShell\) return <PreviewShopShell \/>/);
  assert.match(read('app/profile/index.tsx'), /if \(shell === 'scanner_first_preview'\) return <PreviewAccountShell \/>/);
  assert.doesNotMatch(read('src/components/account/PreviewAccountShell.tsx'), /useUserStore|hydrateCustomerProfile|loadArthur/);
});
