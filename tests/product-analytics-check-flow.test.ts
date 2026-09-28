import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCustomerCheckFlow, selectIdentityNextAction, selectVisibleCheckView,
} from '../src/presentation/product-analytics/checkFlow.ts';

const visibleResult = {
  integrated: true, focused: true, ownerReady: true, ownerBlocked: false,
  captureOpen: false, checking: false, errorShown: false, unknownShown: false,
  catalogDetailVisible: true, snapshotVisible: false,
  resolutionState: 'identified_formula_unverified' as const,
  catalogIdentityMatched: true, snapshotIdentityKnown: false, snapshotMatchesResolution: false,
  catalogFormulaFactsShown: false, snapshotFormulaFactsShown: false,
  identityNextActionCopyAvailable: true,
  readyDecisionPanelShown: false, decisionMatchesResolution: false,
  unresolvedPhotoVisible: false,
};

test('visibility and owner gates suppress completion while Check is hidden', () => {
  for (const hidden of [
    { focused: false }, { ownerReady: false }, { ownerBlocked: true },
    { captureOpen: true }, { checking: true }, { integrated: false },
  ]) assert.equal(selectVisibleCheckView({ ...visibleResult, ...hidden }), null);
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  const hiddenView = selectVisibleCheckView({ ...visibleResult, ownerBlocked: true });
  if (hiddenView) flow.completeVisible(hiddenView);
  assert.equal(events.length, 1);
});

test('a typed recovery action counts only with the actual visible matched product card', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  const useful = selectVisibleCheckView(visibleResult);
  assert.ok(useful);
  flow.completeVisible(useful);
  flow.begin('search');
  const hiddenAction = selectVisibleCheckView({ ...visibleResult, identityNextActionCopyAvailable: false });
  assert.ok(hiddenAction);
  flow.completeVisible(hiddenAction);
  flow.begin('search');
  const wrongProduct = selectVisibleCheckView({ ...visibleResult, catalogIdentityMatched: false });
  assert.ok(wrongProduct);
  flow.completeVisible(wrongProduct);
  assert.deepEqual(events.filter((event: any) => event.event === 'check_completed').map((event: any) => event.properties.outcome), [
    'useful', 'insufficient_evidence', 'insufficient_evidence',
  ]);
});

test('a stale decision or snapshot cannot personalize a new visible resolution', () => {
  const staleDecision = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula', identityNextActionCopyAvailable: false,
    readyDecisionPanelShown: true, decisionMatchesResolution: false,
  });
  assert.deepEqual(staleDecision, {
    kind: 'identified_result', state: 'verified_product_formula', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: false, personalDecisionShown: false,
  });
  assert.equal(selectVisibleCheckView({
    ...visibleResult, catalogDetailVisible: false, snapshotVisible: true,
    snapshotIdentityKnown: true, snapshotMatchesResolution: false,
  }), null);
  assert.equal(selectVisibleCheckView({
    ...visibleResult, catalogDetailVisible: true, snapshotVisible: true,
    snapshotIdentityKnown: true, snapshotMatchesResolution: false,
  }), null);
});

test('a visible unconfirmed snapshot cannot borrow catalog identity for useful activation', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  const conflicted = selectVisibleCheckView({
    ...visibleResult, snapshotVisible: true, snapshotMatchesResolution: true,
    snapshotIdentityKnown: false, catalogIdentityMatched: true,
  });
  assert.deepEqual(conflicted, {
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: false,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: false, personalDecisionShown: false,
  });
  assert.ok(conflicted);
  flow.completeVisible(conflicted);
  assert.deepEqual(events[1], {
    schemaVersion: 1, event: 'check_completed',
    properties: { inputMethod: 'search', outcome: 'insufficient_evidence', personalized: false },
  });
  const trusted = selectVisibleCheckView({
    ...visibleResult, snapshotVisible: true, snapshotMatchesResolution: true,
    snapshotIdentityKnown: true,
  });
  assert.deepEqual(trusted, {
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: true, personalDecisionShown: false,
  });
});

test('one customer Check keeps its first method through retries and result rerenders', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  assert.equal(flow.begin('barcode'), true);
  assert.equal(flow.begin('photo'), false);
  assert.equal(flow.completeVisible({ kind: 'candidate_choice' }), false);
  const shown = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    catalogFormulaFactsShown: true, identityNextActionCopyAvailable: false,
  });
  assert.ok(shown);
  assert.equal(flow.completeVisible(shown), true);
  const rerendered = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    catalogFormulaFactsShown: true, identityNextActionCopyAvailable: false,
  });
  assert.ok(rerendered);
  assert.equal(flow.completeVisible(rerendered), false);
  assert.deepEqual(events, [
    { schemaVersion: 1, event: 'check_started', properties: { inputMethod: 'barcode' } },
    { schemaVersion: 1, event: 'check_completed', properties: { inputMethod: 'barcode', outcome: 'useful', personalized: false } },
  ]);
});

test('supported identity with a shown typed next action is useful without formula or personal-fit claims', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  assert.equal(selectIdentityNextAction('identified_formula_unverified', 'photograph_ingredients'),
    'Photograph this package’s ingredient list to check its exact formula.');
  assert.equal(selectIdentityNextAction('identified_formula_unverified', 'confirm_variant'),
    'Confirm this exact package variant before relying on a personal answer.');
  assert.equal(selectIdentityNextAction('identified_formula_unverified', 'manual_review'), null);
  flow.begin('search');
  flow.completeVisible({
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: true, personalDecisionShown: false,
  });
  assert.deepEqual(events[1], {
    schemaVersion: 1, event: 'check_completed',
    properties: { inputMethod: 'search', outcome: 'useful', personalized: false },
  });
});

test('candidate-only and incomplete identity do not become useful Checks', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('photo');
  assert.equal(flow.completeVisible({ kind: 'candidate_choice' }), false);
  assert.equal(events.length, 1);
  flow.completeVisible({
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: false,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: true, personalDecisionShown: false,
  });
  assert.deepEqual(events[1], {
    schemaVersion: 1, event: 'check_completed',
    properties: { inputMethod: 'photo', outcome: 'insufficient_evidence', personalized: false },
  });
});

test('a merely identified product never reports verified formula or personalized fit', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  flow.completeVisible({
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: false, personalDecisionShown: true,
  });
  flow.begin('search');
  flow.completeVisible({
    kind: 'identified_result', state: 'identified_formula_unverified', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: true, personalDecisionShown: true,
  });
  assert.deepEqual(events.filter((event: any) => event.event === 'check_completed'), [
    { schemaVersion: 1, event: 'check_completed', properties: {
      inputMethod: 'search', outcome: 'insufficient_evidence', personalized: false,
    } },
    { schemaVersion: 1, event: 'check_completed', properties: {
      inputMethod: 'search', outcome: 'useful', personalized: false,
    } },
  ]);
});

test('unknown, failure, and owner reset stay distinct and cannot finish a stale Check', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('barcode');
  flow.abandon();
  assert.equal(flow.completeVisible({ kind: 'unknown_product' }), false);
  flow.begin('search');
  flow.completeVisible({ kind: 'unknown_product' });
  flow.begin('photo');
  flow.completeVisible({ kind: 'failed' });
  assert.deepEqual(events.map((event: any) => [event.event, event.properties]), [
    ['check_started', { inputMethod: 'barcode' }],
    ['check_started', { inputMethod: 'search' }],
    ['check_completed', { inputMethod: 'search', outcome: 'unknown_product', personalized: false }],
    ['check_started', { inputMethod: 'photo' }],
    ['check_completed', { inputMethod: 'photo', outcome: 'failed', personalized: false }],
  ]);
});

test('a shown bound personal decision is useful even when catalog detail is unavailable', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  flow.completeVisible({
    kind: 'identified_result', state: 'verified_product_formula', supportedIdentity: true,
    verifiedFormulaFactsShown: false, visibleIdentityNextAction: false, personalDecisionShown: true,
  });
  assert.deepEqual(events[1], {
    schemaVersion: 1, event: 'check_completed',
    properties: { inputMethod: 'search', outcome: 'useful', personalized: true },
  });
});

test('a factual result completes immediately and later ready decision is seen once', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('barcode');
  const factual = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    catalogFormulaFactsShown: true, identityNextActionCopyAvailable: false,
    snapshotVisible: true, snapshotMatchesResolution: true, snapshotIdentityKnown: true,
    snapshotFormulaFactsShown: true,
  });
  assert.ok(factual);
  flow.completeVisible(factual);
  assert.equal(flow.observePersonalDecision(factual), false);
  const personalized = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    catalogFormulaFactsShown: true, identityNextActionCopyAvailable: false,
    snapshotVisible: true, snapshotMatchesResolution: true, snapshotIdentityKnown: true,
    snapshotFormulaFactsShown: true,
    readyDecisionPanelShown: true, decisionMatchesResolution: true,
  });
  assert.ok(personalized);
  assert.equal(flow.observePersonalDecision(personalized), true);
  assert.equal(flow.observePersonalDecision(personalized), false);
  assert.deepEqual(events.map((event: any) => event.event), [
    'check_started', 'check_completed', 'personal_decision_viewed',
  ]);
  assert.deepEqual((events[1] as any).properties, {
    inputMethod: 'barcode', outcome: 'useful', personalized: false,
  });
});

test('a decision ready with the useful result emits one exposure despite rerenders', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  flow.begin('search');
  const ready = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    snapshotVisible: true, snapshotMatchesResolution: true, snapshotIdentityKnown: true,
    readyDecisionPanelShown: true, decisionMatchesResolution: true,
  });
  assert.ok(ready);
  flow.completeVisible(ready);
  flow.observePersonalDecision(ready);
  flow.completeVisible(ready);
  flow.observePersonalDecision(ready);
  assert.deepEqual(events.map((event: any) => event.event), [
    'check_started', 'check_completed', 'personal_decision_viewed',
  ]);
  assert.equal((events[1] as any).properties.personalized, true);
});

test('owner reset, new Check, and non-useful completions cannot inherit a prior decision exposure', () => {
  const events: unknown[] = [];
  const flow = createCustomerCheckFlow((event) => { events.push(event); });
  const ready = selectVisibleCheckView({
    ...visibleResult, resolutionState: 'verified_product_formula',
    snapshotVisible: true, snapshotMatchesResolution: true, snapshotIdentityKnown: true,
    readyDecisionPanelShown: true, decisionMatchesResolution: true,
  });
  assert.ok(ready);
  flow.begin('search');
  flow.completeVisible({
    kind: 'identified_result', state: 'verified_product_formula', supportedIdentity: true,
    verifiedFormulaFactsShown: true, visibleIdentityNextAction: false, personalDecisionShown: false,
  });
  flow.abandon();
  assert.equal(flow.observePersonalDecision(ready), false);
  flow.begin('photo');
  flow.completeVisible({ kind: 'failed' });
  assert.equal(flow.observePersonalDecision(ready), false);
  flow.begin('barcode');
  flow.completeVisible({ kind: 'insufficient_evidence' });
  assert.equal(flow.observePersonalDecision(ready), false);
  flow.begin('search');
  assert.equal(flow.observePersonalDecision(ready), false);
  assert.equal(events.filter((event: any) => event.event === 'personal_decision_viewed').length, 0);
});
