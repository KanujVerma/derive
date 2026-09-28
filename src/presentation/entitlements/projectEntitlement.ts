import type { FreeAccessState } from '../../contracts/FreeAccess.ts';

/** A future server response only. This module does not fetch, issue, or persist grants. */
export interface TrustedEntitlementSnapshotV1 {
  schemaVersion: 1;
  userId: string;
  policy: {
    version: string;
    validFrom: string;
    validUntil: string;
    checkSessionLimits: {
      free: number | null;
      plus: number | null;
    };
  };
  grant: null | {
    userId: string;
    policyVersion: string;
    capability: 'plus';
    source: 'billing' | 'promotion';
    cohortId: string | null;
    startsAt: string;
    expiresAt: string;
  };
  usage: {
    policyVersion: string;
    windowStartsAt: string;
    windowEndsAt: string;
    customerVisibleCheckSessionsUsed: number;
  };
}

export interface EntitlementProjection {
  factualProductAccess: boolean;
  fullTruthForAllowedChecks: boolean;
  managedAccess: boolean;
  plus: {
    available: boolean;
    basis: 'managed_inheritance' | 'billing' | 'promotion' | null;
    expiresAt: string | null;
    cohortId: string | null;
  };
  checks: {
    kind: 'unavailable' | 'current_free_access' | 'remote_policy';
    canStartCustomerVisibleCheck: boolean;
    meteredUnit: 'customer_visible_check_session';
    limit: number | null;
    remaining: number | null;
    policyVersion: string | null;
  };
}

const inactivePlus: EntitlementProjection['plus'] = {
  available: false, basis: null, expiresAt: null, cohortId: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const timestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
};

const limitIsValid = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);

/** Reject the entire future snapshot on any ambiguity; never infer a paid grant from FreeAccessState. */
function readSnapshot(value: unknown, userId: string, now: number): TrustedEntitlementSnapshotV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.userId !== userId
    || !isRecord(value.policy) || !isRecord(value.usage)) return null;
  const policy = value.policy;
  const usage = value.usage;
  const policyStart = timestamp(policy.validFrom);
  const policyEnd = timestamp(policy.validUntil);
  const windowStart = timestamp(usage.windowStartsAt);
  const windowEnd = timestamp(usage.windowEndsAt);
  if (typeof policy.version !== 'string' || policy.version.length === 0
    || policyStart === null || policyEnd === null || policyStart > now || now >= policyEnd
    || policyStart >= policyEnd || !isRecord(policy.checkSessionLimits)
    || !limitIsValid(policy.checkSessionLimits.free) || !limitIsValid(policy.checkSessionLimits.plus)
    || usage.policyVersion !== policy.version
    || windowStart === null || windowEnd === null || windowStart > now || now >= windowEnd
    || windowStart >= windowEnd || typeof usage.customerVisibleCheckSessionsUsed !== 'number'
    || !Number.isSafeInteger(usage.customerVisibleCheckSessionsUsed)
    || usage.customerVisibleCheckSessionsUsed < 0) return null;

  if (value.grant !== null) {
    if (!isRecord(value.grant)) return null;
    const grant = value.grant;
    const startsAt = timestamp(grant.startsAt);
    const expiresAt = timestamp(grant.expiresAt);
    if (grant.userId !== userId || grant.policyVersion !== policy.version
      || grant.capability !== 'plus' || (grant.source !== 'billing' && grant.source !== 'promotion')
      || startsAt === null || expiresAt === null || startsAt >= expiresAt
      || (grant.cohortId !== null && (typeof grant.cohortId !== 'string' || grant.cohortId.length === 0))
      || (grant.source === 'promotion' && grant.cohortId === null)) return null;
  }
  return value as unknown as TrustedEntitlementSnapshotV1;
}

/** Pure presentation projection. `snapshot` must come from a future trusted server reader. */
export function projectEntitlement(input: {
  access: FreeAccessState | null;
  snapshot: unknown;
  now: string;
  online: boolean;
}): EntitlementProjection {
  const access = input.access;
  const validAccess = !!access && access.freeProductAccess === true && typeof access.userId === 'string'
    && access.userId.length > 0 && ['anonymous', 'permanent'].includes(access.identityKind)
    && ['active', 'paused', 'cancelled', 'none'].includes(access.managedMembershipStatus)
    && access.managedAccess === (access.identityKind === 'permanent' && access.managedMembershipStatus === 'active');
  const managedAccess = validAccess && access.managedAccess;
  const baseline: EntitlementProjection = {
    factualProductAccess: validAccess,
    fullTruthForAllowedChecks: validAccess,
    managedAccess,
    plus: input.online && managedAccess
      ? { available: true, basis: 'managed_inheritance', expiresAt: null, cohortId: null }
      : inactivePlus,
    checks: {
      kind: validAccess ? 'current_free_access' : 'unavailable',
      canStartCustomerVisibleCheck: validAccess,
      meteredUnit: 'customer_visible_check_session',
      limit: null, remaining: null, policyVersion: null,
    },
  };
  const currentTime = timestamp(input.now);
  if (!validAccess || !input.online || currentTime === null) return baseline;
  if (input.snapshot == null) return baseline;
  const snapshot = readSnapshot(input.snapshot, access.userId, currentTime);
  if (!snapshot) return {
    ...baseline,
    plus: inactivePlus,
    checks: { ...baseline.checks, kind: 'unavailable', canStartCustomerVisibleCheck: false },
  };

  const grant = snapshot.grant;
  const grantActive = grant !== null && timestamp(grant.startsAt)! <= currentTime
    && currentTime < timestamp(grant.expiresAt)!;
  const plus: EntitlementProjection['plus'] = managedAccess ? baseline.plus : grantActive && grant
    ? { available: true, basis: grant.source, expiresAt: grant.expiresAt, cohortId: grant.cohortId }
    : inactivePlus;
  const limit = plus.available ? snapshot.policy.checkSessionLimits.plus : snapshot.policy.checkSessionLimits.free;
  const used = snapshot.usage.customerVisibleCheckSessionsUsed;
  return {
    ...baseline,
    plus,
    checks: {
      kind: 'remote_policy',
      canStartCustomerVisibleCheck: limit === null || used < limit,
      meteredUnit: 'customer_visible_check_session',
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      policyVersion: snapshot.policy.version,
    },
  };
}
