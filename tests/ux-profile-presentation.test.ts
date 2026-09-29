import assert from 'node:assert/strict';
import { manualRoutineItem, validateRoutineDraft, createRoutineDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { routineToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';

const id = '00000000-0000-4000-8000-000000000001';
const fresh = manualRoutineItem(id, '  My moisturizer  ');
assert.equal(fresh.status, null, 'Adding a name must not report that the product is currently used');
assert.equal(fresh.reference.label, 'My moisturizer');
const pending = { completeness: 'partial' as const, items: [fresh] };
assert.equal(validateRoutineDraft(pending), 'Choose a use status for each product.');
assert.throws(() => routineToStorage(pending), /Choose a use status/);
for (const status of ['current', 'paused', 'stopped', 'occasional'] as const) {
  const confirmed = { ...pending, items: [{ ...fresh, status }] };
  assert.equal(validateRoutineDraft(confirmed), null);
  assert.equal(routineToStorage(confirmed).items[0].state, status);
}
const existing = createRoutineDraft({ completeness: 'complete', items: [{ ...fresh, status: 'stopped' }] });
assert.equal(existing.items[0].status, 'stopped', 'Editing must retain the reported state');
console.log('UX profile explicit routine-use status passed');
