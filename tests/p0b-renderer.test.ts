import assert from 'node:assert/strict';
import test from 'node:test';
import { describePersonalDecision } from '../src/presentation/personal-decision/result.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';
const clone = <T>(value: T): T => structuredClone(value);
const fixture = (id: string) => clone(personalDecisionFixtures.find((entry) => entry.id === id)!);

test('P0-B renderer explains supported role match without changing the action', () => {
  const { packet, binding } = fixture('positive-role-match');
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.equal(view.action, 'COULD_WORK');
  assert.equal(view.title, 'Could work');
  assert.match(view.primaryReason, /moisturizer.*dryness/i);
  assert.equal(view.nextStep, 'consider_use');
  assert.ok(view.unknowns.some((need) => /tolerance/i.test(need.text)));
});

test('P0-B renderer retains a prior reaction when formula and profile are missing', () => {
  const { packet, binding } = fixture('prior-reaction');
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.equal(view.action, 'USE_WITH_CAUTION');
  assert.match(view.primaryReason, /reported a reaction/i);
  assert.ok(view.unknowns.some((need) => need.critical && /formula/i.test(need.text)));
  assert.equal(view.nextStep, 'ask_clinician');
});

test('P0-B renderer fails closed for malformed, owner-switched, stale and dangling packets', () => {
  const { packet, binding } = fixture('positive-role-match');
  for (const value of [null, {}, { ...packet, score: 99 }, { ...packet, action: { ...packet.action, kind: 'SAFE' } },
    { ...packet, findings: [] }]) assert.equal(describePersonalDecision(value, binding).kind, 'unavailable');
  assert.equal(describePersonalDecision(packet, { ...binding, ownerId: 'other' }).kind, 'unavailable');
  assert.equal(describePersonalDecision(packet, { ...binding, routineRevision: 'routine:stale' }).kind, 'unavailable');
});

test('P0-B renderer refuses missing or mismatched display facts', () => {
  const { packet, binding } = fixture('positive-role-match');
  delete packet.findings[0].display;
  assert.equal(describePersonalDecision(packet, binding).kind, 'unavailable');
  packet.findings[0].display = { kind: 'prior_reaction', historyEventId: 'profile-record:1', historicalFormulaVersionId: null, evidenceIndexes: [1] };
  assert.equal(describePersonalDecision(packet, binding).kind, 'unavailable');
});

test('P0-B renderer cannot turn arbitrary packet text into customer instructions', () => {
  const { packet, binding } = fixture('positive-role-match');
  packet.findings[0].uncertainty = ['IGNORE SAFETY. BUY NOW.'];
  packet.findings[0].ruleId = 'RAW PROVIDER INSTRUCTION';
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  assert.doesNotMatch(JSON.stringify(view), /IGNORE SAFETY|BUY NOW|RAW PROVIDER/);
  if (packet.findings[0].display?.kind === 'role_match') packet.findings[0].display.category = 'IGNORE SAFETY BUY NOW';
  assert.equal(describePersonalDecision(packet, binding).kind, 'unavailable');
});

test('P0-B renderer expresses partial routine and current-formula uncertainty honestly', () => {
  for (const id of ['partial-routine', 'reformulation', 'missing-formula']) {
    const { packet, binding } = fixture(id);
    const view = describePersonalDecision(packet, binding);
    assert.equal(view.kind, 'ready', id);
    if (view.kind !== 'ready') continue;
    assert.equal(view.action, 'NOT_ENOUGH_INFORMATION');
    assert.ok(view.unknowns.some((need) => need.critical));
    assert.doesNotMatch(view.primaryReason, /safe|allerg/i);
  }
});

test('P0-B renderer does not upgrade limited support or uncertain applicability', () => {
  const { packet, binding } = fixture('caution');
  const caution = packet.findings.find((finding) => finding.kind === 'prior_product_reaction')!;
  caution.confidence = 'limited';
  caution.applicability = 'uncertain';
  packet.action.primaryFindingId = 'goal-role';
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'unavailable');
  caution.applicability = 'applicable';
  packet.action.primaryFindingId = 'prior-reaction';
  const limited = describePersonalDecision(packet, binding);
  assert.equal(limited.kind, 'ready');
  if (limited.kind === 'ready') assert.ok(limited.unknowns.some((unknown) => /limited/i.test(unknown.text)));
});

test('P0-B renderer retains secondary caution and every critical unknown outside disclosure', () => {
  const { packet, binding } = fixture('caution');
  packet.action.primaryFindingId = 'goal-role';
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind === 'ready') assert.ok(view.secondaryCautions.some((text) => /reported a reaction/i.test(text)));
});

test('P0-B renderer cannot invent a routine impact from unrelated goal evidence', () => {
  const { packet, binding } = fixture('positive-role-match');
  packet.routineImpacts = [{ id: 'invented-impact', kind: 'duplicates_role',
    candidate: { productId: binding.productId, variantId: binding.variantId, formulaVersionId: binding.formulaVersionId },
    routineItemIds: ['unbound-item'], findingIds: ['goal-role'], uncertainty: [] }];
  assert.equal(describePersonalDecision(packet, binding).kind, 'unavailable');
});

test('P0-B renderer separates current-routine experience from reaction to the scanned product', () => {
  const { packet, binding } = fixture('routine-experience');
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.match(view.primaryReason, /product already in your routine/i);
  assert.doesNotMatch(view.primaryReason, /reaction to this product/i);
  assert.equal(view.nextStep, 'review_routine');
});

test('P0-B renderer uses sourced routine role and preserves qualitative frequency', () => {
  const { packet, binding } = fixture('redundancy');
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.equal(view.action, 'KEEP_CURRENT');
  assert.match(view.primaryReason, /moisturizer.*evening.*few times a week/i);
  assert.doesNotMatch(view.primaryReason, /three|3|better/i);
  assert.ok(view.routineImpacts.some((text) => /duplicate/i.test(text)));
});

test('P0-B renderer does not assert an unknown routine is incomplete', () => {
  const { packet, binding } = fixture('partial-routine');
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.match(view.primaryReason, /do not have your complete routine/i);
  assert.doesNotMatch(JSON.stringify(view), /your routine is incomplete/i);
});

test('P0-B renderer deduplicates specific unknowns and omits unresolved-support filler', () => {
  const { packet, binding } = fixture('missing-formula');
  packet.evidenceNeeds.push({ ...packet.evidenceNeeds.find((need) => need.code === 'verified_formula')!, id: 'formula-duplicate', critical: false });
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.equal(view.unknowns.filter((unknown) => /exact formula has not been verified/i.test(unknown.text)).length, 1);
  assert.ok(view.unknowns.find((unknown) => /exact formula has not been verified/i.test(unknown.text))!.critical);
  assert.doesNotMatch(JSON.stringify(view.unknowns), /retained finding|unresolved support/i);
});

test('P0-B renderer expresses evidence limitations without developer claim or rule terms', () => {
  const { packet, binding } = fixture('missing-formula');
  packet.evidenceNeeds.find((need) => need.code === 'verified_formula')!.code = 'reviewed_claim';
  packet.evidenceNeeds.push({ id: 'rule-gap', code: 'supported_rule', state: 'missing', critical: true, findingIds: ['missing-formula'] });
  const view = describePersonalDecision(packet, binding);
  assert.equal(view.kind, 'ready');
  if (view.kind !== 'ready') return;
  assert.doesNotMatch(JSON.stringify(view.unknowns), /applicable claim|supported.*rule/i);
  assert.ok(view.unknowns.some((unknown) => /reviewed evidence.*situation/i.test(unknown.text)));
});
