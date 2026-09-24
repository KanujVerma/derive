import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveCheckEntryState } from '../src/commerce/checkEntryState.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('K-FREE-1B: permission state chooses camera, landing, denied, or search without requesting on mount', () => {
  assert.equal(resolveCheckEntryState({ preview: true, searching: false, permission: 'granted' }), 'camera');
  assert.equal(resolveCheckEntryState({ preview: true, searching: false, permission: 'undetermined' }), 'landing');
  assert.equal(resolveCheckEntryState({ preview: true, searching: false, permission: 'unknown' }), 'landing');
  assert.equal(resolveCheckEntryState({ preview: true, searching: false, permission: 'denied' }), 'denied');
  assert.equal(resolveCheckEntryState({ preview: true, searching: true, permission: 'granted' }), 'search');
  assert.equal(resolveCheckEntryState({ preview: false, searching: true, permission: 'granted' }), 'search');
});

test('K-FREE-1B: one Check component has explicit scan and search actions', () => {
  const check = read('src/components/check/CheckProductScreen.tsx');
  assert.match(check, /handleScanBarcodePress/);
  assert.match(check, /requestPermission\(\)/);
  assert.match(check, /handleSearchNamePress/);
  const scanHandler = check.indexOf('const handleScanBarcodePress');
  const request = check.indexOf('await requestPermission()');
  const mountEffect = check.indexOf('useEffect(() => {');
  assert.ok(scanHandler >= 0 && scanHandler < request && request < mountEffect, 'permission request stays inside the explicit Scan action');
  assert.match(check.slice(scanHandler, mountEffect), /setIsSearching\(false\)/);
  assert.match(check.slice(check.indexOf('const handleSearchNamePress'), scanHandler), /setIsSearching\(true\)/);
  assert.match(check, /CameraView/);
  assert.match(check, /CatalogProductSearch/);
  assert.match(check, /FORMULA DETAILS/);
  assert.doesNotMatch(check, /FORMULA QUALITY/);
  assert.match(read('app/(tabs)/check.tsx'), /CheckProductScreen/);
  assert.match(read('app/shop/scan.tsx'), /CheckProductScreen/);
});

test('K-FREE-1B: new root shells use restrained shared chrome and useful copy', () => {
  const stuff = read('app/(tabs)/my-stuff.tsx');
  const plan = read('src/components/plan/PreviewPlanShell.tsx');
  const shop = read('src/components/shop/PreviewShopShell.tsx');
  const account = read('src/components/account/AccountSettingsButton.tsx');
  for (const screen of [stuff, plan, shop]) assert.match(screen, /RootShellHeader/);
  assert.match(stuff, /GroupedSection/);
  assert.doesNotMatch(stuff, /loadArthur|useRoutineStore|Nothing saved yet/);
  assert.match(plan, /Managed Skincare/);
  assert.match(plan, /\$25\/month/);
  assert.match(plan, /Enrollment coming soon/);
  assert.doesNotMatch(plan, /ensureInitialRoutineProposal|Stripe|onboarding/);
  assert.match(shop, /Coming soon/);
  assert.match(shop, /Check a Product/);
  assert.doesNotMatch(shop, /createProductCheckout|priceDisplay|discountPercent/);
  assert.match(account, /ImpactFeedbackStyle\.Light/);
  assert.match(account, /minTouchTarget/);
  assert.match(read('src/components/shell/RootShellHeader.tsx'), /ScreenHeader/);
  assert.match(read('src/components/ui/GlassContainer.tsx'), /fallbackDarkSurface/, 'dark floating controls need a legible non-glass fallback');
});

test('K-FREE-1B: customer copy contains no development explanations', () => {
  const ui = [
    'src/components/check/CheckProductScreen.tsx',
    'app/(tabs)/my-stuff.tsx',
    'src/components/plan/PreviewPlanShell.tsx',
    'src/components/shop/PreviewShopShell.tsx',
    'src/components/account/PreviewAccountShell.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(ui, /Local preview|local sample|No plan is connected in this preview|Nothing saved yet/);
});
