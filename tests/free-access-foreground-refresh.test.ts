import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { useFreeAccessStore } from '../src/stores/freeAccessStore.ts';
import { CustomerController, bindCustomerOwnerLifecycle } from '../src/presentation/personal-decision/customerController.ts';

const access = (userId: string) => ({ userId, identityKind: 'permanent' as const,
  freeProductAccess: true as const, managedMembershipStatus: 'none' as const, managedAccess: false });
const establish = (owner: string) => {
  const store = useFreeAccessStore.getState();
  store.reset();
  const attempt = store.start(owner);
  assert.equal(store.ready(access(owner), attempt), true);
  return useFreeAccessStore.getState();
};

test('same-owner foreground revalidation keeps ready projection and customer lifetime intact', () => {
  const store = establish('owner-a');
  const controller = new CustomerController({
    load: async () => { throw Error('unused'); },
    write: async () => { throw Error('unused'); },
    evaluate: async () => ({ kind: 'unavailable', reason: 'unused' }),
  }, () => 'unused');
  const owner = () => {
    const current = useFreeAccessStore.getState();
    return current.status === 'READY' && current.userId === 'owner-a'
      && current.access?.userId === 'owner-a' ? 'owner-a' : null;
  };
  let purges = 0;
  const stop = bindCustomerOwnerLifecycle(controller, owner, () => () => {},
    listener => useFreeAccessStore.subscribe(listener), () => { purges++; });
  try {
    const before = controller.getState();
    const initialPurges = purges;
    const attempt = store.refresh('owner-a');
    assert.notEqual(attempt, null);
    assert.equal(useFreeAccessStore.getState().isRefreshing, true);
    assert.equal(useFreeAccessStore.getState().status, 'READY');
    assert.equal(useFreeAccessStore.getState().access, store.access);
    assert.equal(controller.getState(), before, 'no false owner transition or decision/context purge');
    assert.equal(purges, initialPurges);
    assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), true);
    assert.equal(useFreeAccessStore.getState().isRefreshing, false);
    assert.equal(controller.getState(), before);
    assert.equal(purges, initialPurges);
  } finally { stop(); useFreeAccessStore.getState().reset(); }
});

test('refresh is unavailable before verification and deduplicates the current owner request', () => {
  useFreeAccessStore.getState().reset();
  assert.equal(useFreeAccessStore.getState().refresh('owner-a'), null);
  const store = establish('owner-a');
  assert.equal(store.refresh('owner-b'), null);
  const attempt = store.refresh('owner-a');
  assert.notEqual(attempt, null);
  assert.equal(useFreeAccessStore.getState().refresh('owner-a'), null);
  assert.equal(useFreeAccessStore.getState().attempt, attempt);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-b'), attempt!), false);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), true);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), false, 'completed attempt cannot replay');
  assert.equal(useFreeAccessStore.getState().fail('owner-a', attempt!), false, 'completed attempt cannot later revoke newer ready state');
  useFreeAccessStore.getState().reset();
});

test('failed foreground refresh removes access and prevents stale success from restoring it', () => {
  const attempt = establish('owner-a').refresh('owner-a');
  assert.notEqual(attempt, null);
  assert.equal(useFreeAccessStore.getState().fail('owner-a', attempt!), true);
  assert.equal(useFreeAccessStore.getState().status, 'ERROR');
  assert.equal(useFreeAccessStore.getState().access, null);
  assert.equal(useFreeAccessStore.getState().isRefreshing, false);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), false);
  assert.equal(useFreeAccessStore.getState().refresh('owner-a'), null);
  useFreeAccessStore.getState().reset();
});

test('sign-out and owner changes invalidate pending refresh replies', () => {
  let attempt = establish('owner-a').refresh('owner-a');
  assert.notEqual(attempt, null);
  useFreeAccessStore.getState().reset();
  assert.equal(useFreeAccessStore.getState().access, null);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), false);
  assert.equal(useFreeAccessStore.getState().fail('owner-a', attempt!), false);
  attempt = establish('owner-a').refresh('owner-a');
  const next = useFreeAccessStore.getState().start('owner-b');
  assert.equal(useFreeAccessStore.getState().access, null);
  assert.equal(useFreeAccessStore.getState().isRefreshing, false);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-a'), attempt!), false);
  assert.equal(useFreeAccessStore.getState().fail('owner-a', attempt!), false);
  assert.equal(useFreeAccessStore.getState().ready(access('owner-b'), next), true);
  useFreeAccessStore.getState().reset();
});

test('root foreground refresh revalidates owner-bound access without resetting the mounted scanner', () => {
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const branch = root.slice(root.indexOf('if (freeIntegration) {'), root.indexOf('const auth = useAuthStore.getState();', root.indexOf('return;\n      }', root.indexOf('if (freeIntegration) {'))));
  assert.match(branch, /projection\.refresh\(ownerId\)/);
  assert.match(branch, /getFreeAccessState\(\)/);
  assert.match(branch, /currentAuth\.sessionUserId !== ownerId/);
  assert.match(branch, /state\.userId !== ownerId/);
  assert.doesNotMatch(branch, /projection\.reset\(/);
});
