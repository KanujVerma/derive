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

test('P0-B observations and scores cannot become supporting evidence', () => {
  const { packet, binding } = clone(personalDecisionFixtures[0]);
  packet.findings[0].evidence = [{ kind: 'observation', observationId: 'raw-text:1', source: 'raw_text' }];
  assert.ok(validatePersonalDecisionPacket(packet, binding).includes('unsupported_positive_finding'));
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
