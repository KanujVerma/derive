import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLabelDraft } from '../src/presentation/part-one/capture.ts';
import { resumeLocalCapture } from '../src/presentation/part-one/captureFlow.ts';
const binding = { ownerId: 'owner', scanId: 'scan', sheetSessionId: 'scan', generation: 0, captureSessionId: 'capture', packageObservationId: 'package', itemId: 'item', candidateId: null, deletionEpoch: 0 };
const result = { scanId: 'scan', generation: 0, itemId: 'item' };
test('Remove draft then reopen requests a fresh server capture instead of reusing a dead binding', () => {
  const draft = new MemoryLabelDraft(); draft.begin(binding, 71); draft.remove();
  assert.equal(resumeLocalCapture(draft, binding, 'owner', result, 71), null);
  const next = { ...binding, captureSessionId: 'new-capture', packageObservationId: 'new-package' };
  draft.begin(next, 71); assert.notEqual(draft.addPhoto(next, 'photo', 'file:///fixture.img'), 'cap_reached'); draft.remove();
});
test('Inactive draft reopen requests fresh capture; ordinary back resumes its current draft', () => {
  let now = 0; const draft = new MemoryLabelDraft(() => now); draft.begin(binding, 71);
  assert.deepEqual(resumeLocalCapture(draft, binding, 'owner', result, 71), binding);
  now = 30 * 60 * 1000;
  assert.equal(resumeLocalCapture(draft, binding, 'owner', result, 71), null); draft.remove();
});
test('Late old-owner or old-generation capture callbacks cannot resume or erase current draft', () => {
  const draft = new MemoryLabelDraft(); const current = { ...binding, ownerId: 'new-owner', generation: 1 };
  draft.begin(current, 0);
  assert.equal(resumeLocalCapture(draft, binding, 'new-owner', { ...result, generation: 1 }, 0), null);
  assert(draft.read(current)); draft.remove();
});

test('An account or product change removes private capture from the first render before effect cleanup', async () => {
  const { captureMatchesCurrentResult } = await import('../src/presentation/part-one/captureFlow.ts');
  assert.equal(captureMatchesCurrentResult(binding, 'other-owner', result), false);
  assert.equal(captureMatchesCurrentResult(binding, 'owner', { ...result, generation: 1 }), false);
  assert.equal(captureMatchesCurrentResult(binding, 'owner', { ...result, itemId: 'different-item' }), false);
  assert.equal(captureMatchesCurrentResult(binding, 'owner', null), false);
  assert.equal(captureMatchesCurrentResult(binding, 'owner', result), true);
});
