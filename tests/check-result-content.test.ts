import assert from 'node:assert/strict';
import test from 'node:test';
import { describeCheckResultContent } from '../src/presentation/check/result-sheet/content.ts';
import { verifiedProductTruth, unresolvedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { personalDecisionFixtures } from '../src/fixtures/personal-decision/fixtures.ts';
import type { PersonalDecisionPacketV1 } from '../src/contracts/PersonalDecision.ts';

const ownerId = 'fixture-owner:1';
function decision(id: string, formulaVersionId: string | null = verifiedProductTruth.formula!.formulaVersionId) {
  const fixture = personalDecisionFixtures.find(item => item.id === id)!;
  const replacements: Record<string, string> = {
    'fixture-snapshot:1': verifiedProductTruth.snapshotId, 'snapshot:1': '1',
    'sources:1': `p0a/v1:${verifiedProductTruth.resolverVersion}`,
    'fixture-product:1': verifiedProductTruth.product!.productId,
    'fixture-variant:1': verifiedProductTruth.product!.variantId!,
    'fixture-formula:1': verifiedProductTruth.formula!.formulaVersionId,
  };
  const packet: PersonalDecisionPacketV1 = JSON.parse(JSON.stringify(fixture.packet), (_key, value) =>
    typeof value === 'string' ? replacements[value] ?? value : value);
  packet.binding.formulaVersionId = formulaVersionId;
  return { kind: 'canonical' as const, packet, expectedBinding: { ...packet.binding } };
}

test('immutable facts win over changed catalog and a bound personal answer leads the result', () => {
  const model = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth,
    catalogFacts: { brand: 'Different', name: 'Changed', categoryLabel: 'treatment', formula: null, source: null },
    fit: decision('positive-role-match') });
  assert.equal(model.facts.name, 'Fixture Cleanser');
  assert.equal(model.fit.kind, 'canonical');
  assert.equal(model.outcome.kind, 'supported');
  assert.match(model.outcome.reason, /product role/);
  assert.deepEqual(model.facts.formula?.ingredients, ['Water', 'Glycerin']);
});

test('identity and formula gaps do not invite an irrelevant profile questionnaire', () => {
  for (const snapshot of [unresolvedProductTruth, formulaOnlyProductTruth,
    { ...verifiedProductTruth, state: 'identified_formula_unverified' as const, formula: null }]) {
    const model = describeCheckResultContent({ ownerId, snapshot, fit: { kind: 'legacy', state: { kind: 'factual_only' } } });
    assert.equal(model.canPersonalize, false);
    assert.equal(model.fit.kind, 'limitation');
    assert.equal(model.facts.formula, null);
    assert.ok(['identity_unconfirmed', 'formula_unverified'].includes(model.outcome.kind));
  }
});

test('unsupported rule and incomplete context remain distinct bound limitations', () => {
  const unsupported = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit: decision('unsupported-goal') });
  assert.equal(unsupported.outcome.kind, 'unsupported_rule');
  assert.equal(unsupported.canPersonalize, false);
  const context = decision('partial-routine');
  const missing = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit: context });
  assert.equal(missing.outcome.kind, 'context_missing');
  assert.equal(missing.canPersonalize, false, 'routine next action is not a profile setup prompt');
  assert.ok(missing.outcome.criticalUnknowns.some(text => /complete routine/.test(text)));
  const experience = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit: decision('reformulation') });
  assert.equal(experience.canPersonalize, false, 'an experience gap is not a profile setup prompt');
});

test('prior product caution remains visible despite an unverified formula', () => {
  const model = describeCheckResultContent({ ownerId,
    snapshot: { ...verifiedProductTruth, state: 'identified_formula_unverified', formula: null,
      catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null } },
    fit: decision('prior-reaction', null) });
  assert.equal(model.fit.kind, 'canonical');
  assert.match(model.outcome.reason, /previously reported a reaction/);
  assert.ok(model.outcome.criticalUnknowns.some(text => /formula has not been verified/.test(text)));
  assert.equal(model.canPersonalize, false);
});

test('stale snapshot, owner and formula bindings cannot display personal advice', () => {
  const fit = decision('positive-role-match');
  for (const input of [
    { ownerId: 'other-owner', snapshot: verifiedProductTruth },
    { ownerId, snapshot: { ...verifiedProductTruth, snapshotId: 'new-snapshot' } },
    { ownerId, snapshot: { ...verifiedProductTruth, caseRevision: 2 } },
    { ownerId, snapshot: { ...verifiedProductTruth, formula: { ...verifiedProductTruth.formula!, formulaVersionId: 'new-formula' } } },
  ]) {
    const model = describeCheckResultContent({ ...input, fit });
    assert.equal(model.fit.kind, 'limitation');
    assert.equal(model.outcome.kind, 'service_failure');
    assert.doesNotMatch(model.outcome.reason, /fits your/);
  }
});

test('loading, service, profile acknowledgement and preview incapability remain separate', () => {
  const seen = new Set<string>();
  for (const kind of ['loading', 'service_failure', 'profile_save_failure', 'preview_unavailable'] as const) {
    const model = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit: { kind } });
    assert.equal(model.outcome.kind, kind);
    assert.equal(model.canPersonalize, false);
    seen.add(model.outcome.reason);
  }
  assert.equal(seen.size, 4);
});

test('legacy unavailable save is distinct and legacy supported advice needs verified formula', () => {
  const failed = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth,
    fit: { kind: 'legacy', state: { kind: 'unavailable', reason: 'answers_not_saved' } } });
  assert.equal(failed.outcome.kind, 'profile_save_failure');
  const unsupported = describeCheckResultContent({ ownerId, snapshot: unresolvedProductTruth,
    fit: { kind: 'legacy', state: { kind: 'supported', fit: { label: 'COULD WORK', explanation: 'Should be hidden', evidenceUsed: [], uncertainty: null } } } });
  assert.equal(unsupported.outcome.kind, 'identity_unconfirmed');
  assert.doesNotMatch(unsupported.outcome.reason, /Should be hidden/);
});

test('a profile action is offered only for a validated relevant context need', () => {
  const fit = decision('missing-formula');
  const packet = fit.packet;
  packet.evidenceNeeds = packet.evidenceNeeds.map(need => need.code === 'verified_formula'
    ? { ...need, code: 'profile_context' } : need);
  packet.action.nextStep = 'add_context';
  const model = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit });
  assert.equal(model.canPersonalize, true);
  const unrelated = describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth,
    fit: { ...fit, packet: null } });
  assert.equal(unrelated.canPersonalize, false);
  assert.equal(unrelated.outcome.kind, 'service_failure');
});

test('a malformed independent binding fails closed without throwing during presentation', () => {
  const fit = decision('positive-role-match');
  fit.expectedBinding.sourceBoundaryRevision = undefined as unknown as string;
  assert.equal(describeCheckResultContent({ ownerId, snapshot: verifiedProductTruth, fit }).outcome.kind, 'service_failure');
});
