import assert from 'node:assert/strict';
import test from 'node:test';
import { addCurrentProduct, addPastOutcome, catalogFamilyReference, clearCurrentFeedback, createSetupBundle, currentFeedbackChoices, currentProductFeedback, currentUseItem, manualUnverifiedReference, setCurrentOutcome, toggleCurrentFeedback } from '../src/presentation/p0b-personalization/setup.ts';
import { createPreviewAnswers, describeContextualExample, previewQuestions, previewScan, setPreviewIntent, setPreviewTarget, togglePreviewFeedback } from '../src/presentation/check/result-sheet/previewContext.ts';
import type { CatalogProductSummary } from '../src/contracts/ProductCatalog.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import React from 'react';
import { searchSetupPreviewCatalog } from '../src/fixtures/p0b-personalization/setupCatalog.ts';
const catalog: CatalogProductSummary = { productId: 'cream', brand: 'Example', name: 'Unknown sounding name', category: 'moisturizer', isCatalogStandard: true, imageUrl: null, variantCount: 1, formulaState: 'unverified' };
const allCopy = (id: string, answers = createPreviewAnswers('check')) => JSON.stringify(describeContextualExample(id, 'check', answers));
test('guarded setup search supplies an explicitly fictional moisturizer without replacing the sourced Check sample', async () => {
  const cream = await searchSetupPreviewCatalog('comfort');
  assert.equal(cream[0].brand, 'Fictional example'); assert.equal(cream[0].category, 'moisturizer');
  assert.equal((await searchSetupPreviewCatalog('CeraVe'))[0].category, 'cleanser');
  assert.deepEqual(await searchSetupPreviewCatalog('x'), []);
});

test('verified catalog category chooses moisturizer words; names and fallback categories never do', () => {
  for (const category of [undefined, 'unknown', 'sunscreen', 'deodorant', 'haircare']) {
    const choices = currentFeedbackChoices(category);
    assert.ok(choices.some(([value]) => value === 'not_helping'));
    assert.ok(!choices.some(([value]) => value === 'still_dry'));
  }
  assert.deepEqual(currentFeedbackChoices('moisturizer').slice(0, 3).map(row => row[1]), ['Works well', 'Still feels dry', 'Too heavy']);
  const item = currentUseItem('one', catalogFamilyReference(catalog));
  assert.equal(addCurrentProduct(createSetupBundle(), item, catalog).previewOnly.catalogCategories?.one, 'moisturizer');
  assert.equal(addCurrentProduct(createSetupBundle(), currentUseItem('manual', manualUnverifiedReference('Moisturizer')), catalog).previewOnly.catalogCategories?.manual, undefined);
  assert.equal(addCurrentProduct(createSetupBundle(), item, { ...catalog, productId: 'another' }).previewOnly.catalogCategories?.one, undefined);
});

test('multiple current facts coexist, legacy outcomes retain meaning, and clearing does not erase historical reports', () => {
  const ref = catalogFamilyReference(catalog);
  let bundle = addCurrentProduct(createSetupBundle(), currentUseItem('one', ref), catalog);
  bundle = setCurrentOutcome(bundle, 'one', 'not_helping');
  bundle = addPastOutcome(bundle, 'history', ref, 'stung');
  bundle = toggleCurrentFeedback(bundle, 'one', 'helpful');
  bundle = toggleCurrentFeedback(bundle, 'one', 'too_heavy');
  bundle = toggleCurrentFeedback(bundle, 'one', 'still_dry');
  assert.deepEqual(currentProductFeedback(bundle, 'one'), ['not_helping', 'helpful', 'too_heavy', 'still_dry']);
  assert.equal(bundle.experiences.length, 1);
  assert.equal(bundle.experiences[0].kind, 'reacted');
  bundle = clearCurrentFeedback(bundle, 'one');
  assert.deepEqual(currentProductFeedback(bundle, 'one'), []);
  assert.equal(bundle.previewOnly.pastReports[0].outcome, 'stung');
  assert.equal(bundle.previewOnly.currentOutcomes.one, 'not_helping');
  assert.equal(toggleCurrentFeedback(bundle, 'absent', 'still_dry'), bundle);
});

test('variant/formula identity is distinct when collecting current products', () => {
  const first = { ...catalogFamilyReference(catalog), variantId: 'v1', formulaVersionId: 'f1' };
  const second = { ...first, variantId: 'v2', formulaVersionId: 'f2' };
  let b = addCurrentProduct(createSetupBundle(), currentUseItem('one', first));
  b = addCurrentProduct(b, currentUseItem('two', second));
  assert.equal(b.products.length, 2);
  assert.equal(addCurrentProduct(b, currentUseItem('duplicate', second)).products.length, 2);
});

test('none, skipped and partial routine cannot become missing steps; irrelevant goals and unsupported categories stay unknown', () => {
  assert.match(allCopy('known-none'), /explicitly reported no current products/);
  assert.match(allCopy('skipped-routine'), /skipped routine information/);
  assert.match(allCopy('partial-routine-question'), /Only part of your routine/);
  for (const id of ['skipped-routine', 'partial-routine-question']) assert.doesNotMatch(allCopy(id), /has no moisturizer|Adds an evening/);
  for (const id of ['unknown-category', 'deodorant', 'haircare', 'irrelevant-goal']) {
    assert.equal(describeContextualExample(id, 'check', createPreviewAnswers('check')).verdict.state, 'unknown');
    assert.doesNotMatch(allCopy(id), /your dryness|For your dryness|matching your/);
  }
  for (const id of ['sunscreen', 'deodorant', 'haircare', 'unknown-category']) assert.equal(previewQuestions(previewScan(id)!).texture, false);
});

test('replacement target stays explicit; Add alone does not create negative fit; no invented hydration or preference', () => {
  const scan = previewScan('multiple-moisturizers')!;
  let a = setPreviewIntent(createPreviewAnswers('check'), 'replace');
  assert.match(allCopy('multiple-moisturizers', a), /replacement target is still unknown/);
  a = setPreviewTarget(scan, a, 'evening');
  a = togglePreviewFeedback(a, 'not_helping');
  a = togglePreviewFeedback(a, 'too_heavy');
  assert.equal(setPreviewTarget(scan, a, 'evening'), a, 'retapping the same target preserves its reports');
  assert.match(allCopy('multiple-moisturizers', a), /replace Evening cream/);
  assert.doesNotMatch(allCopy('multiple-moisturizers', a), /Still feels dry|hydrate better|prefer light/);
  assert.match(allCopy('multiple-moisturizers', a), /texture preference is unknown/);
  a = setPreviewTarget(scan, a, 'morning');
  assert.deepEqual(a.feedback, [], 'feedback cannot follow a different target');
  a = setPreviewIntent(a, 'add');
  assert.equal(a.targetId, null);
  assert.equal(describeContextualExample('multiple-moisturizers', 'check', a).verdict.state, 'good');
  assert.match(allCopy('multiple-moisturizers', a), /same role alone does not/);
});

test('preference changes verdict and reason atomically; stale Check answers cannot affect a new Check', () => {
  let a = { ...createPreviewAnswers('check'), texture: 'light' } as ReturnType<typeof createPreviewAnswers>;
  const mismatch = describeContextualExample('moisturizer', 'check', a);
  assert.equal(mismatch.verdict.state, 'tradeoffs'); assert.match(mismatch.verdict.reason, /explicit preference/);
  a = { ...a, texture: 'rich' };
  const match = describeContextualExample('moisturizer', 'check', a);
  assert.equal(match.verdict.state, 'good'); assert.doesNotMatch(match.verdict.reason, /differs/);
  const stale = describeContextualExample('moisturizer', 'new-check', a);
  assert.match(JSON.stringify(stale), /preference is unknown/);
  assert.doesNotMatch(JSON.stringify(stale), /explicitly chose/);
});

test('a reaction to another variant/formula stays a product report, not a scanned-product contraindication', () => {
  const scan = previewScan('variant-mismatch')!;
  let a = setPreviewTarget(scan, setPreviewIntent(createPreviewAnswers('check'), 'replace'), 'current');
  for (const value of ['helpful', 'too_heavy', 'stung', 'still_dry'] as const) a = togglePreviewFeedback(a, value);
  const view = describeContextualExample('variant-mismatch', 'check', a);
  assert.equal(view.verdict.state, 'good');
  assert.match(JSON.stringify(view), /Works well · Too heavy · Stung · Still feels dry/);
  assert.match(JSON.stringify(view), /does not establish your reaction to the scanned variant and formula/);
  assert.match(JSON.stringify(view), /does not prove this new product will hydrate better/);
  assert.match(JSON.stringify(view), /does not prove layering compatibility/);
});

test('five-step UI allows multi-select, clear, reopen and edit without another step', () => {
  let saved: ReturnType<typeof createSetupBundle> | undefined;
  const h = componentHarness('src/components/p0b-personalization/ContextFlow.tsx', 'ContextFlow', { setup: true, collectIntent: false, createId: () => 'item', onApply() {}, onSkip() {}, onSetup(b: typeof saved) { saved = b; } }, {
    modules: { '@/src/components/catalog/CatalogProductSearch': { CatalogProductSearch: (props: any) => React.createElement('button', { label: 'Pick catalog cream', onPress: () => props.onSelect(catalog) }) } },
  });
  press(control(h.render(), 'Continue')); press(control(h.render(), 'Continue'));
  press(control(h.render(), 'Pick catalog cream')); press(control(h.render(), 'How’s it working for you?'));
  for (const label of ['Works well', 'Too heavy', 'Stung']) press(control(h.render(), label));
  assert.match(textContent(h.render()), /Works well · Too heavy · Stung/);
  press(control(h.render(), 'How’s it working for you?')); press(control(h.render(), 'How’s it working for you?'));
  assert.equal(control(h.render(), 'Stung').props.selected, true);
  press(control(h.render(), 'Clear feedback')); assert.equal(control(h.render(), 'Stung').props.selected, false);
  press(control(h.render(), 'Still feels dry')); press(control(h.render(), 'Continue')); press(control(h.render(), 'Continue'));
  assert.match(textContent(h.render()), /Step\s+5\s+of\s+5/); press(control(h.render(), 'Save skin profile'));
  assert.deepEqual(currentProductFeedback(saved!, 'item'), ['still_dry']);
});

function checkRoute(developmentRuntime = true, buildFlavor = 'development', useRemoteService = false) {
  return componentHarness('app/check-preview.tsx', 'default', {}, { developmentRuntime, modules: {
    'expo-router': { useRouter: () => ({ back() {}, push() {}, replace() {} }), useLocalSearchParams: () => ({ scenario: 'multiple-moisturizers' }) },
    '@/src/config/environment': { publicEnvironment: { buildFlavor, useRemoteService } },
    '@/src/components/check/result-sheet/ResultSheetSurface': { ResultSheetSurface: (props: any) => props.visible ? React.createElement('View', {}, props.summary, props.children, React.createElement('button', { label: 'Close preview', onPress: props.onClose })) : null },
    '@/src/components/check/result-sheet/CheckResultContent': { CheckResultView: (props: any) => React.createElement('View', {}, React.createElement('Text', {}, props.verdict.label, props.verdict.reason), props.verdict.findings.map((finding: any) => React.createElement('Text', { key: finding.id }, finding.reason)), props.children) },
  } });
}
test('guarded route retains optional answers on reopen, resets on a new Check, and clears stale verdict copy', () => {
  const h = checkRoute();
  assert.match(textContent(h.render()), /Good fit/);
  assert.match(textContent(h.render()), /target|intent is unknown/);
  press(control(h.render(), 'Replace'));
  assert.match(textContent(h.render()), /replacement target is still unknown/);
  press(control(h.render(), 'Evening cream'));
  press(control(h.render(), 'Works well')); press(control(h.render(), 'Too heavy'));
  press(control(h.render(), 'Light texture'));
  assert.match(textContent(h.render()), /Some tradeoffs/);
  press(control(h.render(), 'Close preview')); press(control(h.render(), 'Open result again'));
  assert.equal(control(h.render(), 'Evening cream').props.selected, true);
  assert.equal(control(h.render(), 'Too heavy').props.selected, true);
  press(control(h.render(), 'Rich cream'));
  assert.match(textContent(h.render()), /Good fit/);
  assert.doesNotMatch(textContent(h.render()), /texture differs from your explicit preference/);
  press(control(h.render(), 'Clear Check answers'));
  assert.equal(control(h.render(), 'Replace').props.selected, false);
  assert.match(textContent(h.render()), /texture preference is unknown/);
  press(control(h.render(), 'Add'));
  assert.match(textContent(h.render()), /same role alone does not/);
  press(control(h.render(), 'Two current moisturizers'));
  assert.equal(control(h.render(), 'Add').props.selected, false);
});
test('questions are inaccessible outside local development preview and unsupported category scans', () => {
  for (const h of [checkRoute(false), checkRoute(true, 'production'), checkRoute(true, 'development', true)]) {
    assert.match(textContent(h.render()), /Preview unavailable/);
    assert.ok(!h.render().some(node => node.props.label === 'Replace'));
  }
  const h = checkRoute();
  press(control(h.render(), 'Manual / unknown category'));
  assert.ok(!h.render().some(node => node.props.label === 'Rich cream' || node.props.label === 'Replace'));
  assert.match(textContent(h.render()), /Not enough information/);
});
