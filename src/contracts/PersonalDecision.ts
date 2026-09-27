/** P0-B evaluation boundary only. P0-A owns the authoritative ProductTruthSnapshot.
 * None of these types establish catalog facts, authentication or scientific review.
 */
export type DecisionKnowledge<T> =
  | { state: 'known'; value: T; sourceIds: string[] }
  | { state: 'unknown'; reason: string }
  | { state: 'conflict'; sourceIds: string[]; reason: string };

export interface P0BProductEvaluationProjectionV1 {
  schemaVersion: 'p0b-product-evaluation/v1';
  snapshotId: string;
  snapshotRevision: string;
  sourceBoundaryRevision: string;
  identity: DecisionKnowledge<{ productId: string; variantId: string }>;
  formula: DecisionKnowledge<{ formulaVersionId: string; ingredients: string[] }>;
  category: DecisionKnowledge<string>;
  /** IDs refer to accepted provenance, never arbitrary text or model candidates. */
  sources: Array<{ id: string; revision: string }>;
}

/** Supplied by the authenticated host and verified adapters, never by a model. */
export interface DecisionBinding {
  ownerId: string;
  productSnapshotId: string;
  productSnapshotRevision: string;
  sourceBoundaryRevision: string;
  productId: string | null;
  variantId: string | null;
  formulaVersionId: string | null;
  profileRevision: string | null;
  routineRevision: string | null;
  historyRevision: string | null;
}

export type DecisionEvidence =
  | { kind: 'product_fact'; snapshotRevision: string; sourceId: string; sourceRevision: string;
      scope: 'identity' | 'formula' | 'category'; productId: string; variantId: string; formulaVersionId: string | null }
  | { kind: 'context_fact'; section: 'profile' | 'routine' | 'history'; ownerId: string;
      revision: string; recordId: string }
  | { kind: 'reviewed_claim'; claimId: string; claimRevision: string; sourceId: string;
      sourceRevision: string; applicability: 'applicable' | 'uncertain'; limitations: string[] }
  | { kind: 'observation'; observationId: string; source: 'raw_text' | 'model' | 'commercial' };

export type FindingKind =
  | 'goal_role_match' | 'role_redundancy' | 'replacement_candidate' | 'active_overlap'
  | 'reported_ingredient_sensitivity' | 'reactive_active' | 'prior_product_reaction'
  | 'reproductive_context_caution' | 'formula_changed' | 'missing_evidence' | 'no_supported_rule';

export interface Finding {
  id: string;
  kind: FindingKind;
  applicability: 'applicable' | 'uncertain' | 'not_applicable';
  /** Consequence and strength of support are deliberately independent. */
  severity: 'informational' | 'caution' | 'blocker';
  confidence: 'supported' | 'limited' | 'unknown';
  ruleId: string;
  ruleVersion: string;
  evidence: DecisionEvidence[];
  uncertainty: string[];
  /** Evidence needs remain visible even if a different finding chooses the action. */
  evidenceNeedIds: string[];
}

export interface RoutineImpact {
  id: string;
  kind: 'adds_role' | 'duplicates_role' | 'replacement_candidate' | 'active_overlap' | 'keep_current' | 'none' | 'unknown';
  /** Candidate is the packet-bound identity; existing items are owner routine references. */
  candidate: { productId: string | null; variantId: string | null; formulaVersionId: string | null };
  routineItemIds: string[];
  findingIds: string[];
  uncertainty: string[];
}

export type EvidenceNeedCode =
  | 'exact_identity' | 'verified_formula' | 'formula_conflict' | 'profile_context'
  | 'routine_completeness' | 'application_schedule' | 'current_treatments'
  | 'sensitivity_context' | 'ingredient_alias_review' | 'reproductive_context'
  | 'individual_tolerance' | 'exact_prior_formula' | 'current_formula_experience'
  | 'reviewed_claim' | 'supported_rule' | 'clinician_review';

export interface EvidenceNeed {
  id: string;
  code: EvidenceNeedCode;
  state: 'missing' | 'unknown' | 'withheld' | 'conflict';
  /** A critical need blocks a positive use action, not retention of known cautions. */
  critical: boolean;
  findingIds: string[];
}

export type PersonalDecisionActionKind =
  | 'COULD_WORK' | 'USE_WITH_CAUTION' | 'KEEP_CURRENT' | 'SKIP' | 'NOT_ENOUGH_INFORMATION';
export type DecisionNextStep =
  | 'consider_use' | 'keep_current' | 'skip_product' | 'confirm_formula'
  | 'add_context' | 'review_routine' | 'ask_clinician';

export interface PersonalDecisionAction {
  kind: PersonalDecisionActionKind;
  /** Deterministic policy selects from retained findings; renderer cannot add one. */
  findingIds: string[];
  primaryFindingId: string;
  nextStep: DecisionNextStep;
}

export interface PersonalDecisionPacketV1 {
  schemaVersion: 'personal-decision/v1';
  id: string;
  evaluatedAt: string;
  binding: DecisionBinding;
  versions: { engine: string; policy: string; projection: 'p0b-product-evaluation/v1' };
  findings: Finding[];
  routineImpacts: RoutineImpact[];
  evidenceNeeds: EvidenceNeed[];
  action: PersonalDecisionAction;
}

export type PacketIntegrityIssue =
  | 'binding_mismatch' | 'duplicate_finding_id' | 'duplicate_evidence_need_id' | 'duplicate_routine_impact_id'
  | 'action_finding_reference' | 'need_finding_reference' | 'finding_need_reference'
  | 'routine_finding_reference' | 'evidence_binding_mismatch' | 'unsupported_positive_finding'
  | 'positive_action_blocked' | 'unsupported_action' | 'routine_candidate_mismatch' | 'action_next_step_mismatch';

const BINDING_KEYS: Array<keyof DecisionBinding> = [
  'ownerId', 'productSnapshotId', 'productSnapshotRevision', 'sourceBoundaryRevision',
  'productId', 'variantId', 'formulaVersionId', 'profileRevision', 'routineRevision', 'historyRevision',
];
const POSITIVE_KINDS: FindingKind[] = ['goal_role_match', 'replacement_candidate'];

/** Integrity check for already typed, trusted evaluator output. NOT a JSON parser,
 * Auth check, product-source verifier or scientific claim validator. Host must load
 * expectedBinding independently of this packet. Never use packet.binding as authority.
 */
export function validatePersonalDecisionPacket(
  packet: PersonalDecisionPacketV1, expectedBinding: DecisionBinding,
): PacketIntegrityIssue[] {
  const issues = new Set<PacketIntegrityIssue>();
  if (BINDING_KEYS.some((key) => packet.binding[key] !== expectedBinding[key])) issues.add('binding_mismatch');
  const ids = (rows: Array<{ id: string }>, issue: PacketIntegrityIssue): Set<string> => {
    const unique = new Set(rows.map((row) => row.id));
    if (unique.size !== rows.length || unique.has('')) issues.add(issue);
    return unique;
  };
  const findings = ids(packet.findings, 'duplicate_finding_id');
  const needs = ids(packet.evidenceNeeds, 'duplicate_evidence_need_id');
  ids(packet.routineImpacts, 'duplicate_routine_impact_id');
  if (!packet.action.findingIds.length || !packet.action.findingIds.includes(packet.action.primaryFindingId)
    || packet.action.findingIds.some((id) => !findings.has(id))) issues.add('action_finding_reference');
  for (const need of packet.evidenceNeeds) {
    if (need.findingIds.some((id) => !findings.has(id))) issues.add('need_finding_reference');
  }
  for (const impact of packet.routineImpacts) {
    if (impact.candidate.productId !== packet.binding.productId
      || impact.candidate.variantId !== packet.binding.variantId
      || impact.candidate.formulaVersionId !== packet.binding.formulaVersionId) issues.add('routine_candidate_mismatch');
    if (!impact.findingIds.length || impact.findingIds.some((id) => !findings.has(id))) issues.add('routine_finding_reference');
  }
  for (const finding of packet.findings) {
    if (finding.evidenceNeedIds.some((id) => !needs.has(id))) issues.add('finding_need_reference');
    for (const evidence of finding.evidence) {
      if (evidence.kind === 'context_fact') {
        const revision = packet.binding[`${evidence.section}Revision`];
        if (evidence.ownerId !== packet.binding.ownerId || revision === null || evidence.revision !== revision) {
          issues.add('evidence_binding_mismatch');
        }
      } else if (evidence.kind === 'product_fact') {
        if (evidence.snapshotRevision !== packet.binding.productSnapshotRevision
          || evidence.productId !== packet.binding.productId || evidence.variantId !== packet.binding.variantId
          || (evidence.scope === 'formula' && (!evidence.formulaVersionId
            || evidence.formulaVersionId !== packet.binding.formulaVersionId))) issues.add('evidence_binding_mismatch');
      }
    }
    if (POSITIVE_KINDS.includes(finding.kind) && finding.applicability === 'applicable') {
      const product = finding.evidence.some((e) => e.kind === 'product_fact');
      const context = finding.evidence.some((e) => e.kind === 'context_fact');
      if (finding.confidence !== 'supported' || !product || !context) issues.add('unsupported_positive_finding');
    }
  }
  const selected = packet.findings.filter((f) => packet.action.findingIds.includes(f.id));
  const supported = selected.filter((f) => f.applicability === 'applicable' && f.confidence !== 'unknown'
    && f.evidence.some((e) => e.kind !== 'observation'));
  if (packet.action.kind === 'COULD_WORK') {
    if (!packet.binding.productId || !packet.binding.variantId || !packet.binding.formulaVersionId
      || packet.evidenceNeeds.some((need) => need.critical)
      || packet.findings.some((f) => f.applicability === 'applicable' && f.severity !== 'informational')) {
      issues.add('positive_action_blocked');
    }
    if (!supported.some((f) => f.kind === 'goal_role_match')) issues.add('unsupported_action');
  } else if (packet.action.kind === 'USE_WITH_CAUTION') {
    if (!supported.some((f) => f.severity === 'caution' || f.severity === 'blocker')) issues.add('unsupported_action');
  } else if (packet.action.kind === 'KEEP_CURRENT' || packet.action.kind === 'SKIP') {
    if (!supported.some((f) => f.kind === 'role_redundancy' || f.severity === 'blocker')) issues.add('unsupported_action');
  }
  const allowedSteps: Record<PersonalDecisionActionKind, DecisionNextStep[]> = {
    COULD_WORK: ['consider_use'],
    USE_WITH_CAUTION: ['confirm_formula', 'add_context', 'review_routine', 'ask_clinician'],
    KEEP_CURRENT: ['keep_current'],
    SKIP: ['skip_product'],
    NOT_ENOUGH_INFORMATION: ['confirm_formula', 'add_context', 'review_routine', 'ask_clinician'],
  };
  if (!allowedSteps[packet.action.kind].includes(packet.action.nextStep)) issues.add('action_next_step_mismatch');
  return [...issues];
}
