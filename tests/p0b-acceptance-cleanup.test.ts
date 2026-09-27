import assert from 'node:assert/strict';
import { attemptOwnedCleanup } from '../scripts/acceptance/p0b/cleanup.ts';

// Catches an early failed deletion aborting later deletions or absence checks.
for (const failureIndex of [0, 2]) {
  const attempts: string[] = [];
  const deletions = ['user-a', 'user-b', 'identifier', 'formula', 'variant', 'product'].map((label, index) => ({ label, run: async () => { attempts.push(label); if (index === failureIndex) throw new Error('private-provider-detail-do-not-expose'); } }));
  const checks = ['absence-a', 'absence-b', 'absence-product'].map(label => ({ label, run: async () => { attempts.push(label); } }));
  await assert.rejects(() => attemptOwnedCleanup(deletions, checks), error => {
    assert(error instanceof Error); assert.match(error.message, /Owned acceptance cleanup failed/);
    assert(error.message.includes(deletions[failureIndex].label));
    assert(!error.message.includes('private-provider-detail'));
    return true;
  });
  assert.deepEqual(attempts, ['user-a', 'user-b', 'identifier', 'formula', 'variant', 'product', 'absence-a', 'absence-b', 'absence-product']);
}

// Catches failure in an independent absence query skipping reachable later queries.
const attempts: string[] = [];
await assert.rejects(() => attemptOwnedCleanup(
  [{ label: 'delete', run: async () => { attempts.push('delete'); } }],
  [{ label: 'first absence', run: async () => { attempts.push('first absence'); throw new Error('query transport failed'); } }, { label: 'last absence', run: async () => { attempts.push('last absence'); } }],
), /first absence/);
assert.deepEqual(attempts, ['delete', 'first absence', 'last absence']);
await assert.rejects(() => attemptOwnedCleanup(
  [{ label: 'user deletion', run: async () => { throw new Error('private-delete-detail'); } }],
  [{ label: 'user absence', run: async () => { throw new Error('private-query-detail'); } }],
), error => {
  assert(error instanceof Error);
  assert.match(error.message, /user deletion; user absence/);
  assert(!error.message.includes('private-'));
  return true;
});
await assert.doesNotReject(() => attemptOwnedCleanup([{ label: 'deleted', run: async () => {} }], [{ label: 'absent', run: async () => {} }]));
console.log('Owned cleanup attempts every deletion and reachable absence check before reporting safe failures');
