import assert from 'node:assert/strict';
import test from 'node:test';
import { extractionCorpus, realImageScenarios } from '../src/fixtures/product-truth-evaluation/corpus.ts';
import { candidateToResolverEvidence, evaluateExtraction, evaluationReport, parseExtractionCandidate } from '../src/fixtures/product-truth-evaluation/evaluator.ts';
import { resolveProductIdentity } from '../supabase/functions/_shared/product-identity.ts';
import { syntheticCatalog } from '../src/fixtures/product-truth-evaluation/corpus.ts';

const fixtureOutputs = () => Object.fromEntries(extractionCorpus.map(fixture => [fixture.id, fixture.gold]));

test('gold replay is explicitly synthetic and checks all fields, not a provider benchmark', () => {
  const report = evaluateExtraction(fixtureOutputs());
  assert.equal(report.scope, 'synthetic_text_only');
  assert.equal(report.passed, 15);
  assert.equal(report.failed, 0);
  assert.ok(extractionCorpus.every(fixture => fixture.provenance === 'synthetic'));
});

test('no provider outputs means no extraction run or reported accuracy', () => {
  const report = evaluationReport();
  assert.equal(report.extraction.executed, 0);
  assert.equal(report.extraction.notRun, 15);
  assert.equal(report.extraction.exactCandidateRate, null);
  assert.equal(report.provider, 'NONE_SELECTED');
  assert.equal(report.realImageAccuracy, null);
  assert.equal(report.cost, null);
  assert.equal(report.latencyMs, null);
  assert.ok(realImageScenarios.every(scenario => scenario.status === 'NOT_RUN'));
});

test('evaluator detects hallucination, order, number, unit and abstention mistakes independently', () => {
  const outputs = fixtureOutputs();
  outputs['front-label'] = { ...outputs['front-label'], variantText: 'invented' };
  outputs['ingredients-old'] = { ...outputs['ingredients-old'], orderedIngredients: ['Glycerin', 'Water', 'Panthenol'] };
  outputs['concentration-low'] = { ...outputs['concentration-low'], numbers: [{ text: '1', unitText: '% w/w', contextText: 'Synthetic active' }] };
  outputs['size-small'] = { ...outputs['size-small'], numbers: [{ text: '30', unitText: 'g', contextText: 'package size' }] };
  outputs.unknown = { ...outputs.unknown, outcome: 'candidate', abstentionReason: undefined, brandText: 'guessed' };
  const report = evaluateExtraction(outputs);
  assert.equal(report.failed, 5);
  assert.equal(report.passed, 10);
});

test('untrusted envelopes reject authority, wrong evidence binding, malformed arrays and guesses after abstention', () => {
  const candidate = extractionCorpus[0].gold;
  for (const value of [
    { ...candidate, verified: true }, { ...candidate, evidenceId: 'another-evidence' },
    { ...candidate, numbers: [{ text: '30', unitText: 'mL' }] },
    { ...candidate, orderedIngredients: [null] }, { ...candidate, orderedIngredients: [] },
    { ...candidate, outcome: 'abstained', abstentionReason: 'unreadable' },
  ]) assert.throws(() => parseExtractionCandidate(value, candidate.evidenceId));
});

test('provider resemblance and barcode text cannot acquire authoritative resolver status', () => {
  for (const fixture of extractionCorpus) {
    const evidence = candidateToResolverEvidence(parseExtractionCandidate(fixture.gold, fixture.id));
    assert.equal(evidence.barcode, undefined);
    assert.equal(evidence.brand, undefined);
    const decision = resolveProductIdentity(evidence, syntheticCatalog);
    assert.notEqual(decision.state, 'verified_product_formula');
    if (fixture.gold.outcome === 'abstained') assert.equal(decision.state, 'insufficient_evidence');
  }
});
