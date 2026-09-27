import type {
  DecisionBinding, DecisionEvidence, EvidenceNeed, Finding, PersonalDecisionPacketV1,
  P0BProductEvaluationProjectionV1, RoutineImpact,
} from '../../contracts/PersonalDecision.ts';

/** Synthetic semantic examples, not scientific gold labels or authoritative P0-A snapshots. */
export interface PersonalDecisionFixture {
  id: string;
  product: P0BProductEvaluationProjectionV1;
  binding: DecisionBinding;
  packet: PersonalDecisionPacketV1;
}

const product: P0BProductEvaluationProjectionV1 = {
  schemaVersion: 'p0b-product-evaluation/v1', snapshotId: 'fixture-snapshot:1', snapshotRevision: 'snapshot:1',
  sourceBoundaryRevision: 'sources:1',
  identity: { state: 'known', value: { productId: 'fixture-product:1', variantId: 'fixture-variant:1' }, sourceIds: ['fixture-label'] },
  formula: { state: 'known', value: { formulaVersionId: 'fixture-formula:1', ingredients: ['Glycerin'] }, sourceIds: ['fixture-label'] },
  category: { state: 'known', value: 'moisturizer', sourceIds: ['fixture-label'] },
  sources: [{ id: 'fixture-label', revision: 'label:1' }],
};
const binding: DecisionBinding = {
  ownerId: 'fixture-owner:1', productSnapshotId: product.snapshotId, productSnapshotRevision: product.snapshotRevision,
  sourceBoundaryRevision: product.sourceBoundaryRevision,
  productId: 'fixture-product:1', variantId: 'fixture-variant:1', formulaVersionId: 'fixture-formula:1',
  profileRevision: 'profile:1', routineRevision: 'routine:1', historyRevision: 'history:1',
};
const categoryEvidence: DecisionEvidence = {
  kind: 'product_fact', scope: 'category', snapshotRevision: 'snapshot:1', sourceId: 'fixture-label',
  sourceRevision: 'label:1', productId: binding.productId!, variantId: binding.variantId!, formulaVersionId: null,
};
const profileEvidence: DecisionEvidence = {
  kind: 'context_fact', section: 'profile', ownerId: binding.ownerId, revision: 'profile:1', recordId: 'profile-record:1',
};
const role: Finding = {
  id: 'goal-role', kind: 'goal_role_match', applicability: 'applicable', severity: 'informational', confidence: 'supported',
  ruleId: 'fixture:role-match', ruleVersion: '1', evidence: [categoryEvidence, profileEvidence],
  uncertainty: ['Role match cannot establish individual results or tolerance.'], evidenceNeedIds: ['tolerance'],
  display: { kind: 'role_match', goal: 'dryness', category: 'moisturizer', evidenceIndexes: [0, 1] },
};
const tolerance: EvidenceNeed = {
  id: 'tolerance', code: 'individual_tolerance', state: 'unknown', critical: false, findingIds: ['goal-role'],
};
const caution: Finding = {
  id: 'prior-reaction', kind: 'prior_product_reaction', applicability: 'applicable', severity: 'caution', confidence: 'supported',
  ruleId: 'fixture:prior-reaction', ruleVersion: '1',
  evidence: [{ kind: 'context_fact', section: 'history', ownerId: binding.ownerId, revision: 'history:1', recordId: 'experience:1' }],
  uncertainty: ['Self-reported product reaction does not identify an ingredient cause.'], evidenceNeedIds: [],
  display: { kind: 'prior_reaction', historyEventId: 'experience:1', historicalFormulaVersionId: null, evidenceIndexes: [0] },
};
const basePacket: PersonalDecisionPacketV1 = {
  schemaVersion: 'personal-decision/v1', id: 'fixture-packet:1', evaluatedAt: '2026-09-26T00:00:00.000Z', binding,
  versions: { engine: 'fixture-only/1', policy: 'fixture-only/1', projection: 'p0b-product-evaluation/v1' },
  findings: [role], routineImpacts: [], evidenceNeeds: [tolerance],
  action: { kind: 'COULD_WORK', findingIds: ['goal-role'], primaryFindingId: 'goal-role', nextStep: 'consider_use' },
};
/** Fixture data is plain JSON; avoid runtime APIs that may be absent in Hermes. */
function copyFixtureJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function fixture(id: string, changes: Partial<PersonalDecisionPacketV1> = {},
  projectedProduct: P0BProductEvaluationProjectionV1 = product): PersonalDecisionFixture {
  const packet = { ...basePacket, ...changes, id: `fixture-packet:${id}` };
  return copyFixtureJson({ id, product: projectedProduct, binding: packet.binding, packet });
}
const missingFormula: Finding = {
  id: 'missing-formula', kind: 'missing_evidence', applicability: 'applicable', severity: 'blocker', confidence: 'unknown',
  ruleId: 'fixture:formula-required', ruleVersion: '1', evidence: [],
  uncertainty: ['Exact formula is unavailable.'], evidenceNeedIds: ['formula'],
};
const formulaNeed: EvidenceNeed = { id: 'formula', code: 'verified_formula', state: 'missing', critical: true, findingIds: ['missing-formula'] };
const partialRoutine: Finding = {
  id: 'partial-routine', kind: 'missing_evidence', applicability: 'uncertain', severity: 'informational', confidence: 'unknown',
  ruleId: 'fixture:partial-routine', ruleVersion: '1',
  evidence: [{ kind: 'context_fact', section: 'routine', ownerId: binding.ownerId, revision: 'routine:1', recordId: 'routine-head:1' }],
  uncertainty: ['An absent item in a partial routine does not establish absence of use.'], evidenceNeedIds: ['routine-completeness'],
};
const unknownImpact: RoutineImpact = {
  id: 'routine-impact:1', kind: 'unknown', candidate: { productId: binding.productId, variantId: binding.variantId, formulaVersionId: binding.formulaVersionId },
  routineItemIds: [], findingIds: ['partial-routine'], uncertainty: ['Routine is partial.'],
};
const formulaChanged: Finding = {
  id: 'formula-changed', kind: 'formula_changed', applicability: 'applicable', severity: 'informational', confidence: 'supported',
  ruleId: 'fixture:formula-changed', ruleVersion: '1',
  evidence: [{ kind: 'context_fact', section: 'history', ownerId: binding.ownerId, revision: 'history:1', recordId: 'old-formula-tolerance:1' }],
  uncertainty: ['Earlier tolerance belongs to fixture-formula:0; it does not prove current-formula tolerance.'],
  evidenceNeedIds: ['current-experience'],
};
const routineContext: DecisionEvidence = {
  kind: 'context_fact', section: 'routine', ownerId: binding.ownerId, revision: 'routine:1', recordId: 'routine-item:1',
};
const routineCategory: DecisionEvidence = {
  kind: 'routine_product_fact', ownerId: binding.ownerId, routineRevision: 'routine:1', routineItemId: 'routine-item:1',
  productId: 'fixture-existing-product:1', variantId: null, formulaVersionId: null,
  scope: 'category', sourceId: 'fixture-existing-category', sourceRevision: 'category:1',
};
const redundancy: Finding = {
  id: 'redundant-role', kind: 'role_redundancy', applicability: 'applicable', severity: 'informational', confidence: 'supported',
  ruleId: 'fixture:redundancy', ruleVersion: '1', evidence: [categoryEvidence, routineContext, routineCategory],
  uncertainty: [], evidenceNeedIds: [],
  display: { kind: 'routine_relation', routineItemIds: ['routine-item:1'], role: 'moisturizer', timing: 'pm', frequency: 'few_times_weekly', evidenceIndexes: [0, 1, 2] },
};
const routineFormulaOverlap: Finding = {
  id: 'routine-formula-overlap', kind: 'active_overlap', applicability: 'applicable', severity: 'caution', confidence: 'supported',
  ruleId: 'fixture:formula-overlap', ruleVersion: '1',
  evidence: [{ ...categoryEvidence, scope: 'formula', formulaVersionId: binding.formulaVersionId }, routineContext,
    { ...routineCategory, scope: 'formula', variantId: 'fixture-existing-variant:1', formulaVersionId: 'fixture-existing-formula:1',
      sourceId: 'fixture-existing-formula', sourceRevision: 'formula-evidence:1' }],
  uncertainty: ['Routine product category is unknown.'], evidenceNeedIds: [],
  display: { kind: 'routine_relation', routineItemIds: ['routine-item:1'], role: 'unknown', timing: 'unknown', frequency: 'unknown', evidenceIndexes: [0, 1, 2] },
};
const routineExperience: Finding = {
  id: 'routine-experience', kind: 'routine_experience_caution', applicability: 'applicable', severity: 'caution', confidence: 'supported',
  ruleId: 'fixture:routine-experience', ruleVersion: '1', evidence: [routineContext,
    { kind: 'context_fact', section: 'history', ownerId: binding.ownerId, revision: 'history:1', recordId: 'existing-experience:1' }],
  uncertainty: [], evidenceNeedIds: [],
  display: { kind: 'routine_experience', routineItemIds: ['routine-item:1'], historyEventId: 'existing-experience:1', outcome: 'reaction', evidenceIndexes: [0, 1] },
};
export const personalDecisionFixtures: PersonalDecisionFixture[] = [
  fixture('positive-role-match'),
  fixture('unsupported-goal', { findings: [role, { id: 'unsupported-goal', kind: 'no_supported_rule', applicability: 'applicable', severity: 'informational', confidence: 'unknown',
    ruleId: 'fixture:unsupported-goal', ruleVersion: '1', evidence: [profileEvidence], uncertainty: [], evidenceNeedIds: ['unsupported-goal-evidence'] }],
    evidenceNeeds: [tolerance, { id: 'unsupported-goal-evidence', code: 'supported_rule', state: 'missing', critical: true, findingIds: ['unsupported-goal'] }],
    action: { kind: 'NOT_ENOUGH_INFORMATION', findingIds: ['unsupported-goal', 'goal-role'], primaryFindingId: 'unsupported-goal', nextStep: 'view_product_facts' } }),
  fixture('redundancy', { findings: [role, redundancy],
    routineImpacts: [{ id: 'duplicate-impact', kind: 'duplicates_role', candidate: { productId: binding.productId, variantId: binding.variantId, formulaVersionId: binding.formulaVersionId }, routineItemIds: ['routine-item:1'], findingIds: ['redundant-role'], uncertainty: [] }],
    action: { kind: 'KEEP_CURRENT', findingIds: ['redundant-role'], primaryFindingId: 'redundant-role', nextStep: 'keep_current' } }),
  fixture('routine-formula-overlap', { findings: [role, routineFormulaOverlap],
    routineImpacts: [{ id: 'overlap-impact', kind: 'active_overlap', candidate: { productId: binding.productId, variantId: binding.variantId, formulaVersionId: binding.formulaVersionId }, routineItemIds: ['routine-item:1'], findingIds: ['routine-formula-overlap'], uncertainty: ['Routine category is unknown.'] }],
    action: { kind: 'USE_WITH_CAUTION', findingIds: ['routine-formula-overlap'], primaryFindingId: 'routine-formula-overlap', nextStep: 'review_routine' } }),
  fixture('routine-experience', { findings: [role, redundancy, routineExperience],
    action: { kind: 'USE_WITH_CAUTION', findingIds: ['routine-experience', 'redundant-role'], primaryFindingId: 'routine-experience', nextStep: 'review_routine' } }),
  fixture('caution', { findings: [role, caution],
    action: { kind: 'USE_WITH_CAUTION', findingIds: ['prior-reaction', 'goal-role'], primaryFindingId: 'prior-reaction', nextStep: 'ask_clinician' } }),
  fixture('missing-formula', {
    binding: { ...binding, formulaVersionId: null }, findings: [role, missingFormula], evidenceNeeds: [tolerance, formulaNeed],
    action: { kind: 'NOT_ENOUGH_INFORMATION', findingIds: ['missing-formula'], primaryFindingId: 'missing-formula', nextStep: 'confirm_formula' },
  }, { ...product, formula: { state: 'unknown', reason: 'Exact formula not verified.' } }),
  fixture('partial-routine', { findings: [role, partialRoutine], routineImpacts: [unknownImpact],
    evidenceNeeds: [tolerance, { id: 'routine-completeness', code: 'routine_completeness', state: 'unknown', critical: true, findingIds: ['partial-routine'] }],
    action: { kind: 'NOT_ENOUGH_INFORMATION', findingIds: ['partial-routine'], primaryFindingId: 'partial-routine', nextStep: 'review_routine' } }),
  fixture('prior-reaction', { binding: { ...binding, formulaVersionId: null, profileRevision: null },
    findings: [caution, missingFormula], evidenceNeeds: [formulaNeed],
    action: { kind: 'USE_WITH_CAUTION', findingIds: ['prior-reaction', 'missing-formula'], primaryFindingId: 'prior-reaction', nextStep: 'ask_clinician' },
  }, { ...product, formula: { state: 'unknown', reason: 'Exact formula not verified.' } }),
  fixture('reformulation', { findings: [role, formulaChanged], evidenceNeeds: [tolerance,
    { id: 'current-experience', code: 'current_formula_experience', state: 'unknown', critical: true, findingIds: ['formula-changed'] }],
    action: { kind: 'NOT_ENOUGH_INFORMATION', findingIds: ['formula-changed', 'goal-role'], primaryFindingId: 'formula-changed', nextStep: 'add_context' } }),
];
