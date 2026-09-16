import type {
  EvidenceGrade,
  ResearchEvidence,
  SkinPhenotypeProfile,
} from './types.ts';

/**
 * Evaluates whether a piece of research evidence applies to a specific member's phenotype profile.
 *
 * Evidence strength (Grade A/B/C/D) is strictly orthogonal to member applicability.
 * A high-grade study on a specific population or condition does not universally apply
 * unless the member's confirmed context matches the study's applicability scope.
 */
export function isEvidenceApplicable(
  evidence: ResearchEvidence,
  profile?: SkinPhenotypeProfile
): boolean {
  if (!profile) {
    return false;
  }

  const { applicability } = evidence;

  // Check target pigmentation families if specified
  if (applicability.targetPigmentationFamilies && applicability.targetPigmentationFamilies.length > 0) {
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
    const memberPih = profile.pihTendency?.value;
    if (!memberPih || memberPih === 'unknown') {
      return false;
    }
    if (!applicability.pihTendencyApplies.includes(memberPih)) {
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
 * - Grade A / B: High-quality or robust evidence. Eligible to influence routine decisions
 *   ONLY IF member applicability matches.
 * - Grade C: Observational, small trial, or mechanistic evidence. Can inform educational
 *   notes or Ask context, but CANNOT silently modify active routines or force product swaps.
 * - Grade D: Preliminary, in-vitro, or anecdotal evidence. Cannot drive product behavior
 *   under any circumstances.
 *
 * Direct routine influence is NEVER triggered by unverified population associations.
 */
export function canInfluenceRoutine(
  evidence: ResearchEvidence,
  profile?: SkinPhenotypeProfile
): RoutineInfluenceDecision {
  const applicable = isEvidenceApplicable(evidence, profile);

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

  // Grades A and B require explicit member applicability
  if (!applicable) {
    return {
      allowed: false,
      reason: `Grade ${evidence.grade} evidence is methodologically robust but does not match member applicability criteria.`,
      evidenceGrade: evidence.grade,
      applicableToMember: false,
    };
  }

  return {
    allowed: true,
    reason: `Grade ${evidence.grade} evidence is methodologically sound and applicable to member context.`,
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
