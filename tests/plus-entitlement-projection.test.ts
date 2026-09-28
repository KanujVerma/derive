import assert from 'node:assert/strict';
import test from 'node:test';
import { projectEntitlement } from '../src/presentation/entitlements/projectEntitlement.ts';
import { entitlementFixture } from '../src/fixtures/entitlements/entitlementFixture.ts';
import type { FreeAccessState } from '../src/contracts/FreeAccess.ts';

const now = '2026-09-28T12:00:00.000Z';
const free: FreeAccessState = {
  userId: 'customer-1', identityKind: 'permanent', freeProductAccess: true,
  managedMembershipStatus: 'none', managedAccess: false,
};

test('free access keeps factual truth, safety and reasons when Plus evidence is absent', () => {
  const view = projectEntitlement({ access: free, snapshot: null, now, online: true });
  assert.equal(view.factualProductAccess, true);
  assert.equal(view.fullTruthForAllowedChecks, true);
  assert.equal(view.plus.available, false);
  assert.equal(view.checks.kind, 'current_free_access');
  assert.equal(view.checks.canStartCustomerVisibleCheck, true);
  assert.equal(view.checks.limit, null);
});

test('managed access conceptually includes Plus without inventing a Plus subscription', () => {
  const view = projectEntitlement({
    access: { ...free, managedMembershipStatus: 'active', managedAccess: true },
    snapshot: null, now, online: true,
  });
  assert.equal(view.managedAccess, true);
  assert.deepEqual(view.plus, {
    available: true, basis: 'managed_inheritance', expiresAt: null, cohortId: null,
  });
});

test('a founding promotional grant has an explicit expiry and cohort, then expires', () => {
  const snapshot = entitlementFixture({ userId: free.userId, expiresAt: '2026-09-29T00:00:00.000Z' });
  assert.ok(snapshot.grant);
  const active = projectEntitlement({ access: free, snapshot, now, online: true });
  assert.deepEqual(active.plus, {
    available: true, basis: 'promotion', expiresAt: '2026-09-29T00:00:00.000Z',
    cohortId: 'founding-wave-a',
  });
  const expired = projectEntitlement({ access: free, snapshot, now: snapshot.grant.expiresAt, online: true });
  assert.equal(expired.plus.available, false);
  assert.equal(expired.factualProductAccess, true);
});

test('unknown, mismatched, stale and malformed grants fail closed', () => {
  const base = entitlementFixture({ userId: free.userId });
  assert.ok(base.grant);
  const invalid = [
    { ...base, grant: { ...base.grant, source: 'unknown' } },
    { ...base, userId: 'someone-else' },
    { ...base, grant: { ...base.grant, expiresAt: 'nonsense' } },
    { ...base, grant: { ...base.grant, startsAt: base.grant.expiresAt } },
    { ...base, policy: { ...base.policy, version: 'unrecognized' } },
    { ...base, policy: { ...base.policy, validUntil: now } },
  ];
  for (const snapshot of invalid) {
    const view = projectEntitlement({ access: free, snapshot, now, online: true });
    assert.equal(view.plus.available, false);
    assert.equal(view.factualProductAccess, true);
  }
});

test('offline and unresolved app state do not activate a cached Plus grant', () => {
  const snapshot = entitlementFixture({ userId: free.userId });
  const offline = projectEntitlement({ access: free, snapshot, now, online: false });
  assert.equal(offline.plus.available, false);
  assert.equal(offline.checks.kind, 'current_free_access');
  const unresolved = projectEntitlement({ access: null, snapshot, now, online: true });
  assert.equal(unresolved.factualProductAccess, false);
  assert.equal(unresolved.plus.available, false);
  assert.equal(unresolved.checks.canStartCustomerVisibleCheck, false);
});

test('remote quota counts customer-visible Check sessions, not provider calls', () => {
  const snapshot = entitlementFixture({ userId: free.userId, freeLimit: 2, plusLimit: 7, used: 1 });
  const oneLeft = projectEntitlement({ access: free, snapshot: { ...snapshot, grant: null }, now, online: true });
  assert.equal(oneLeft.checks.kind, 'remote_policy');
  assert.equal(oneLeft.checks.remaining, 1);
  assert.equal(oneLeft.checks.canStartCustomerVisibleCheck, true);
  const exhausted = projectEntitlement({ access: free, snapshot: {
    ...snapshot, grant: null, usage: { ...snapshot.usage, customerVisibleCheckSessionsUsed: 2 },
  }, now, online: true });
  assert.equal(exhausted.checks.canStartCustomerVisibleCheck, false);
  assert.equal(exhausted.factualProductAccess, true);
  assert.equal(exhausted.fullTruthForAllowedChecks, true);
  const plus = projectEntitlement({ access: free, snapshot, now, online: true });
  assert.equal(plus.checks.limit, 7);
  assert.equal(plus.checks.remaining, 6);
  assert.equal(plus.checks.meteredUnit, 'customer_visible_check_session');
  assert.equal('providerCalls' in plus.checks, false);
});

test('invalid usage cannot authorize an extra Check or grant Plus', () => {
  const snapshot = entitlementFixture({ userId: free.userId });
  for (const used of [-1, 1.5, Number.NaN]) {
    const view = projectEntitlement({ access: free, snapshot: {
      ...snapshot, usage: { ...snapshot.usage, customerVisibleCheckSessionsUsed: used },
    }, now, online: true });
    assert.equal(view.checks.kind, 'unavailable');
    assert.equal(view.checks.canStartCustomerVisibleCheck, false);
    assert.equal(view.plus.available, false);
  }
});
