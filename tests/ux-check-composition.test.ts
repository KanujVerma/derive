import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCheckContentInput, selectCurrentCheckDecision, describeCheckLinkNotice } from '../src/presentation/check/result-sheet/composition.ts';
import { describeCheckResultContent } from '../src/presentation/check/result-sheet/content.ts';
import { CustomerController } from '../src/presentation/personal-decision/customerController.ts';
import { evaluateDecisionRequest, type DecisionDependencies, type SavedAssessment } from '../supabase/functions/personal-decision/handler.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const snapshot = fixtureSnapshot();
const draft = createContextDraft();
draft.intent = { state: 'answered', value: 'add' };
draft.primaryGoal = { state: 'answered', value: 'dryness' };
draft.behavior = { state: 'answered', value: 'dry_tight' };
draft.reactivity = { state: 'answered', value: 'generally_tolerates' };
draft.treatments = { state: 'answered', value: [] };
draft.sensitivities = { state: 'answered', value: [] };
const context: PersonalContextSnapshot = {
  version: 'personal-context-v1', ownerId: owner, revision: 2,
  profile: { id: '77777777-7777-4777-8777-777777777777', ownerId: owner, revision: 1, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: profileToStorage(draft) },
  routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } },
  historyRevision: null, historyTruncated: false, experiences: [],
  legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false },
};
const saved = new Map<string, SavedAssessment>();
const dependencies: DecisionDependencies = {
  runtime: 'authoritative', now: () => '2026-09-26T00:00:00Z', verifyCaseOwner: async () => true,
  readSnapshot: async () => ({ snapshot, category: { state: 'known', value: 'moisturizer', sourceIds: ['category-source'] }, categorySources: [{ id: 'category-source', revision: '1' }], categoryBoundaryRevision: 'category-v1' }),
  readContext: async () => context, readHistory: async (_owner, atRevision) => ({ items: [], nextCursor: null, atRevision }), readRoutineFacts: async () => [], readAssessment: async (_owner, id) => saved.get(id) ?? null,
  persist: async (_owner, id, input, packet) => { const assessmentId = '66666666-6666-4666-8666-666666666666'; saved.set(id, { assessmentId, input, packet }); return { assessmentId, packet, replayed: false }; },
};
const controller = new CustomerController({ load: async () => context, write: async () => { throw new Error('Unused'); }, evaluate: (ownerId, request) => evaluateDecisionRequest(ownerId, request, dependencies) }, () => '99999999-9999-4999-8999-999999999999');
controller.setOwner(owner);
await controller.load();
await controller.assess(snapshot);
const state = controller.getState();
assert.equal(state.decision.kind, 'ready');
const facts = { brand: 'Mutable', name: 'Changed', categoryLabel: 'treatment', formula: null, source: null };
const base = { ownerId: owner, snapshot, catalogFacts: facts, customerState: state, preview: false, legacyState: { kind: 'factual_only' as const } };

test('the host uses independently loaded context binding and immutable facts for shared content', () => {
  const input = selectCheckContentInput(base);
  assert.equal(input.fit.kind, 'canonical');
  assert.notEqual(input.fit.kind === 'canonical' && input.fit.expectedBinding, state.decision.kind === 'ready' && state.decision.packet.binding);
  const model = describeCheckResultContent(input);
  assert.equal(model.outcome.kind, 'supported');
  assert.equal(model.facts.name, snapshot.product!.name);
});

test('new context, owner, snapshot or formula invalidates the rendered action before navigation', () => {
  if (state.decision.kind !== 'ready') throw new Error('Missing fixture decision');
  const rendered = state.decision;
  assert.equal(selectCurrentCheckDecision(state, owner, snapshot, rendered)?.packet.id, rendered.packet.id);
  for (const changed of [
    { state: { ...state, context: { ...context, revision: 3 } }, owner, snapshot },
    { state, owner: 'another-owner', snapshot },
    { state, owner, snapshot: { ...snapshot, snapshotId: 'different-snapshot' } },
    { state, owner, snapshot: { ...snapshot, caseRevision: 2 } },
    { state, owner, snapshot: { ...snapshot, formula: { ...snapshot.formula!, formulaVersionId: 'changed-formula' } } },
    { state: { ...state, status: 'loading' as const }, owner, snapshot },
  ]) assert.equal(selectCurrentCheckDecision(changed.state, changed.owner, changed.snapshot, rendered), null);
});

test('a preview can show catalog facts while creating no snapshot or decision authority', () => {
  const input = selectCheckContentInput({ ...base, ownerId: null, snapshot: null, preview: true });
  assert.equal(input.snapshot, null);
  assert.equal(input.fit.kind, 'preview_unavailable');
  const model = describeCheckResultContent(input);
  assert.equal(model.facts.name, 'Changed');
  assert.equal(model.canPersonalize, false);
});

test('unknown or failed canonical context never reveals an older legacy personal answer', () => {
  const legacyState = { kind: 'supported' as const, fit: { label: 'COULD WORK' as const, explanation: 'Old advice', evidenceUsed: [], uncertainty: null } };
  for (const status of ['loading', 'error'] as const) {
    const input = selectCheckContentInput({ ...base, legacyState, customerState: { ...state, status, context: null, decision: { kind: 'idle' } } });
    const model = describeCheckResultContent(input);
    assert.equal(model.outcome.kind, status === 'loading' ? 'loading' : 'service_failure');
    assert.doesNotMatch(model.outcome.reason, /Old advice/);
    assert.equal(model.canPersonalize, false);
  }
});


test('a regulatory label title stays a candidate with no product or formula authority', () => {
  const notice = describeCheckLinkNotice({ status: 'label_candidate', nextAction: 'confirm_package', candidate: {
    source: 'dailymed_spl', sourceRecordId: '11111111-1111-4111-8111-111111111111', sourceVersion: 2,
    title: 'Synthetic label title', publishedDate: '2026-09-29', sourceUrl: 'https://dailymed.nlm.nih.gov/example',
    retrievedAt: '2026-09-29T00:00:00Z', identityStatus: 'label_title_only',
  } });
  assert.ok(notice);
  assert.equal(notice.title, 'Synthetic label title');
  assert.match(notice.detail, /has not confirmed the exact product or formula/);
  assert.equal(notice.source, 'https://dailymed.nlm.nih.gov/example');
  assert.equal('snapshot' in notice, false);
  assert.equal('fit' in notice, false);
});

test('unsupported link details preserve the source limitation without a personal result', () => {
  const notice = describeCheckLinkNotice({ status: 'needs_details', source: 'amazon', reason: 'Listing is insufficient.', nextAction: 'search_or_photo' });
  assert.deepEqual(notice, { title: 'Product details needed', detail: 'Listing is insufficient.', source: null });
});
