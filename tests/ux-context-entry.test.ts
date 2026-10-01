import assert from 'node:assert/strict';
import test from 'node:test';
import { contextEditorDestination, createEditorReturnGate, experienceDraftForProduct } from '../src/presentation/personal-decision/editorEntry.ts';
import type { EvidenceNeedCode } from '../src/contracts/PersonalDecision.ts';

const packet = (codes: EvidenceNeedCode[]) => ({ action: { nextStep: 'add_context' as const },
  evidenceNeeds: codes.map((code, index) => ({ id: String(index), code, state: 'unknown' as const, critical: true, findingIds: [] })) });
test('a context action opens the section that can supply the bound missing evidence', () => {
  assert.deepEqual(contextEditorDestination(packet(['current_formula_experience'])), { mode: 'history', entry: 'new' });
  assert.deepEqual(contextEditorDestination(packet(['exact_prior_formula'])), { mode: 'history' });
  assert.deepEqual(contextEditorDestination(packet(['routine_completeness'])), { mode: 'routine' });
  assert.deepEqual(contextEditorDestination(packet(['current_treatments'])), { mode: 'profile' });
  for (const code of ['verified_formula', 'exact_identity', 'supported_rule', 'reviewed_claim'] as const) {
    assert.equal(contextEditorDestination(packet([code])), null);
  }
});
test('acknowledged editor return is invalidated by an A to B to A transition and delivered once', () => {
  const gate = createEditorReturnGate('A');
  const old = gate.begin('A');
  gate.observeOwner('B'); gate.observeOwner('A');
  assert.equal(gate.takeReturn(old, 'A'), false);
  const current = gate.begin('A');
  assert.equal(gate.takeReturn(current, 'A'), true);
  assert.equal(gate.takeReturn(current, 'A'), false);
  const abandoned = gate.begin('A'); gate.invalidate();
  assert.equal(gate.takeReturn(abandoned, 'A'), false);
});
test('contextual experience preselection uses the owner record and never confirms its formula', () => {
  const product = { id: 'record', productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Product', brand: 'Brand', state: 'considering' as const, source: 'catalog' as const };
  const draft = experienceDraftForProduct('new-id', 'A', 'A', product);
  assert.equal(draft?.reference.kind, 'catalog');
  assert.deepEqual(draft?.reference, { kind: 'catalog', label: 'Brand Product', productId: product.productId, variantId: null, formulaVersionId: null });
  assert.equal(draft?.kind, null);
  assert.equal(draft?.useContext, null);
  assert.equal(experienceDraftForProduct('new-id', 'A', 'B', product), null);
  const manual = experienceDraftForProduct('new-id', 'A', 'A', { ...product, productId: null, name: 'Café gel', source: 'user_reported' });
  assert.deepEqual(manual?.reference, { kind: 'manual', label: 'Café gel', verification: 'unverified' });
});
