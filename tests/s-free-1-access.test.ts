import assert from 'node:assert/strict';
import test from 'node:test';
import { getFreeAccessState } from '../src/services/remote/freeAccess.ts';

const reply = (data: unknown, error: unknown = null) => ({
  functions: { invoke: async (name: string) => {
    assert.equal(name, 'access-state');
    return { data, error };
  } },
});

test('S-FREE-1: guest access is free without a fabricated managed membership', async () => {
  assert.deepEqual(await getFreeAccessState(reply({
    userId: 'guest-id', identityKind: 'anonymous', freeProductAccess: true,
    managedMembershipStatus: 'none', managedAccess: false,
  })), {
    userId: 'guest-id', identityKind: 'anonymous', freeProductAccess: true,
    managedMembershipStatus: 'none', managedAccess: false,
  });
});

test('S-FREE-1: permanent managed access is represented separately', async () => {
  const state = await getFreeAccessState(reply({
    userId: 'member-id', identityKind: 'permanent', freeProductAccess: true,
    managedMembershipStatus: 'active', managedAccess: true,
  }));
  assert.equal(state.managedAccess, true);
  assert.equal(state.freeProductAccess, true);
});

test('S-FREE-1: client fails closed on malformed or contradictory access states', async () => {
  for (const data of [
    null,
    { userId: 'guest-id', identityKind: 'anonymous', freeProductAccess: true,
      managedMembershipStatus: 'active', managedAccess: true },
    { userId: 'member-id', identityKind: 'permanent', freeProductAccess: true,
      managedMembershipStatus: 'active', managedAccess: false },
    { userId: 'guest-id', identityKind: 'anonymous', freeProductAccess: false,
      managedMembershipStatus: 'none', managedAccess: false },
  ]) {
    await assert.rejects(getFreeAccessState(reply(data)), /unavailable/);
  }
  await assert.rejects(getFreeAccessState(reply(null, new Error('network'))), /unavailable/);
});
