import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { coverageSha256, evaluateCoverage, parseCoverageCorpus, unpreparedCoverageReport } from '../scripts/catalog-coverage-benchmark.ts';

const identity = { brand: 'Fiction', name: 'Synthetic Lotion', variant: 'Plain', packageSize: '100 mL', region: 'US' };
interface TestCandidate { identity: typeof identity; recordRef: string; retrievedAt: string; datasetVersion: string; canonicalProductId?: string; formulaSnapshotId?: string }
interface TestEntry { caseId: string; outcome: string; latencyMs: number; action: string; claim: string; candidate?: TestCandidate;
  review?: { identityMatch: string; reviewerRef: string; evidenceRef: string;
    customerConfirmation?: { confirmedExactPackageVariant: boolean; evidenceRef: string } } }
const candidate: TestCandidate = { identity, recordRef: 'synthetic-record', retrievedAt: '2026-09-28T00:00:00Z', datasetVersion: 'synthetic-v1' };
function fixture() {
  // Deliberately fabricated self-check, not a measured U.S. personal-care corpus.
  const corpus = { schemaVersion: 1, cohort: 'synthetic-test', cases: [
    { id: 'a', gtin: '000000000000', category: 'facial_moisturizer', channel: 'drugstore', scan: { decoded: true, deviceEvidenceRef: 'synthetic-device' },
      reference: { identity, evidenceRef: 'synthetic-reference', canonicalProductId: 'canonical-a', formulaSnapshotId: 'formula-a' },
      rights: { collectionEvidenceRef: 'synthetic-collection', permissionEvidenceRef: 'synthetic-permission', providerEvaluationAllowed: true } },
    { id: 'b', gtin: '000000000017', category: 'sunscreen', channel: 'beauty_retail', scan: { decoded: false, deviceEvidenceRef: 'synthetic-device' },
      reference: { identity: { ...identity, name: 'Synthetic Sunscreen' }, evidenceRef: 'synthetic-reference-b' },
      rights: { collectionEvidenceRef: 'synthetic-collection', permissionEvidenceRef: 'synthetic-permission', providerEvaluationAllowed: true } },
  ], sources: [
    { id: 'external', kind: 'external', evaluationPermissionRef: 'synthetic-evaluation-permission', termsReviewRef: 'synthetic-terms-review' },
    { id: 'canonical', kind: 'canonical', evaluationPermissionRef: 'synthetic-evaluation-permission', termsReviewRef: 'synthetic-terms-review' },
  ] };
  const json = JSON.stringify(corpus);
  const digest = coverageSha256(json);
  const entry: TestEntry = { caseId: 'a', outcome: 'candidate', latencyMs: 20, action: 'confirm_candidate', claim: 'candidate', candidate,
    review: { identityMatch: 'exact', reviewerRef: 'independent-reviewer', evidenceRef: 'synthetic-audit' } };
  const run = { sourceId: 'external', adapterVersion: 'synthetic-v1', corpusSha256: digest, entries: [entry] as TestEntry[] };
  return { corpus, json, digest, run };
}
const evaluate = (f = fixture(), runs: unknown = [f.run]) => evaluateCoverage(f.json, f.digest, runs);

test('no real corpus or run reports a winner or an accuracy number', () => {
  assert.deepEqual(unpreparedCoverageReport(), { schemaVersion: 1, status: 'RIGHTS_CLEARED_US_PERSONAL_CARE_CORPUS_REQUIRED', corpusCount: 0,
    usefulScanHitRate: null, sourceWinner: 'NONE_SELECTED' });
  const f = fixture(); const report = evaluate(f, []);
  assert.equal(report.sourceWinner, 'NONE_SELECTED');
  assert.equal(report.sources[0].status, 'NOT_RUN');
  assert.equal(report.sources[0].rates.usefulScanHit, null);
  assert.equal(report.sources[0].counts.notRun, 2);
});

test('launch personal-care categories and warehouse-club channel retain separate denominator slices', () => {
  const f = fixture();
  const categories = ['facial_cleanser', 'facial_moisturizer', 'sunscreen', 'facial_serum', 'facial_treatment',
    'deodorant', 'antiperspirant', 'shampoo', 'conditioner', 'body_wash', 'body_moisturizer'];
  f.corpus.cases = categories.map((category, index) => ({ ...f.corpus.cases[0], id: `synthetic-${index}`, category,
    channel: 'warehouse_club' }));
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json);
  const source = evaluate(f, []).sources[0];
  assert.equal(source.denominator, categories.length);
  assert.equal(source.byChannel.warehouse_club.total, categories.length);
  for (const category of categories) assert.equal(source.byCategory[category as keyof typeof source.byCategory].total, 1);
  assert.equal(source.byCategory.other.total, 0);
  f.corpus.cases[0].category = 'moisturizer'; // Old ambiguous bucket must not swallow face/body moisturizer.
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json);
  assert.throws(() => evaluate(f, []));
});

test('full cohort denominator includes source misses, absent rows and camera decode failures', () => {
  const f = fixture(); const source = evaluate(f).sources[0];
  assert.equal(source.status, 'PARTIAL');
  assert.equal(source.denominator, 2);
  assert.equal(source.counts.usefulHit, 1);
  assert.equal(source.rates.usefulScanHit, null);
  assert.equal(source.rates.usefulScanHitLowerBound, .5);
  assert.equal(source.rates.decode, .5);
  assert.equal(source.byCategory.facial_moisturizer.usefulHit, 1);
  assert.equal(source.byCategory.sunscreen.usefulHit, 0);
  f.run.entries.push({ ...f.run.entries[0], caseId: 'b', candidate: { ...candidate, identity: f.corpus.cases[1].reference.identity } });
  assert.equal(evaluate(f).sources[0].counts.usefulHit, 1);
  assert.equal(evaluate(f).sources[0].counts.exactCandidate, 2);
  assert.equal(evaluate(f).sources[0].rates.usefulScanHit, .5);
});

test('external records cannot become verified product or formula even if they claim it', () => {
  const f = fixture(); f.run.entries[0].claim = 'canonical_formula'; f.run.entries[0].action = 'show_verified_formula';
  f.run.entries[0].candidate = { ...candidate, canonicalProductId: 'canonical-a', formulaSnapshotId: 'formula-a' };
  const source = evaluate(f).sources[0];
  assert.equal(source.counts.verifiedExactProduct, 0);
  assert.equal(source.counts.verifiedFormula, 0);
  assert.equal(source.counts.usefulHit, 0);
  assert.equal(source.counts.falseCertainty, 1);
});

test('canonical exact and formula require linked corpus evidence and proper presentation', () => {
  const f = fixture();
  const run = { ...f.run, sourceId: 'canonical', entries: [{ ...f.run.entries[0], claim: 'canonical_formula', action: 'show_verified_formula',
    candidate: { ...candidate, canonicalProductId: 'canonical-a', formulaSnapshotId: 'formula-a' } }] };
  const source = evaluate(f, [run]).sources[1];
  assert.equal(source.counts.verifiedExactProduct, 1);
  assert.equal(source.counts.verifiedFormula, 1);
  assert.equal(source.counts.usefulHit, 1);
  run.entries[0].candidate!.formulaSnapshotId = 'other-formula';
  const unsupported = evaluate(f, [run]).sources[1];
  assert.equal(unsupported.counts.verifiedExactProduct, 1);
  assert.equal(unsupported.counts.verifiedFormula, 0);
  assert.equal(unsupported.counts.falseCertainty, 1);
});

test('wrong and unreviewed candidate identity cannot count as useful or honest', () => {
  const f = fixture();
  for (const identityMatch of ['wrong', 'unknown']) {
    f.run.entries[0].review!.identityMatch = identityMatch;
    const source = evaluate(f).sources[0];
    assert.equal(source.counts.usefulHit, 0);
    assert.equal(source.counts.falseCertainty, 1);
  }
  f.run.entries[0].review!.identityMatch = 'possible';
  assert.equal(evaluate(f).sources[0].counts.usefulHit, 0);
  assert.equal(evaluate(f).sources[0].counts.possibleCandidate, 1);
  f.run.entries[0].review!.customerConfirmation = { confirmedExactPackageVariant: true, evidenceRef: 'synthetic-customer-observation' };
  assert.equal(evaluate(f).sources[0].counts.usefulHit, 1);
  assert.equal(evaluate(f).sources[0].counts.confirmedPossibleCandidate, 1);
});

test('miss/error/timeout remain separate and can provide a cautious fallback action', () => {
  const f = fixture();
  f.run.entries = [
    { caseId: 'a', outcome: 'miss', latencyMs: 12, action: 'capture_label', claim: 'candidate' },
    { caseId: 'b', outcome: 'timeout', latencyMs: 500, action: 'search_name', claim: 'candidate' },
  ];
  const source = evaluate(f).sources[0];
  assert.equal(source.status, 'COMPLETE');
  assert.equal(source.counts.miss, 1); assert.equal(source.counts.timeout, 1);
  assert.equal(source.counts.honestNextAction, 2);
  assert.equal(source.counts.usefulHit, 0);
  assert.deepEqual(source.latencyMs, { median: 12, p95: 500 });
});

test('frozen corpus, rights gate, duplicate case IDs and duplicate run rows fail closed', () => {
  const f = fixture();
  assert.throws(() => parseCoverageCorpus(f.json + ' ', f.digest));
  assert.throws(() => evaluate(f, [f.run, f.run]));
  assert.throws(() => evaluate(f, [{ ...f.run, entries: [f.run.entries[0], f.run.entries[0]] }]));
  f.corpus.cases[1].id = f.corpus.cases[0].id;
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json);
  assert.throws(() => evaluate(f, []));
  f.corpus.cases[1].id = 'b';
  f.corpus.cases[0].rights.providerEvaluationAllowed = false;
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json); f.run.corpusSha256 = f.digest;
  assert.throws(() => evaluate(f));
});

test('invalid GTIN check digit and missing candidate provenance or independent review fail closed', () => {
  const f = fixture();
  f.corpus.cases[0].gtin = '000000000001';
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json);
  assert.throws(() => evaluate(f, []));
  f.corpus.cases[0].gtin = '000000000000';
  f.json = JSON.stringify(f.corpus); f.digest = coverageSha256(f.json); f.run.corpusSha256 = f.digest;
  f.run.entries[0].candidate!.recordRef = '';
  assert.throws(() => evaluate(f));
  f.run.entries[0].candidate!.recordRef = 'synthetic-record';
  f.run.entries[0].review!.reviewerRef = '';
  assert.throws(() => evaluate(f));
});

test('report and CLI never reveal raw barcodes, vendor identity, rights or source-record details', () => {
  const f = fixture(); const report = JSON.stringify(evaluate(f));
  for (const hidden of ['000000000000', 'Synthetic Lotion', 'synthetic-permission', 'synthetic-record']) assert.equal(report.includes(hidden), false);
  const directory = mkdtempSync(join(tmpdir(), 'derive-coverage-test-'));
  try {
    const corpusPath = join(directory, 'corpus.json'); const runsPath = join(directory, 'runs.json');
    writeFileSync(corpusPath, f.json); writeFileSync(runsPath, JSON.stringify([f.run]));
    const command = (path = corpusPath) => spawnSync(process.execPath,
      ['--experimental-strip-types', 'scripts/catalog-coverage-benchmark-cli.ts', path, f.digest, runsPath], { encoding: 'utf8' });
    assert.equal(command().status, 0);
    const link = join(directory, 'linked.json'); symlinkSync(corpusPath, link);
    const failed = command(link);
    assert.equal(failed.status, 1);
    assert.ok(failed.stderr.startsWith('INVALID_CATALOG_COVERAGE_INPUT'));
    assert.equal(failed.stderr.includes(f.corpus.cases[0].gtin), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
