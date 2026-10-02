import assert from 'node:assert/strict';
import test from 'node:test';
import type { PersonalContextSnapshot, PersonalContextRequest, PersonalContextWriteResult } from '../src/contracts/PersonalContext.ts';
import { CustomerController, type CustomerGateway } from '../src/presentation/personal-decision/customerController.ts';
import { createSetupPersistence, setupBundleFromContext, setupWrites } from '../src/presentation/p0b-personalization/setupPersistence.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { addCurrentProduct, addPastOutcome, createSetupBundle, currentUseItem, manualUnverifiedReference, setAdditionalNote, setSetupAnswer, toggleCurrentFeedback } from '../src/presentation/p0b-personalization/setup.ts';
import { profileFromStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

const owner = '00000000-0000-4000-8000-000000000001';
let serial = 20;
const uuid = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
function empty(): PersonalContextSnapshot {
  return { version: 'personal-context-v1', ownerId: owner, revision: 0, profile: null, routine: null,
    experiences: [], historyRevision: null, historyTruncated: false,
    legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
}
function answers() {
  const profile = createContextDraft();
  profile.primaryGoal = { state: 'answered', value: 'dryness' };
  profile.secondaryGoals = ['breakouts'];
  profile.behavior = { state: 'answered', value: 'dry_tight' };
  profile.reactivity = { state: 'answered', value: 'reacts_easily' };
  let bundle = addCurrentProduct(createSetupBundle(owner), currentUseItem(uuid(), manualUnverifiedReference('My daily cream')));
  bundle = toggleCurrentFeedback(bundle, bundle.products[0].id, 'helpful');
  bundle = addPastOutcome(bundle, uuid(), manualUnverifiedReference('Old Spice Aqua Reef'), 'stung');
  return { profile, bundle };
}
function memory() {
  let stored = empty();
  const requests: Exclude<PersonalContextRequest, { operation: 'get_context' | 'get_revision' | 'get_experiences' }>[] = [];
  const applied = new Map<string, PersonalContextWriteResult>();
  let lostReport = false;
  let rejectReportOnce = false;
  const gateway: CustomerGateway = {
    load: async () => structuredClone(stored),
    async write(ownerId, request) {
      assert.equal(ownerId, owner); requests.push(structuredClone(request));
      const replay = applied.get(request.requestId);
      if (replay) return { ...replay, replayed: true };
      assert.equal(request.baseRevision, stored.revision);
      const data = request.operation === 'save_profile' ? request.profile : request.operation === 'save_routine' ? request.routine : request.experience;
      const revision = { id: uuid(), ownerId, revision: stored.revision + 1, recordedAt: '2026-10-01T12:00:00Z',
        provenance: 'self_report' as const, supersedesRevisionId: null, data };
      if (request.operation === 'save_profile') stored.profile = { ...revision, data: request.profile };
      if (request.operation === 'save_routine') stored.routine = { ...revision, data: request.routine };
      if (request.operation === 'append_experience') {
        assert.ok(!stored.experiences.some(item => item.data.id === request.experience.id), 'no duplicate experience');
        stored.experiences.push({ ...revision, data: request.experience }); stored.historyRevision = revision.id;
      }
      stored.revision = revision.revision;
      const result = { revision, replayed: false };
      applied.set(request.requestId, result);
      if (request.operation === 'append_experience' && rejectReportOnce && !lostReport) { lostReport = true; throw new Error('response lost after commit'); }
      return result;
    },
    evaluate: async () => ({ kind: 'unavailable', reason: 'not part of persistence test' }),
  };
  return { gateway, requests, read: () => structuredClone(stored), failFirstReport: () => { rejectReportOnce = true; } };
}

test('combined setup persists and a new controller reopens profile, routine and manual product problem', async () => {
  const db = memory(), controller = new CustomerController(db.gateway, uuid);
  controller.setOwner(owner); await controller.load();
  const input = answers(); const persistence = createSetupPersistence(controller, uuid);
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'saved');
  assert.deepEqual(db.requests.map(item => item.operation), ['save_profile', 'save_routine', 'append_experience', 'append_experience']);
  const reopened = new CustomerController(db.gateway, uuid); reopened.setOwner(owner); await reopened.load();
  const context = reopened.getState().context!;
  const profile = profileFromStorage(context.profile!.data);
  assert.deepEqual(profile.primaryGoal, { state: 'answered', value: 'dryness' });
  assert.deepEqual(profile.secondaryGoals, ['breakouts']);
  assert.deepEqual(profile.reactivity, { state: 'answered', value: 'reacts_easily' });
  assert.equal(context.routine!.data.items[0].reference.kind, 'manual');
  assert.equal(context.routine!.data.completeness, 'partial');
  assert.ok(context.experiences.some(item => item.data.reference.kind === 'manual' && item.data.reference.name === 'Old Spice Aqua Reef' && item.data.kind === 'reacted'));
  assert.deepEqual(context.experiences.find(item => item.data.reference.kind === 'manual' && item.data.reference.name === 'Old Spice Aqua Reef')!.data.symptoms, ['Stinging']);
  assert.deepEqual(context.profile!.data.sensitivities, { status: 'unanswered', values: [] });
});

test('a failed partial save retries the same request and does not duplicate earlier confirmed writes', async () => {
  const db = memory(); db.failFirstReport();
  const controller = new CustomerController(db.gateway, uuid); controller.setOwner(owner); await controller.load();
  const input = answers(), persistence = createSetupPersistence(controller, uuid);
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'failed');
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'saved');
  assert.equal(db.requests.filter(item => item.operation === 'save_profile').length, 1);
  assert.equal(db.requests.filter(item => item.operation === 'save_routine').length, 1);
  const reports = db.requests.filter(item => item.operation === 'append_experience');
  assert.equal(reports[0].requestId, reports[1].requestId);
  assert.equal(db.read().experiences.length, 2);
});

test('unknown and absent routine answers do not become an explicitly empty routine', () => {
  const profile = createContextDraft();
  const absent = setupWrites(owner, profile, createSetupBundle(owner), empty(), uuid)!;
  assert.equal(absent.some(item => item.operation === 'save_routine'), false);
  const unknown = setupWrites(owner, profile, setSetupAnswer(createSetupBundle(owner), 'currentProducts', 'unknown'), empty(), uuid)!;
  const none = setupWrites(owner, profile, setSetupAnswer(createSetupBundle(owner), 'currentProducts', 'none'), empty(), uuid)!;
  assert.equal(unknown.find(item => item.operation === 'save_routine')?.routine.completeness, 'unknown');
  assert.equal(none.find(item => item.operation === 'save_routine')?.routine.completeness, 'complete');
  assert.equal(none[0].operation === 'save_profile' && none[0].profile.reactivity, 'unanswered');
});

test('setup merges without deleting existing routine and never treats a general note or texture dislike as an allergy', () => {
  const input = answers(); const context = empty();
  context.routine = { id: uuid(), ownerId: owner, revision: 1, recordedAt: 'now', provenance: 'self_report', supersedesRevisionId: null,
    data: { completeness: 'partial', items: [{ id: uuid(), reference: { kind: 'manual', name: 'Already saved sunscreen' }, state: 'current', timing: 'am', frequency: { kind: 'unknown' }, startedOn: null, stoppedOn: null, duration: null }] } };
  let bundle = setAdditionalNote(input.bundle, 'I think everything is a fragrance allergy');
  bundle = toggleCurrentFeedback(bundle, bundle.products[0].id, 'too_heavy');
  const writes = setupWrites(owner, input.profile, bundle, context, uuid)!;
  assert.equal(writes.find(item => item.operation === 'save_routine')?.routine.items.length, 2);
  assert.doesNotMatch(JSON.stringify(writes), /fragrance allergy|too_heavy/);
  assert.equal(writes.filter(item => item.operation === 'append_experience').length, 2);
});

test('owner switch during a write stops all remaining setup writes', async () => {
  const input = answers(); let currentOwner: string | null = owner; let release!: (value: boolean) => void;
  let calls = 0;
  const persistence = createSetupPersistence({ getState: () => ({ ownerId: currentOwner, context: currentOwner === owner ? empty() : null }),
    save: async () => { calls++; return new Promise(resolve => { release = resolve; }); } }, uuid);
  const pending = persistence.save(owner, input.profile, input.bundle, () => currentOwner === owner);
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'busy');
  currentOwner = null; release(true);
  assert.equal(await pending, 'owner_changed'); assert.equal(calls, 1);
});

test('live four-step setup emits saved bundle and has no unsupported general note step', () => {
  let output: ReturnType<typeof createSetupBundle> | undefined;
  const flow = componentHarness('src/components/p0b-personalization/ContextFlow.tsx', 'ContextFlow', {
    ownerId: owner, setup: true, persistentSetup: true, collectIntent: false, completionLabel: 'Save answers', createId: uuid,
    onSetup: (bundle: ReturnType<typeof createSetupBundle>) => { output = bundle; }, onApply() {}, onSkip() {},
  });
  assert.match(textContent(flow.render()), /Step\s+1\s+of\s+4/);
  press(control(flow.render(), 'Dryness')); press(control(flow.render(), 'Continue'));
  press(control(flow.render(), 'Yes, often')); press(control(flow.render(), 'Continue'));
  assert.doesNotMatch(textContent(flow.render()), /Preview only/);
  press(control(flow.render(), 'Search products')); press(control(flow.render(), 'How’s it working for you?'));
  assert.ok(!flow.render().some(node => node.props.label === 'Too heavy'));
  press(control(flow.render(), 'Stung')); press(control(flow.render(), 'Continue'));
  assert.doesNotMatch(textContent(flow.render()), /Preview reports/);
  press(control(flow.render(), 'Search products')); press(control(flow.render(), 'Broke out'));
  press(control(flow.render(), 'Save answers'));
  assert.equal(output?.products.length, 1); assert.equal(output?.experiences.length, 1);
  assert.equal(output?.additionalNote, null);
  assert.ok(!flow.render().some(node => node.props.accessibilityLabel === 'Anything else'));
});

test('unmounted editor cannot continue writes even if owner did not change', async () => {
  const input = answers(); let active = true; let release!: (value: boolean) => void; let calls = 0;
  const persistence = createSetupPersistence({ getState: () => ({ ownerId: owner, context: empty() }),
    save: async () => { calls++; return new Promise(resolve => { release = resolve; }); } }, uuid);
  const pending = persistence.save(owner, input.profile, input.bundle, () => active);
  active = false; release(true);
  assert.equal(await pending, 'owner_changed'); assert.equal(calls, 1);
});

test('confirmed write with failed readback does not navigate or replay that step after recovery', async () => {
  const input = answers(); let context: PersonalContextSnapshot | null = empty(); let calls = 0;
  const persistence = createSetupPersistence({ getState: () => ({ ownerId: owner, context }),
    save: async () => { calls++; if (calls === 1) context = null; return true; } }, uuid);
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'failed');
  assert.equal(calls, 1);
  context = empty(); // Host retries readback before continuing the same submitted draft.
  assert.equal(await persistence.save(owner, input.profile, input.bundle, () => true), 'saved');
  assert.equal(calls, 4, 'profile was already confirmed; only routine and two reports remain');
});

test('existing profile uses the combined flow, retains initial answers and reopens saved routine', async () => {
  const db = memory(), controller = new CustomerController(db.gateway, uuid);
  controller.setOwner(owner); await controller.load();
  const input = answers(), saver = createSetupPersistence(controller, uuid);
  await saver.save(owner, input.profile, input.bundle, () => true);
  const context = controller.getState().context!;
  const initialSetup = setupBundleFromContext(owner, context);
  let applied: ReturnType<typeof createContextDraft> | undefined;
  let submitted: ReturnType<typeof createSetupBundle> | undefined;
  const flow = componentHarness('src/components/p0b-personalization/ContextFlow.tsx', 'ContextFlow', {
    ownerId: owner, initialDraft: profileFromStorage(context.profile!.data), initialSetup,
    setup: true, persistentSetup: true, collectIntent: false, completionLabel: 'Save answers', createId: uuid,
    onSetup: (bundle: ReturnType<typeof createSetupBundle>) => { submitted = bundle; },
    onApply: (draft: ReturnType<typeof createContextDraft>) => { applied = draft; }, onSkip() {},
  });
  assert.match(textContent(flow.render()), /Step\s+1\s+of\s+4/);
  assert.equal(control(flow.render(), 'Dryness').props.accessibilityState.checked, true);
  press(control(flow.render(), 'Continue'));
  assert.equal(control(flow.render(), 'Yes, often').props.selected, true);
  press(control(flow.render(), 'Continue'));
  assert.match(textContent(flow.render()), /My daily cream/);
  assert.ok(!flow.render().some(node => node.props.label === 'Remove My daily cream'));
  press(control(flow.render(), 'Continue')); press(control(flow.render(), 'Save answers'));
  assert.equal(submitted?.products.length, 1);
  assert.equal(submitted?.experiences.length, 0, 'existing problems are kept, not blindly re-appended');
  assert.deepEqual(applied?.primaryGoal, input.profile.primaryGoal);
  const reopenedWrites = setupWrites(owner, applied!, submitted!, context, uuid)!;
  assert.equal(reopenedWrites.filter(item => item.operation === 'append_experience').length, 0);
  assert.equal(reopenedWrites.find(item => item.operation === 'save_routine')?.routine.items.length, 1);
});

test('a mismatched-owner initial routine never enters combined setup', () => {
  const context = empty(); context.ownerId = 'someone else';
  assert.deepEqual(setupBundleFromContext(owner, context).products, []);
  assert.equal(setupWrites(owner, createContextDraft(), createSetupBundle(owner), context, uuid), null);
});
