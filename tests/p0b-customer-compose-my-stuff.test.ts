import assert from 'node:assert/strict';
import { describeCanonicalMyStuff, CustomerController } from '../src/presentation/personal-decision/customerController.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
const profile = createContextDraft(); profile.primaryGoal = { state: 'answered', value: 'dryness' }; profile.secondaryGoals = ['texture'];
const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: 'A', revision: 2, profile: { id: 'profile', ownerId: 'A', revision: 1, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: profileToStorage(profile) }, routine: null, experiences: [{ id: 'report', ownerId: 'A', revision: 2, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { id: 'stable-report', reference: { kind: 'manual', name: 'Cream' }, kind: 'no_reaction_reported', occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null } }], historyTruncated: true, historyRevision: 'report', legacy: { source: 'legacy_free_context', profile: { concerns: ['breakouts'] }, products: [], experiences: [{ kind: 'liked' }], truncated: false } };
const controller = new CustomerController({ load: async () => context, write: async () => { throw new Error('Unused'); }, evaluate: async () => ({ kind: 'unavailable', reason: 'Unused' }) }, () => 'request');
controller.setOwner('A'); assert.equal(describeCanonicalMyStuff(controller.getState(), 'A').kind, 'loading'); await controller.load();
const summary = describeCanonicalMyStuff(controller.getState(), 'A'); assert.equal(summary.kind, 'ready');
if (summary.kind === 'ready') { assert.equal(summary.primaryGoal, 'Dryness & barrier'); assert.deepEqual(summary.secondaryGoals, ['Texture']); assert.equal(summary.experienceSummary, '1 recent product experience; more are available.'); }
assert.equal(context.legacy.experiences[0].kind, 'liked'); assert.equal(context.experiences[0].data.kind, 'no_reaction_reported');
assert.equal(describeCanonicalMyStuff({ ...controller.getState(), status: 'loading' }, 'A').kind, 'loading');
assert.equal(describeCanonicalMyStuff(controller.getState(), 'B').kind, 'loading');
controller.setOwner('B'); assert.equal(describeCanonicalMyStuff(controller.getState(), 'B').kind, 'loading');
console.log('Canonical My Stuff profile/report readback overrides legacy without backfill or owner leaks');
