import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePersonalDecisionPacket } from '../src/contracts/PersonalDecision.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';

const clone = <T>(value: T): T => structuredClone(value);

test('P0-B packets retain findings and bind the trusted product and owner context revisions', () => {
  for (const fixture of personalDecisionFixtures) {
    assert.deepEqual(validatePersonalDecisionPacket(fixture.packet, fixture.binding), []);
    assert.ok(fixture.packet.findings.length > 0);
  }
});

test('P0-B rejects dangling action references and duplicated finding IDs', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.action.findingIds = ['invented'];
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('action_finding_reference'));
  packet.findings.push(packet.findings[0]);
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('duplicate_finding_id'));
});

test('P0-B rejects owner switches, stale revisions and changed formula bindings', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  assert.ok(validatePersonalDecisionPacket(packet, { ...binding, ownerId: 'another-owner' }).includes('binding_mismatch'));
  assert.ok(validatePersonalDecisionPacket(packet, { ...binding, routineRevision: 'routine:2' }).includes('binding_mismatch'));
  assert.ok(validatePersonalDecisionPacket(packet, { ...binding, formulaVersionId: 'formula:2' }).includes('binding_mismatch'));
});

test('P0-B cannot promote a positive action while critical evidence is missing', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'missing-formula')!);
  packet.action.kind = 'COULD_WORK';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('positive_action_blocked'));
});

test('P0-B raw, commercial and model observations cannot become supporting evidence', () => {
  for (const source of ['raw_text', 'commercial', 'model'] as const) {
    const { packet, binding } = clone(personalDecisionFixtures[0]);
    packet.findings[0].evidence = [{ kind: 'observation', observationId: 'observation:1', source }];
    assert.ok(validatePersonalDecisionPacket(packet, binding).includes('unsupported_positive_finding'));
  }
});

test('P0-B fixture distinctions preserve partial routine and prior-formula history uncertainty', () => {
  const partial = personalDecisionFixtures.find((f) => f.id === 'partial-routine')!;
  assert.equal(partial.packet.action.kind, 'NOT_ENOUGH_INFORMATION');
  assert.ok(partial.packet.evidenceNeeds.some((need) => need.code === 'routine_completeness'));
  const prior = personalDecisionFixtures.find((f) => f.id === 'prior-reaction')!;
  assert.ok(prior.packet.findings.some((finding) => finding.kind === 'prior_product_reaction'));
  const changed = personalDecisionFixtures.find((f) => f.id === 'reformulation')!;
  assert.ok(changed.packet.evidenceNeeds.some((need) => need.code === 'current_formula_experience'));
});

test('P0-B rejects routine candidates outside the bound product and stale evidence', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'partial-routine')!);
  packet.routineImpacts[0].candidate.productId = 'another-product';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('routine_candidate_mismatch'));
  const evidence = packet.findings[1].evidence[0];
  assert.equal(evidence.kind, 'context_fact');
  if (evidence.kind === 'context_fact') evidence.revision = 'routine:0';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('evidence_binding_mismatch'));
});

test('P0-B rejects positive next steps attached to caution actions', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'caution')!);
  packet.action.nextStep = 'consider_use';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('action_next_step_mismatch'));
});

test('P0-B a severe consequence with unknown support cannot itself authorize caution', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'caution')!);
  packet.findings.find((finding) => finding.id === 'prior-reaction')!.confidence = 'unknown';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('unsupported_action'));
});

test('P0-B a missing-evidence blocker cannot authorize keep-current or skip', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'missing-formula')!);
  packet.findings[1].confidence = 'supported';
  packet.findings[1].evidence = [packet.findings[0].evidence[1]];
  for (const action of ['KEEP_CURRENT', 'SKIP'] as const) {
    packet.action.kind = action;
    packet.action.nextStep = action === 'KEEP_CURRENT' ? 'keep_current' : 'skip_product';
    assert.ok(validatePersonalDecisionPacket(packet, binding).includes('unsupported_action'));
  }
});

test('P0-B display facts cannot cite absent evidence or unbound personal context', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings[0].display = { kind: 'role_match', goal: 'dryness', category: 'moisturizer', evidenceIndexes: [99] };
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_reference'));
  packet.findings[0].display.evidenceIndexes = [0];
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_scope'));
});

test('P0-B supported product family can retain prior reaction with unknown variant', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'prior-reaction')!);
  packet.binding.variantId = null;
  binding.variantId = null;
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
});

test('P0-B routine evidence binds its owner, revision and separate item identity', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings[0].evidence.push({ kind: 'routine_product_fact', ownerId: binding.ownerId,
    routineRevision: binding.routineRevision!, routineItemId: 'routine-item:1', productId: 'other-product:1',
    variantId: null, formulaVersionId: null, scope: 'category', sourceId: 'other-category', sourceRevision: 'source:1' });
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
  const evidence = packet.findings[0].evidence.at(-1)!;
  if (evidence.kind === 'routine_product_fact') evidence.ownerId = 'other-owner';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('evidence_binding_mismatch'));
});

test('P0-B routine relation needs product authority beyond an owner context assertion', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings[0].display = { kind: 'routine_relation', routineItemIds: ['routine-item:1'], role: 'moisturizer', timing: 'unknown', frequency: 'unknown', evidenceIndexes: [2] };
  packet.findings[0].evidence.push({ kind: 'context_fact', section: 'routine', ownerId: binding.ownerId, revision: binding.routineRevision!, recordId: 'routine-item:1' });
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_scope'));
  packet.findings[0].evidence.push({ kind: 'routine_product_fact', ownerId: binding.ownerId, routineRevision: binding.routineRevision!,
    routineItemId: 'routine-item:1', productId: 'other-product:1', variantId: null, formulaVersionId: null,
    scope: 'category', sourceId: 'other-category', sourceRevision: 'source:1' });
  packet.findings[0].display.evidenceIndexes.push(3);
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
});

test('P0-B routine experience caution cites the exact existing item and history event', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings = [{ id: 'routine-experience', kind: 'routine_experience_caution', applicability: 'applicable', severity: 'caution', confidence: 'supported',
    ruleId: 'fixture:experience', ruleVersion: '1', evidenceNeedIds: [], uncertainty: [], evidence: [
      { kind: 'context_fact', section: 'routine', ownerId: binding.ownerId, revision: binding.routineRevision!, recordId: 'routine-item:1' },
      { kind: 'context_fact', section: 'history', ownerId: binding.ownerId, revision: binding.historyRevision!, recordId: 'history-event:1' }],
    display: { kind: 'routine_experience', routineItemIds: ['routine-item:1'], historyEventId: 'history-event:1', outcome: 'reaction', evidenceIndexes: [0, 1] } }];
  packet.evidenceNeeds = [];
  packet.action = { kind: 'USE_WITH_CAUTION', findingIds: ['routine-experience'], primaryFindingId: 'routine-experience', nextStep: 'review_routine' };
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
  packet.findings[0].display!.evidenceIndexes = [0];
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_scope'));
});

test('P0-B exact routine formula overlap survives unknown routine category without category promotion', () => {
  const { packet, binding } = clone(personalDecisionFixtures.find((f) => f.id === 'redundancy')!);
  const overlap = packet.findings.find((finding) => finding.kind === 'role_redundancy')!;
  overlap.kind = 'active_overlap';
  overlap.severity = 'caution';
  overlap.display = { kind: 'routine_relation', routineItemIds: ['routine-item:1'], role: 'unknown', timing: 'unknown', frequency: 'unknown', evidenceIndexes: [0, 1, 2] };
  const candidateEvidence = overlap.evidence[0];
  if (candidateEvidence.kind === 'product_fact') {
    candidateEvidence.scope = 'formula'; candidateEvidence.formulaVersionId = binding.formulaVersionId;
  }
  const routineEvidence = overlap.evidence[2];
  if (routineEvidence.kind === 'routine_product_fact') {
    routineEvidence.scope = 'formula'; routineEvidence.variantId = 'existing-variant:1'; routineEvidence.formulaVersionId = 'existing-formula:1';
  }
  packet.routineImpacts = [];
  packet.action = { kind: 'USE_WITH_CAUTION', findingIds: [overlap.id], primaryFindingId: overlap.id, nextStep: 'review_routine' };
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
  overlap.kind = 'role_redundancy';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_scope'));
  overlap.kind = 'replacement_candidate';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('display_evidence_scope'));
});

test('P0-B unsupported goal can route to facts without promising more intake supplies evidence', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings.push({ id: 'unsupported-goal', kind: 'no_supported_rule', applicability: 'applicable', severity: 'informational', confidence: 'unknown',
    ruleId: 'fixture:unsupported-goal', ruleVersion: '1', evidence: [], uncertainty: [], evidenceNeedIds: ['unsupported-goal-evidence'] });
  packet.evidenceNeeds.push({ id: 'unsupported-goal-evidence', code: 'supported_rule', state: 'missing', critical: true, findingIds: ['unsupported-goal'] });
  packet.action = { kind: 'NOT_ENOUGH_INFORMATION', findingIds: ['unsupported-goal', 'goal-role'], primaryFindingId: 'unsupported-goal', nextStep: 'view_product_facts' };
  assert.deepEqual(validatePersonalDecisionPacket(packet, binding), []);
  packet.action.kind = 'USE_WITH_CAUTION';
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('action_next_step_mismatch'));
});
