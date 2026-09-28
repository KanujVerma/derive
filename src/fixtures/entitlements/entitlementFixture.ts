import type { TrustedEntitlementSnapshotV1 } from '../../presentation/entitlements/projectEntitlement.ts';

/** Test/example data only; never a source of customer entitlements. */
export function entitlementFixture(options: {
  userId: string;
  expiresAt?: string;
  freeLimit?: number | null;
  plusLimit?: number | null;
  used?: number;
}): TrustedEntitlementSnapshotV1 {
  const policyVersion = 'fixture-policy-v1';
  return {
    schemaVersion: 1,
    userId: options.userId,
    policy: {
      version: policyVersion,
      validFrom: '2026-09-28T00:00:00.000Z',
      validUntil: '2026-10-28T00:00:00.000Z',
      checkSessionLimits: { free: options.freeLimit ?? null, plus: options.plusLimit ?? null },
    },
    grant: {
      userId: options.userId,
      policyVersion,
      capability: 'plus',
      source: 'promotion',
      cohortId: 'founding-wave-a',
      startsAt: '2026-09-28T00:00:00.000Z',
      expiresAt: options.expiresAt ?? '2026-10-27T00:00:00.000Z',
    },
    usage: {
      policyVersion,
      windowStartsAt: '2026-09-28T00:00:00.000Z',
      windowEndsAt: '2026-09-29T00:00:00.000Z',
      customerVisibleCheckSessionsUsed: options.used ?? 0,
    },
  };
}
