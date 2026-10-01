import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { componentHarness, textContent } from './ux-profile-render.ts';
import type { PrivateUpcLookup } from '../src/contracts/PrivateUpcLookup.ts';
import { createPrivateCheckFallback, createPrivateCheckRequestMemo, privateCheckEnabled,
  visiblePrivateCheckState, type PrivateCheckState } from '../src/presentation/external-products/checkFallback.ts';

const ownerId = 'e6000000-0000-4000-8000-000000000003';
const barcode = '0037000734130';
const miss: PrivateUpcLookup = { status: 'not_found', candidates: [], truncated: false };
const deferred = () => {
  let resolve!: (value: PrivateUpcLookup) => void;
  const promise = new Promise<PrivateUpcLookup>(done => { resolve = done; });
  return { promise, resolve };
};

test('private fallback requires exact explicit opt-in and development runtime/flavor', () => {
  assert.equal(privateCheckEnabled(true, 'development', 'true'), true);
  for (const args of [[false, 'development', 'true'], [true, 'production', 'true'],
    [true, 'remote-staging', 'true'], [true, 'development', undefined],
    [true, 'development', 'false'], [true, 'development', '1']] as const) {
    assert.equal(privateCheckEnabled(args[0], args[1], args[2]), false);
  }
});

test('canonical-miss controller attempts once automatically and never retries quota by itself', async () => {
  let calls = 0;
  const states: PrivateCheckState[] = [];
  const limited: PrivateUpcLookup = { status: 'rate_limited', candidates: [], truncated: false };
  const controller = createPrivateCheckFallback({ ownerId, barcode, getOwner: () => ownerId,
    request: async () => { calls++; return limited; }, publish: state => states.push(state) });
  await controller.start(); await controller.start();
  assert.equal(calls, 1);
  assert.equal(states.at(-1)?.kind, 'result');
  await controller.retry(); assert.equal(calls, 2);
});

test('in-flight repeated starts and manual retries cannot flood requests', async () => {
  const waiting = deferred(); let calls = 0;
  const controller = createPrivateCheckFallback({ ownerId, barcode, getOwner: () => ownerId,
    request: () => { calls++; return waiting.promise; }, publish: () => {} });
  const pending = controller.start(); await controller.start(); await controller.retry();
  assert.equal(calls, 1);
  waiting.resolve(miss); await pending;
});

test('effect replay reuses the in-flight request; explicit retry and new identity make a fresh request', async () => {
  const memo = createPrivateCheckRequestMemo(); let calls = 0;
  const request = async () => { calls++; return miss; };
  const first = memo(ownerId + ':' + barcode, request);
  assert.equal(memo(ownerId + ':' + barcode, request), first);
  await first; assert.equal(calls, 1);
  await memo(ownerId + ':' + barcode, request, true); assert.equal(calls, 2);
  await memo('another-owner:' + barcode, request); assert.equal(calls, 3);
  await memo('another-owner:3606000537538', request); assert.equal(calls, 4);
});

test('owner changes and unmount disposal block stale async publication', async () => {
  for (const shouldDispose of [false, true]) {
    let current: string | null = ownerId;
    const waiting = deferred(), states: PrivateCheckState[] = [];
    const controller = createPrivateCheckFallback({ ownerId, barcode, getOwner: () => current,
      request: () => waiting.promise, publish: state => states.push(state) });
    const pending = controller.start();
    if (shouldDispose) controller.dispose(); else current = 'new-owner';
    waiting.resolve(miss); await pending;
    assert.deepEqual(states.map(state => state.kind), ['loading']);
    await controller.retry(); assert.equal(states.length, 1);
  }
});

test('render selector hides previous owner and previous barcode before effect cleanup', () => {
  const state: PrivateCheckState = { kind: 'result', ownerId, barcode, result: miss };
  assert.equal(visiblePrivateCheckState(state, ownerId, barcode), state);
  assert.equal(visiblePrivateCheckState(state, 'other-owner', barcode), null);
  assert.equal(visiblePrivateCheckState(state, null, barcode), null);
  assert.equal(visiblePrivateCheckState(state, ownerId, '3606000537538'), null);
});

test('denied tester error is preserved and invalid/absent owners never call the provider', async () => {
  const states: PrivateCheckState[] = [];
  const controller = createPrivateCheckFallback({ ownerId, barcode, getOwner: () => ownerId,
    request: async () => { throw new Error('PRIVATE_TESTER_REQUIRED'); }, publish: state => states.push(state) });
  await controller.start();
  assert.deepEqual(states.at(-1), { kind: 'error', ownerId, barcode, code: 'PRIVATE_TESTER_REQUIRED' });
  for (const overrides of [{ ownerId: '' }, { barcode: '12345678' }, { getOwner: () => null }]) {
    await createPrivateCheckFallback({ ownerId, barcode, getOwner: () => ownerId, ...overrides,
      request: async () => { assert.fail('must not request'); }, publish: () => {} }).start();
  }
});

test('normal Check wires only the canonical-miss branch; external UI never creates product/formula/decision truth', () => {
  const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/check/PrivateUpcFallback.tsx', import.meta.url), 'utf8');
  assert.match(check, /privateBarcodeResult = Boolean\(unknownBarcode && liveCheckOwner\)/);
  assert.match(check, /privateBarcodeResult && isCheckFocused && !editingContext && unknownBarcode && <PrivateUpcFallback/);
  assert.match(check, /barcode=\{unknownBarcode\} ownerId=\{liveCheckOwner\}/);
  assert.match(check, /sheet=\{\{ presentationKey: resultKey, onClose: closeContextualResult \}\}/);
  assert.match(check, /visible=\{!privateBarcodeResult && isCheckFocused/);
  assert.doesNotMatch(check, /if \(targetShell && unknownBarcode\)/);
  assert.equal(check.split('<PrivateUpcFallback').length - 1, 1);
  assert.match(component, /process\.env\.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED/);
  assert.match(check, /privateBarcodeMiss = cameraAwaitingResult && !isCheckingProduct && Boolean\(unknownBarcode\)\s*&& privateCheckEnabled\(__DEV__, publicEnvironment.buildFlavor, process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED\)/);
  assert.match(check, /if \(!privateBarcodeMiss && !cameraResultNeedsExistingPage/);
  assert.match(component, /checkOwnerId === sessionOwnerId \? checkOwnerId : null/);
  assert.match(component, /Tester account ID: \{ownerId\}/);
  assert.match(component, /Ingredients, formula and personal fit are not verified/);
  assert.match(component, /sourceBarcode/);
  assert.match(component, /retrievedAt/);
  assert.doesNotMatch(component, /evaluateProduct|recordFreeCheck|resolveCatalogIdentity|PersonalDecisionPanel|\.insert\(|\.upsert\(/);
});

test('private match uses the new result sheet while preserving ingredient and explicit save children', () => {
  const candidate = { sourceRecordId: 'upc-record', observedBarcode: barcode, sourceBarcode: barcode,
    name: 'Exact deodorant 3 oz', brand: 'Example', size: '3 oz', retrievedAt: '2026-10-01T12:00:00Z' };
  const state = { kind: 'result', ownerId, barcode,
    result: { status: 'found', candidates: [candidate], truncated: false } };
  const auth = Object.assign((selector: (value: { sessionUserId: string }) => unknown) => selector({ sessionUserId: ownerId }),
    { getState: () => ({ sessionUserId: ownerId }) });
  let closed = 0;
  const harness = componentHarness('src/components/check/PrivateUpcFallback.tsx', 'PrivateUpcFallback',
    { ownerId, barcode, sheet: { presentationKey: 'scan-generation-7', onClose: () => { closed++; } } }, {
      modules: {
        react: { ...React, useState: () => [state, () => {}], useRef: (current: unknown) => ({ current }), useEffect() {} },
        '@/src/config/environment': { publicEnvironment: { buildFlavor: 'development' } },
        '@/src/services/supabase': { supabase: {} },
        '@/src/stores/authStore': { useAuthStore: auth },
        '@/src/components/check/PublishedProductIngredients': { PublishedProductIngredients: 'PublishedProductIngredients' },
        '@/src/components/check/ExternalProductActions': { ExternalProductActions: 'ExternalProductActions' },
        '@/src/components/check/result-sheet/ResultSheetSurface': { ResultSheetSurface: 'ResultSheetSurface' },
        '@/src/components/check/result-sheet/CheckResultContent': { CheckResultView: 'CheckResultView' },
      },
    });
  const priorFlag = process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED;
  process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED = 'true';
  try {
    const nodes = harness.render();
    const surface = nodes.find(node => node.type === 'ResultSheetSurface');
    assert.ok(surface);
    assert.equal(surface.props.keepDetailsMounted, true);
    assert.deepEqual(JSON.parse(surface.props.presentationKey), [ownerId, barcode, 'scan-generation-7']);
    const summaryView = React.Children.toArray(surface.props.summary.props.children)
      .find(value => React.isValidElement(value) && value.type === 'CheckResultView') as React.ReactElement<any>;
    assert.ok(summaryView);
    assert.equal(summaryView.props.facts.name, candidate.name);
    assert.equal(summaryView.props.facts.formula, null);
    assert.equal(summaryView.props.verdict.state, 'unknown');
    assert.equal(summaryView.props.verdict.label, 'Not enough information');
    assert.deepEqual(nodes.find(node => node.type === 'PublishedProductIngredients')?.props.query,
      { barcode, name: candidate.name, brand: candidate.brand, size: candidate.size });
    assert.equal(nodes.find(node => node.type === 'ExternalProductActions')?.props.ownerId, ownerId);
    assert.match(textContent(nodes), /Save only after confirming the label/);
    surface.props.onClose();
    assert.equal(closed, 1);
    const changedOwner = harness.render({ ownerId: 'another-owner' });
    assert.equal(changedOwner.some(node => node.type === 'ResultSheetSurface'), false);
    assert.equal(changedOwner.some(node => node.type === 'PublishedProductIngredients'), false);
    assert.equal(changedOwner.some(node => node.type === 'ExternalProductActions'), false);
    assert.doesNotMatch(textContent(changedOwner), /Exact deodorant/);
  } finally {
    if (priorFlag === undefined) delete process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED;
    else process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED = priorFlag;
  }
});
