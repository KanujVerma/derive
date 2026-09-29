import assert from 'node:assert/strict';
import { deriveJitReproductiveQuestions, deriveProfileEditQuestions } from '../src/presentation/personal-decision/customerController.ts';
import { evaluateDecisionRequest } from '../supabase/functions/personal-decision/handler.ts';
import type { DecisionDependencies } from '../supabase/functions/personal-decision/handler.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage, profileFromStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import type { PersonalProfileInput, PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const draft = createContextDraft(); draft.intent = { state: 'answered', value: 'add' }; draft.primaryGoal = { state: 'answered', value: 'dryness' }; draft.behavior = { state: 'answered', value: 'dry_tight' }; draft.reactivity = { state: 'answered', value: 'generally_tolerates' }; draft.treatments = { state: 'answered', value: [] }; draft.sensitivities = { state: 'answered', value: [] };
async function evaluate(reproductive = profileToStorage(draft).reproductive, formulaKnown = true, retinoid = true) {
  const snapshot = fixtureSnapshot(); if (retinoid) snapshot.formula!.ingredients = ['Retinol', 'Glycerin']; if (!formulaKnown) snapshot.formula!.appliesToSelectedVariant = false;
  const profile = { ...profileToStorage(draft), reproductive };
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: owner, revision: 2, profile: { id: '77777777-7777-4777-8777-777777777777', ownerId: owner, revision: 1, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: profile }, routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: '2026-09-26T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } }, historyRevision: null, historyTruncated: false, experiences: [], legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
  const deps: DecisionDependencies = { runtime: 'authoritative', now: () => '2026-09-26T00:00:00Z', verifyCaseOwner: async () => true, readSnapshot: async () => ({ snapshot, category: { state: 'known', value: 'moisturizer', sourceIds: ['category'] }, categorySources: [{ id: 'category', revision: '1' }], categoryBoundaryRevision: '1' }), readContext: async () => context, readHistory: async (_o, atRevision) => ({ items: [], nextCursor: null, atRevision }), readRoutineFacts: async () => [], readAssessment: async () => null, persist: async (_o, _id, _input, packet) => ({ assessmentId: '66666666-6666-4666-8666-666666666666', packet, replayed: false }) };
  // Actual handler with deterministic semantic providers, not live authority evidence.
  return { response: await evaluateDecisionRequest(owner, { operation: 'evaluate', requestId: '99999999-9999-4999-8999-999999999999', caseId: snapshot.resolutionCaseId, snapshotId: snapshot.snapshotId }, deps), context };
}
const allUnknown = await evaluate();
assert.deepEqual(deriveJitReproductiveQuestions(allUnknown.response.packet, allUnknown.response.expectedBinding, allUnknown.context), ['pregnancy', 'trying', 'nursing']);
const tryingOnly = await evaluate({ pregnancy: 'no', nursing: 'no', tryingToConceive: 'unanswered' });
assert.deepEqual(deriveJitReproductiveQuestions(tryingOnly.response.packet, tryingOnly.response.expectedBinding, tryingOnly.context), ['trying']);
const withheld = await evaluate({ pregnancy: 'no', nursing: 'no', tryingToConceive: 'withheld' });
assert.deepEqual(deriveJitReproductiveQuestions(withheld.response.packet, withheld.response.expectedBinding, withheld.context), ['trying']);
const knownTrying = await evaluate({ pregnancy: 'no', nursing: 'no', tryingToConceive: 'yes' });
assert.deepEqual(deriveJitReproductiveQuestions(knownTrying.response.packet, knownTrying.response.expectedBinding, knownTrying.context), [], 'a known answer cannot repair missing reviewed guidance through another question');
assert.deepEqual(deriveProfileEditQuestions(knownTrying.context.profile!.data, [], []).reproductive, ['pregnancy', 'trying', 'nursing'], 'previously shared answers remain editable');
for (const result of [await evaluate(undefined, false), await evaluate(undefined, true, false)]) assert.deepEqual(deriveJitReproductiveQuestions(result.response.packet, result.response.expectedBinding, result.context), []);
assert.deepEqual(deriveProfileEditQuestions(null, [], []), { reproductive: [], context: [] });
assert.deepEqual(deriveProfileEditQuestions(profileToStorage(createContextDraft()), [], []), { reproductive: [], context: [] });
const existing: PersonalProfileInput = { ...profileToStorage(draft), reproductive: { pregnancy: 'no', nursing: 'unanswered', tryingToConceive: 'unanswered' }, treatments: { status: 'reported', values: ['topical_retinoid'] }, sensitivities: { status: 'none_known', values: [] } };
assert.deepEqual(deriveProfileEditQuestions(existing, [], []), { reproductive: ['pregnancy'], context: ['treatments', 'sensitivities'] });
const edited = profileFromStorage(existing); edited.pregnancy = { state: 'answered', value: 'yes' }; edited.treatments = { state: 'answered', value: [] }; edited.sensitivities = { state: 'answered', value: ['Niacinamide'] };
const stored = profileToStorage(edited); assert.equal(stored.reproductive.pregnancy, 'yes'); assert.deepEqual(stored.treatments, { status: 'none', values: [] }); assert.deepEqual(stored.sensitivities, { status: 'reported', values: ['Niacinamide'] });
console.log('Actual engine JIT relevance and existing sensitive-answer editability passed');
