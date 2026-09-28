import assert from 'node:assert/strict';
import { CORPUS } from '../benchmarks/decision-intelligence/corpus.ts';
import { baseline, runBaseline } from '../benchmarks/decision-intelligence/harness.ts';
import { parseSoftJudgment } from '../benchmarks/decision-intelligence/schema.ts';
import { replayRecordedRuns, type RecordedRun } from '../benchmarks/decision-intelligence/replay.ts';
import { evaluatePersonalDecision } from '../src/domain/personal-decision/evaluate.ts';

assert.equal(new Set(CORPUS.map(c => c.id)).size, CORPUS.length);
for (const c of CORPUS) {
  assert.match(c.provenance.source, /^tests\/p0b-policy\.test\.ts:/);
  assert(c.provenance.rationale.length > 20);
  const packet = evaluatePersonalDecision(c.makeInput());
  assert.deepEqual(parseSoftJudgment(baseline(packet)), c.expected, c.id);
}
assert.throws(() => parseSoftJudgment({ routineContribution: 'incremental', overlap: 'none', abstain: true, needsMoreContext: false }), /SCHEMA_INVALID/);
assert.throws(() => parseSoftJudgment({ routineContribution: 'incremental', overlap: 'none', abstain: false, needsMoreContext: false, action: 'SKIP' }), /SCHEMA_INVALID/);
assert.throws(() => parseSoftJudgment({ routineContribution: 'unclear', overlap: 'unknown', abstain: true, needsMoreContext: false }), /SCHEMA_INVALID/);
const report = runBaseline();
assert.deepEqual(report, runBaseline());
assert.equal(report.cases, CORPUS.length);
assert.equal(report.results[0].evaluatedCases, CORPUS.length);
assert(report.results.slice(1).every(r => r.status === 'NOT_RUN' && r.evaluatedCases === 0 && r.exactLabelAccuracy === null && r.costUsdPerCase === null));
// These artificial records test offline replay arithmetic only. They are never reported as provider results.
const mock: RecordedRun = { provider: 'jev', modelVersion: 'test-only', adapterSha256: 'a'.repeat(64), promptSha256: 'b'.repeat(64),
  attempts: CORPUS.map(c => ({ caseId: c.id, output: c.expected, latencyMs: 5, costUsd: 0.01, inputTokens: 10, outputTokens: 1 })) };
const replay = replayRecordedRuns([mock, mock])[0];
assert.equal(replay.evaluatedCases, CORPUS.length * 2);
assert.equal(replay.repeatedRunStability, 1);
assert.equal(replay.p95LatencyMs, 5);
assert(Math.abs(replay.costUsdPerCase! - 0.01) < 1e-12);
assert.equal(replay.brierScore, null);
assert.throws(() => replayRecordedRuns([{ ...mock, attempts: [{ ...mock.attempts[0], output: undefined, failure: 'timeout' }, ...mock.attempts.slice(1), mock.attempts[0]] }]), /RUN_INVALID/);
console.log('Decision intelligence benchmark schema, provenance, baseline and repeatability passed');
