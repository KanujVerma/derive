import assert from 'node:assert/strict';
import { profileFromStorage, profileToStorage, routineFromStorage, routineToStorage, experienceFromStorage, experienceToStorage, catalogReferenceKey, contextProductLabel } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { createContextDraft, manualRoutineItem } from '../src/presentation/p0b-personalization/draft.ts';
const draft = createContextDraft(); draft.treatments = { state: 'unsure' }; draft.sensitivities = { state: 'withheld' };
assert.equal(profileToStorage(draft).treatments.status, 'unsure');
assert.deepEqual(profileToStorage(profileFromStorage(profileToStorage(draft))), profileToStorage(draft));
const routine = { completeness: 'partial' as const, items: [{ ...manualRoutineItem('00000000-0000-4000-8000-000000000001', 'Cream'), status: 'current' as const }] };
assert.equal(routineToStorage(routine).items[0].startedOn, null);
assert.deepEqual(routineToStorage(routineFromStorage(routineToStorage(routine))), routineToStorage(routine));
const stored = { id: routine.items[0].id, reference: { kind: 'manual' as const, name: 'Cream', brand: 'Known brand' }, kind: 'no_reaction_reported' as const, occurred: { start: null, end: null }, useContext: { timing: 'pm' as const, frequency: { kind: 'exact' as const, count: 2, unit: 'week' as const }, startedOn: '2026-01-01', stoppedOn: null, duration: { count: 2, unit: 'months' as const } }, symptoms: [], note: null };
const edited = experienceFromStorage(stored);
assert.deepEqual(experienceToStorage(edited), stored);
if (edited.useContext?.duration) edited.useContext.duration.count = 4;
assert.equal(stored.useContext.duration.count, 2);
console.log('P0-B storage adapter round trips passed');
for (const state of ['unanswered', 'withheld', 'unsure'] as const) {
  const value = createContextDraft(); value.treatments = { state }; value.sensitivities = { state };
  const storedProfile = profileToStorage(value);
  assert.equal(profileFromStorage(storedProfile).treatments.state, state);
  assert.equal(profileFromStorage(storedProfile).sensitivities.state, state);
}
for (const reproductive of ['yes', 'no', 'unsure', 'unanswered', 'withheld'] as const) {
  const value = createContextDraft();
  const answer = reproductive === 'unanswered' || reproductive === 'withheld' ? { state: reproductive } : { state: 'answered' as const, value: reproductive };
  value.pregnancy = answer; value.trying = answer; value.nursing = answer;
  const storedProfile = profileToStorage(value);
  assert.equal(storedProfile.reproductive.pregnancy, reproductive);
  assert.equal(storedProfile.reproductive.tryingToConceive, reproductive);
  assert.equal(storedProfile.reproductive.nursing, reproductive);
}
for (const unit of ['day', 'week', 'month'] as const) {
  const exact = { ...routine, items: [{ ...routine.items[0], frequency: { kind: 'exact' as const, count: 2, unit }, startedOn: '2026-01-01', stoppedOn: '2026-02-01', duration: { count: 4, unit: 'weeks' as const } }] };
  assert.deepEqual(routineToStorage(routineFromStorage(routineToStorage(exact))), routineToStorage(exact));
}
const catalogReferences = [{ kind: 'catalog' as const, productId: 'product-a', variantId: null, formulaVersionId: null }, { kind: 'catalog' as const, productId: 'product-b', variantId: null, formulaVersionId: null }];
const labels = { [catalogReferenceKey(catalogReferences[0])]: 'Current name: Brand A Cream', [catalogReferenceKey(catalogReferences[1])]: 'Current name: Brand B Cleanser' };
assert.notEqual(contextProductLabel(catalogReferences[0], labels), contextProductLabel(catalogReferences[1], labels));
assert.equal(contextProductLabel(catalogReferences[0], {}), 'Saved product 1 (name unavailable)');
assert.equal(contextProductLabel(catalogReferences[1], {}, 2), 'Saved product 2 (name unavailable)');
