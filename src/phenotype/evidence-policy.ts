import type {
  EvidenceGrade,
  ResearchEvidence,
  SkinPhenotypeProfile,
  EvidenceApplicabilityContext,
} from './types.ts';

/**
 * Evaluates whether a piece of research evidence applies to a specific member's phenotype profile
 * and product/recommendation context.
 *
 * Evidence strength (Grade A/B/C/D) is strictly orthogonal to member applicability.
 * A high-grade study on a specific formulation or condition does not apply unless ALL
 * declared applicability constraints match (failing closed if context is missing).
 */
export function isEvidenceApplicable(
  evidence: ResearchEvidence,
  profile?: SkinPhenotypeProfile,
  context?: EvidenceApplicabilityContext
): boolean {
  const { applicability } = evidence;

  // Check target pigmentation families if specified
  if (applicability.targetPigmentationFamilies && applicability.targetPigmentationFamilies.length > 0) {
    if (!profile) return false;
    const memberPigmentation = profile.pigmentationFamily?.value;
    if (!memberPigmentation || memberPigmentation === 'unknown') {
      return false;
    }
    if (!applicability.targetPigmentationFamilies.includes(memberPigmentation)) {
      return false;
    }
  }

  // Check PIH tendency if specified
  if (applicability.pihTendencyApplies && applicability.pihTendencyApplies.length > 0) {
    if (!profile) return false;
    const memberPih = profile.pihTendency?.value;
    if (!memberPih || memberPih === 'unknown') {
      return false;
    }
    if (!applicability.pihTendencyApplies.includes(memberPih)) {
      return false;
    }
  }

  // Check iron oxides requirement if specified (fails closed if context missing)
  if (applicability.requiresIronOxides === true) {
    if (!context || context.productHasIronOxides !== true) {
      return false;
    }
  }

  // Check photoprotection requirement if specified (fails closed if context missing)
  if (applicability.requiresPhotoprotection === true) {
    if (!context || context.photoprotectionRelevant !== true) {
      return false;
    }
  }

  return true;
}

export interface RoutineInfluenceDecision {
  allowed: boolean;
  reason: string;
  evidenceGrade: EvidenceGrade;
  applicableToMember: boolean;
}

/**
 * Enforces the Derive Evidence Policy:
 *
 * - directRoutineInfluenceAllowed === false: Hard-blocks direct routine influence regardless of grade.
 * - Grade A / B: High-quality or robust evidence. Eligible to influence routine decisions
 *   ONLY IF directRoutineInfluenceAllowed is true AND all member applicability criteria match.
 * - Grade C: Observational, small trial, or mechanistic evidence. Can inform educational
 *   notes or Ask context, but CANNOT silently modify active routines or force product swaps.
 * - Grade D: Preliminary, in-vitro, or anecdotal evidence. Cannot drive product behavior
 *   under any circumstances.
 *
 * Direct routine influence is NEVER triggered by unverified population associations.
 */
export function canInfluenceRoutine(
  evidence: ResearchEvidence,
  profile?: SkinPhenotypeProfile,
  context?: EvidenceApplicabilityContext
): RoutineInfluenceDecision {
  const applicable = isEvidenceApplicable(evidence, profile, context);

  if (evidence.grade === 'D') {
    return {
      allowed: false,
      reason: 'Grade D preliminary or anecdotal evidence cannot drive product or routine behavior.',
      evidenceGrade: 'D',
      applicableToMember: applicable,
    };
  }

  if (evidence.grade === 'C') {
    return {
      allowed: false,
      reason: 'Grade C observational or mechanistic evidence cannot silently alter active routines. Contextual editorial intelligence only.',
      evidenceGrade: 'C',
      applicableToMember: applicable,
    };
  }

  // Hard-block: directRoutineInfluenceAllowed === false prevents routine changes regardless of study grade
  if (!evidence.directRoutineInfluenceAllowed) {
    return {
      allowed: false,
      reason: 'Direct routine influence is explicitly disallowed for this evidence item.',
      evidenceGrade: evidence.grade,
      applicableToMember: applicable,
    };
  }

  // Grades A and B require all applicability constraints to match
  if (!applicable) {
    return {
      allowed: false,
      reason: `Grade ${evidence.grade} evidence is methodologically robust but does not match member applicability criteria or required product context.`,
      evidenceGrade: evidence.grade,
      applicableToMember: false,
    };
  }

  return {
    allowed: true,
    reason: `Grade ${evidence.grade} evidence is methodologically sound and all applicability criteria match.`,
    evidenceGrade: evidence.grade,
    applicableToMember: true,
  };
}

/**
 * Checks whether evidence can inform educational content (Ask, Research Cards).
 * Grades A, B, and C can inform educational context; Grade D is excluded.
 */
export function canInformEducationalContext(evidence: ResearchEvidence): boolean {
  return evidence.grade === 'A' || evidence.grade === 'B' || evidence.grade === 'C';
}
