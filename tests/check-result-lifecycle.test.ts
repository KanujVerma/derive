import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckResultLifecycle } from '../src/presentation/check/result-sheet/lifecycle.ts';

const binding = { snapshotId: 'snapshot-a', caseRevision: 1, formulaVersionId: 'formula-a', contextRevision: 3 };
test('dismiss returns retained search context and rejects its late resolver callback', () => {
  const lifecycle = createCheckResultLifecycle();
  const origin = { kind: 'search' as const, query: 'cleanser', scrollOffset: 160, selectedProductId: 'product-a' };
  const token = lifecycle.begin('owner-a', origin, 'request-a');
  assert.equal(lifecycle.canPublish(token, 'owner-a'), true);
  assert.deepEqual(lifecycle.dismiss(token, 'owner-a'), origin);
  assert.equal(lifecycle.canPublish(token, 'owner-a'), false);
  assert.equal(lifecycle.bind(token, 'owner-a', binding), false);
});
test('a stale dismiss cannot close the next product or return its origin', () => {
  const lifecycle = createCheckResultLifecycle();
  const old = lifecycle.begin('owner-a', { kind: 'link', value: 'https://example.org/a', scrollOffset: 90 }, 'request-a');
  const current = lifecycle.begin('owner-a', { kind: 'camera', sessionId: 'session-a' }, 'request-b');
  assert.equal(lifecycle.dismiss(old, 'owner-a'), null);
  assert.equal(lifecycle.canPublish(current, 'owner-a'), true);
});
test('actions reject changed owner, context, formula, snapshot or revision', () => {
  const lifecycle = createCheckResultLifecycle();
  const token = lifecycle.begin('owner-a', { kind: 'camera', sessionId: 'session-a' }, 'request-a');
  assert.equal(lifecycle.canAct(token, 'owner-a', binding), false);
  assert.equal(lifecycle.bind(token, 'owner-a', binding), true);
  assert.equal(lifecycle.canAct(token, 'owner-a', binding), true);
  for (const changed of [ { ...binding, contextRevision: 4 }, { ...binding, formulaVersionId: 'formula-b' },
    { ...binding, snapshotId: 'snapshot-b' }, { ...binding, caseRevision: 2 } ]) {
    assert.equal(lifecycle.canAct(token, 'owner-a', changed), false);
  }
  assert.equal(lifecycle.canPublish(token, 'owner-b'), false);
  assert.equal(lifecycle.canAct(token, 'owner-b', binding), false);
  lifecycle.invalidate();
  assert.equal(lifecycle.canPublish(token, 'owner-a'), false);
});
test('retained origin and binding cannot be mutated through caller references', () => {
  const lifecycle = createCheckResultLifecycle();
  const origin = { kind: 'search' as const, query: 'cleanser', scrollOffset: 40, selectedProductId: null };
  const token = lifecycle.begin('owner-a', origin, 'request-a');
  const suppliedBinding = { ...binding };
  lifecycle.bind(token, 'owner-a', suppliedBinding);
  suppliedBinding.contextRevision = 9;
  assert.equal(lifecycle.canAct(token, 'owner-a', binding), true);
  origin.query = 'Changed elsewhere';
  assert.equal(lifecycle.canAct(token, 'owner-a', { ...binding, contextRevision: 9 }), false);
  assert.deepEqual(lifecycle.dismiss(token, 'owner-a'),
    { kind: 'search', query: 'cleanser', scrollOffset: 40, selectedProductId: null });
});
