import assert from 'node:assert/strict';
import { CustomerController, selectVisibleCustomerDecision, selectCustomerCheckFacts, loadOptionalCustomerCatalog } from '../src/presentation/personal-decision/customerController.ts';
import { evaluateDecisionRequest } from '../supabase/functions/personal-decision/handler.ts';
import type { DecisionDependencies, SavedAssessment } from '../supabase/functions/personal-decision/handler.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assessmentId = '66666666-6666-4666-8666-666666666666';
const requestId = '99999999-9999-4999-8999-999999999999';
const draft = createContextDraft();
draft.intent = { state: 'answered', value: 'add' }; draft.primaryGoal = { state: 'answered', value: 'dryness' };
draft.behavior = { state: 'answered', value: 'dry_tight' };
draft.reactivity = { state: 'answered', value: 'generally_tolerates' }; draft.treatments = { state: 'answered', value: [] }; draft.sensitivities = { state: 'answered', value: [] };
const snapshot = fixtureSnapshot();
const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: owner, revision: 2, profile: { id: '77777777-7777-4777-8777-777777777777', ownerId: owner, revision: 1, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: profileToStorage(draft) }, routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } }, historyRevision: null, historyTruncated: false, experiences: [], legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
const saved = new Map<string, SavedAssessment>();
const dependencies: DecisionDependencies = {
  // Deterministic test providers exercise the actual handler/controller boundary; this is not live authority evidence.
  runtime: 'authoritative', now: () => '2026-09-26T00:00:00Z', verifyCaseOwner: async () => true,
  readSnapshot: async () => ({ snapshot, category: { state: 'known', value: 'moisturizer', sourceIds: ['category-source'] }, categorySources: [{ id: 'category-source', revision: '1' }], categoryBoundaryRevision: 'category-v1' }),
  readContext: async () => context, readHistory: async (_owner, atRevision) => ({ items: [], nextCursor: null, atRevision }), readRoutineFacts: async () => [], readAssessment: async (_owner, id) => saved.get(id) ?? null,
  persist: async (_owner, id, input, packet) => { saved.set(id, { assessmentId, input, packet }); return { assessmentId, packet, replayed: false }; },
};
const controller = new CustomerController({ load: async () => context, write: async () => { throw new Error('Unused'); }, evaluate: (ownerId, request) => evaluateDecisionRequest(ownerId, request, dependencies) }, () => requestId);
controller.setOwner(owner); await controller.load(); await controller.assess(snapshot);
const decision = controller.getState().decision;
assert.equal(decision.kind, 'ready');
if (decision.kind === 'ready') {
  assert.equal(decision.packet.id, requestId);
  assert.notEqual(decision.packet.id, assessmentId);
  assert.equal(decision.packet.action.kind, 'COULD_WORK');
  assert.equal(decision.expectedBinding.ownerId, owner);
  assert.equal(decision.expectedBinding.sourceBoundaryRevision, `p0a/v1:${snapshot.resolverVersion}:category:category-v1`);
}
assert.equal(selectVisibleCustomerDecision(controller.getState(), owner, snapshot)?.kind, 'ready');
assert.equal(selectVisibleCustomerDecision(controller.getState(), owner, { ...snapshot, snapshotId: 'different-product-snapshot' }), null);
assert.equal(selectVisibleCustomerDecision(controller.getState(), owner, { ...snapshot, caseRevision: 2 }), null);
assert.equal(selectVisibleCustomerDecision(controller.getState(), 'another-owner', snapshot), null);
assert.equal(selectVisibleCustomerDecision({ ...controller.getState(), context: { ...context, revision: 3 } }, owner, snapshot), null);
controller.setOwner(null); assert.equal(controller.getState().decision.kind, 'idle');
console.log('Actual P0-B handler to customer controller contract passed with independent assessment ID');
const mutableCatalog = { brand: 'Changed catalog brand', name: 'Changed name', categoryLabel: 'treatment', formula: { ingredients: ['Retinol'], provenanceType: 'manufacturer', observedAt: '2026-09-27' }, source: 'https://mutable.example/formula' };
const frozenFacts = selectCustomerCheckFacts(snapshot, mutableCatalog);
assert.equal(frozenFacts.brand, snapshot.product?.brand);
assert.deepEqual(frozenFacts.formula?.ingredients, ['Water', 'Glycerin']);
assert.equal(frozenFacts.source, null);
assert.equal(selectCustomerCheckFacts({ ...snapshot, state: 'identified_formula_unverified', formula: null }, mutableCatalog).formula, null);
assert.equal(await loadOptionalCustomerCatalog(snapshot, async () => { throw new Error('Catalog 404'); }), null);
await assert.rejects(() => loadOptionalCustomerCatalog(null, async () => { throw new Error('Catalog 404'); }));
