/** Contract scenarios only: real policy/controller/renderer, synthetic dependency ports, no service/device claim. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerController, selectVisibleCustomerDecision, selectCustomerCheckFacts, describeCanonicalMyStuff } from '../src/presentation/personal-decision/customerController.ts';
import { describeProductTruth } from '../src/presentation/capture/productTruthPresentation.ts';
import { describePersonalDecision } from '../src/presentation/personal-decision/result.ts';
import { evaluateDecisionRequest, type DecisionDependencies } from '../supabase/functions/personal-decision/handler.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import { unresolvedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empty = (): PersonalContextSnapshot => ({ version: 'personal-context-v1', ownerId: owner, revision: 0, profile: null, routine: null, experiences: [], historyRevision: null, historyTruncated: false, legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } });
test('supported snapshot flows through real decision policy/controller/renderer, survives catalog outage, and clears on owner switch', async () => {
 const snapshot = fixtureSnapshot(); let context = empty(); let next = 0;
 const draft = createContextDraft(); draft.intent = { state: 'answered', value: 'add' }; draft.primaryGoal = { state: 'answered', value: 'dryness' }; draft.behavior = { state: 'answered', value: 'dry_tight' }; draft.reactivity = { state: 'answered', value: 'generally_tolerates' }; draft.treatments = { state: 'answered', value: [] }; draft.sensitivities = { state: 'answered', value: [] };
 const deps: DecisionDependencies = { runtime: 'authoritative', now: () => '2026-09-27T00:00:00Z', verifyCaseOwner: async () => true, readSnapshot: async () => ({ snapshot, category: { state: 'known', value: 'moisturizer', sourceIds: ['category'] }, categorySources: [{ id: 'category', revision: '1' }], categoryBoundaryRevision: '1' }), readContext: async () => context, readHistory: async (_o, atRevision) => ({ items: [], nextCursor: null, atRevision }), readRoutineFacts: async () => [], readAssessment: async () => null, persist: async (_o, _id, _input, packet) => ({ assessmentId: '66666666-6666-4666-8666-666666666666', packet, replayed: false }) };
 const controller = new CustomerController({ load: async () => context, write: async () => { throw new Error('not used'); }, evaluate: async (o, request) => evaluateDecisionRequest(o, request, deps) }, () => `99999999-9999-4999-8999-${String(++next).padStart(12, '0')}`);
 controller.setOwner(owner); await controller.load(); await controller.assess(snapshot);
 let decision = selectVisibleCustomerDecision(controller.getState(), owner, snapshot); assert(decision); assert.equal(decision.packet.action.kind, 'NOT_ENOUGH_INFORMATION');
 context = { ...empty(), revision: 2, profile: { id: '77777777-7777-4777-8777-777777777777', ownerId: owner, revision: 1, recordedAt: '2026-09-27T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: profileToStorage(draft) }, routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: '2026-09-27T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } } };
 await controller.load(); await controller.assess(snapshot); decision = selectVisibleCustomerDecision(controller.getState(), owner, snapshot); assert(decision);
 const rendered = describePersonalDecision(decision.packet, decision.expectedBinding); assert.equal(rendered.kind, 'ready'); if (rendered.kind === 'ready') { assert.equal(rendered.action, 'COULD_WORK'); assert.match(rendered.primaryReason, /moisturizer.*dryness/i); }
 const factual = selectCustomerCheckFacts(snapshot, { brand: 'Mutated', name: 'Different current product', categoryLabel: 'unavailable', formula: null, source: null }); assert.equal(factual.name, snapshot.product?.name); assert.deepEqual(factual.formula?.ingredients, snapshot.formula?.ingredients);
 const summary = describeCanonicalMyStuff(controller.getState(), owner); assert.equal(summary.kind, 'ready'); if (summary.kind === 'ready') assert.equal(summary.primaryGoal, 'Dryness & barrier');
 controller.setOwner('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); assert.equal(controller.getState().context, null); assert.equal(selectVisibleCustomerDecision(controller.getState(), owner, snapshot), null);
});
test('unknown package facts give useful recovery and cannot acquire identity or personal advice from a current catalog card', () => {
 const copy = describeProductTruth(unresolvedProductTruth); assert.match(copy.nextAction, /barcode.*search/i); assert.match(copy.detail, /unknown.*unsafe/i);
 const facts = selectCustomerCheckFacts(unresolvedProductTruth, { brand: 'Candidate brand', name: 'Candidate product', categoryLabel: 'moisturizer', formula: { ingredients: ['Retinol'], provenanceType: 'unknown', observedAt: '2026-09-27' }, source: 'https://example.com' });
 assert.equal(facts.brand, 'Unconfirmed identity'); assert.equal(facts.formula, null); assert.equal(facts.source, null);
});
