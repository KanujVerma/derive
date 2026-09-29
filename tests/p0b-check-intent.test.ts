import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDecisionRequest, parseDecisionRequest, DecisionServiceError } from '../supabase/functions/personal-decision/handler.ts';
import type { DecisionDependencies, SavedAssessment } from '../supabase/functions/personal-decision/handler.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import { CustomerController, selectVisibleCustomerDecision } from '../src/presentation/personal-decision/customerController.ts';
import { personalDecisionPacketSchema } from '../src/presentation/personal-decision/parse.ts';
import { validatePersonalDecisionPacket } from '../src/contracts/PersonalDecision.ts';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const snapshot = fixtureSnapshot();
function setup() {
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: owner, revision: 2,
    profile: { id: '77777777-7777-4777-8777-777777777777', ownerId: owner, revision: 1, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null,
      data: { intent: 'add', primaryGoal: 'dryness', secondaryGoals: [], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates', reproductive: { pregnancy: 'no', nursing: 'no', tryingToConceive: 'no' }, sensitivities: { status: 'none_known', values: [] }, treatments: { status: 'none', values: [] } } },
    routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } }, experiences: [], historyRevision: null, historyTruncated: false, legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
  const saved = new Map<string, SavedAssessment>();
  const deps: DecisionDependencies = { runtime: 'authoritative', now: () => '2026-09-26T00:00:00Z', verifyCaseOwner: async () => true,
    readSnapshot: async (_owner, request) => ({ snapshot: { ...snapshot, resolutionCaseId: request.caseId, snapshotId: request.snapshotId }, category: { state: 'known', value: 'moisturizer', sourceIds: ['category'] }, categorySources: [{ id: 'category', revision: '1' }] }),
    readContext: async () => context, readHistory: async (_owner, atRevision) => ({ items: [], nextCursor: null, atRevision }), readRoutineFacts: async () => [], readAssessment: async (_owner, id) => saved.get(id) ?? null,
    persist: async (_owner, id, input, packet) => { saved.set(id, { assessmentId: '66666666-6666-4666-8666-666666666666', input, packet }); return { assessmentId: '66666666-6666-4666-8666-666666666666', packet, replayed: false }; } };
  const request = { operation: 'evaluate' as const, requestId: '99999999-9999-4999-8999-999999999999', caseId: snapshot.resolutionCaseId, snapshotId: snapshot.snapshotId };
  return { context, saved, deps, request };
}

test('missing Check intent cannot inherit any saved profile intent', async () => {
  for (const intent of ['add', 'replace', 'check_current', 'unanswered', 'withheld'] as const) {
    const { context, deps, request } = setup(); context.profile!.data.intent = intent;
    const response = await evaluateDecisionRequest(owner, request, deps);
    assert.equal(response.packet.action.kind, 'NOT_ENOUGH_INFORMATION');
    assert.equal(response.expectedBinding.checkIntent, 'unanswered');
    assert(response.packet.evidenceNeeds.some(need => need.code === 'profile_context' && need.critical && need.state === 'unknown'));
    assert.equal(context.profile!.data.intent, intent);
  }
});

test('explicit Check intent overrides saved profile intent and is frozen in persisted input', async () => {
  const { context, deps, request, saved } = setup(); context.profile!.data.intent = 'withheld';
  const response = await evaluateDecisionRequest(owner, { ...request, checkIntent: 'add' }, deps);
  assert.equal(response.packet.action.kind, 'COULD_WORK');
  assert.equal(response.expectedBinding.checkIntent, 'add');
  assert.equal(saved.get(request.requestId)!.input.request.checkIntent, 'add');
  assert.equal(context.profile!.data.intent, 'withheld');
});

test('intent parsing preserves unanswered and withheld while rejecting unsupported input', () => {
  const { request } = setup();
  assert.equal(parseDecisionRequest(request).checkIntent, 'unanswered');
  for (const checkIntent of ['add', 'replace', 'check_current', 'unanswered', 'withheld']) assert.equal(parseDecisionRequest({ ...request, checkIntent }).checkIntent, checkIntent);
  for (const checkIntent of [null, '', 'use', 'unsure', false, {}]) assert.throws(() => parseDecisionRequest({ ...request, checkIntent }), error => error instanceof DecisionServiceError && error.code === 'INVALID_PAYLOAD');
});

test('same request changed Check intent conflicts and unchanged intent replays frozen assessment', async () => {
  const { deps, request, context } = setup();
  const first = await evaluateDecisionRequest(owner, { ...request, checkIntent: 'add' }, deps);
  await assert.rejects(() => evaluateDecisionRequest(owner, { ...request, checkIntent: 'replace' }, deps), error => error instanceof DecisionServiceError && error.code === 'IDEMPOTENCY_CONFLICT');
  context.profile!.data.intent = 'replace'; context.revision++;
  const replay = await evaluateDecisionRequest(owner, { ...request, checkIntent: 'add' }, deps);
  assert.equal(replay.replayed, true); assert.deepEqual(replay.packet, first.packet);
});

test('legacy assessment remains unchanged and cannot become a current receipt', async () => {
  const { deps, request, saved } = setup(); await evaluateDecisionRequest(owner, { ...request, checkIntent: 'add' }, deps);
  const old = saved.get(request.requestId)!; delete (old.packet.binding as any).checkIntent; delete (old.input.expectedBinding as any).checkIntent; delete (old.input.request as any).checkIntent;
  const before = JSON.stringify(old);
  assert.equal(personalDecisionPacketSchema.safeParse(old.packet).success, false);
  assert(validatePersonalDecisionPacket(old.packet, old.input.expectedBinding).includes('binding_mismatch'));
  await assert.rejects(() => evaluateDecisionRequest(owner, request, deps), error => error instanceof DecisionServiceError && error.code === 'ASSESSMENT_UNAVAILABLE');
  assert.equal(JSON.stringify(old), before);
});

test('packet intent mismatch fails integrity against independent expected binding', async () => {
  const { deps, request } = setup(); const response = await evaluateDecisionRequest(owner, { ...request, checkIntent: 'add' }, deps);
  assert(validatePersonalDecisionPacket(response.packet, { ...response.expectedBinding, checkIntent: 'replace' }).includes('binding_mismatch'));
});

test('same-case context edits retain Check intent while new cases and owners start unanswered', async () => {
  const { context } = setup(); const calls: any[] = [];
  let id = 0;
  const controller = new CustomerController({ load: async currentOwner => ({ ...context, ownerId: currentOwner, profile: { ...context.profile!, ownerId: currentOwner }, routine: { ...context.routine!, ownerId: currentOwner } }), write: async () => { throw new Error('unused'); }, evaluate: async (_owner, request) => { calls.push(request); return { kind: 'unavailable', reason: 'response loss' }; } }, () => `request-${++id}`);
  controller.setOwner(owner); await controller.load();
  await controller.assess(snapshot, 'replace'); await controller.assess(snapshot);
  assert.equal(calls[0].checkIntent, 'replace'); assert.equal(calls[1].checkIntent, 'replace'); assert.equal(calls[0].requestId, calls[1].requestId);
  context.revision++; await controller.load(); await controller.assess(snapshot); assert.equal(calls[2].checkIntent, 'replace'); assert.notEqual(calls[1].requestId, calls[2].requestId);
  await controller.assess(snapshot, 'check_current'); assert.equal(calls[3].checkIntent, 'check_current'); assert.notEqual(calls[2].requestId, calls[3].requestId);
  await controller.assess({ ...snapshot, resolutionCaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }); assert.equal(calls[4].checkIntent, 'unanswered');
  controller.setOwner('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); await controller.load(); await controller.assess(snapshot); assert.equal(calls[5].checkIntent, 'unanswered');
  await controller.assess(snapshot, 'add'); controller.setOriginSnapshot(owner, snapshot);
  assert.equal(controller.getState().checkIntent, 'add', 'A stale origin callback cannot clear the next owner Check intent');
});

test('client refuses a server receipt bound to a different intent even when packet agrees', async () => {
  const { context, deps } = setup(); let id = 0;
  const controller = new CustomerController({ load: async () => context, write: async () => { throw new Error('unused'); }, evaluate: (currentOwner, request) => evaluateDecisionRequest(currentOwner, { ...request, checkIntent: 'replace' }, deps) }, () => `99999999-9999-4999-8999-${String(++id).padStart(12, '0')}`);
  controller.setOwner(owner); await controller.load(); await controller.assess(snapshot, 'add');
  assert.equal(controller.getState().decision.kind, 'unavailable'); assert.equal(selectVisibleCustomerDecision(controller.getState(), owner, snapshot), null);
});
