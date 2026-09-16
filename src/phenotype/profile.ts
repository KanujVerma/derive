import type {
  ConfidenceLevel,
  EvidenceSource,
  ProvenancedValue,
  SkinPhenotypeProfile,
} from './types.ts';

/**
 * Creates a provenanced value with explicit evidence origin and categorical confidence.
 */
export function createProvenancedValue<T>(
  value: T,
  source: EvidenceSource,
  confidence: ConfidenceLevel = 'medium',
  userConfirmed: boolean = false,
  observedAt: string = new Date().toISOString()
): ProvenancedValue<T> {
  return {
    value,
    source,
    confidence,
    userConfirmed,
    observedAt,
  };
}

/**
 * Invariant: A member-confirmed value strictly outranks an unconfirmed photo estimate.
 *
 * Stale or unconfirmed estimates cannot supersede active confirmed member truth.
 * Only explicit user confirmation/correction can overwrite a confirmed value.
 */
export function setOrConfirmPhenotypeValue<T>(
  current: ProvenancedValue<T> | undefined,
  incoming: ProvenancedValue<T>
): ProvenancedValue<T> {
  // If current is confirmed by the user and incoming is NOT confirmed by the user,
  // the user's confirmed truth outranks the incoming estimate.
  if (current?.userConfirmed && !incoming.userConfirmed) {
    return current;
  }

  // Incoming confirmed value supersedes prior value (whether prior was estimated or previously confirmed)
  if (incoming.userConfirmed) {
    return {
      ...incoming,
      userConfirmed: true,
      observedAt: incoming.observedAt || new Date().toISOString(),
    };
  }

  // If neither is user-confirmed, incoming update takes precedence
  return incoming;
}

/**
 * Merges updates into a SkinPhenotypeProfile while enforcing confirmation invariants.
 */
export function updatePhenotypeProfile(
  current: SkinPhenotypeProfile,
  updates: Partial<SkinPhenotypeProfile>
): SkinPhenotypeProfile {
  const result: SkinPhenotypeProfile = { ...current };

  const keys: (keyof SkinPhenotypeProfile)[] = [
    'pigmentationFamily',
    'undertone',
    'sunResponse',
    'pihTendency',
    'whiteCastConcern',
    'razorBumpHistory',
    'hairCurlPattern',
  ];

  for (const key of keys) {
    const incomingVal = updates[key];
    if (incomingVal !== undefined) {
      const currentVal = current[key];
      // Type assertion safe because key matches across profile
      (result as any)[key] = setOrConfirmPhenotypeValue(currentVal as any, incomingVal as any);
    }
  }

  return result;
}
