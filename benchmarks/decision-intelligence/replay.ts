import { CORPUS } from './corpus.ts';
import { CONTRIBUTIONS, parseSoftJudgment, type Contribution, type SoftJudgmentV0 } from './schema.ts';
import { evaluatePersonalDecision } from '../../src/domain/personal-decision/evaluate.ts';
import type { Provider, Result } from './harness.ts';

export interface RecordedAttempt {
  caseId: string;
  output?: unknown;
  failure?: 'unavailable' | 'timeout' | 'provider_error';
  /** Actual invocation measurements only. Never estimated from a price page. */
  latencyMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** Optional probabilities for the four contribution labels, in the same invocation. */
  probabilities?: Record<Contribution, number>;
}
export interface RecordedRun {
  provider: Exclude<Provider, 'p0b_deterministic'>;
  modelVersion: string;
  adapterSha256: string;
  promptSha256: string;
  attempts: RecordedAttempt[];
}
const digest = /^[a-f0-9]{64}$/;
const finite = (v: number) => Number.isFinite(v) && v >= 0;
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil(p * values.length) - 1];

/** Offline comparison of supplied records. It does not authenticate provider origin or call a network. */
export function replayRecordedRuns(runs: RecordedRun[]): Result[] {
  const ids = CORPUS.map(c => c.id);
  const byProvider = new Map<RecordedRun['provider'], RecordedRun[]>();
  for (const run of runs) {
    if (!['jev', 'gemini_structured'].includes(run.provider) || !run.modelVersion.trim() || !digest.test(run.adapterSha256) || !digest.test(run.promptSha256) ||
        run.attempts.length !== ids.length || new Set(run.attempts.map(a => a.caseId)).size !== ids.length || run.attempts.some(a => !ids.includes(a.caseId))) throw new Error('RUN_INVALID');
    for (const a of run.attempts) {
      if (!finite(a.latencyMs) || !finite(a.costUsd) || !Number.isSafeInteger(a.inputTokens) || a.inputTokens < 0 || !Number.isSafeInteger(a.outputTokens) || a.outputTokens < 0 ||
          (a.output === undefined) === (a.failure === undefined)) throw new Error('ATTEMPT_INVALID');
      if (a.probabilities) {
        const keys = Object.keys(a.probabilities).sort();
        if (keys.join(',') !== [...CONTRIBUTIONS].sort().join(',') || !Object.values(a.probabilities).every(v => finite(v) && v <= 1) ||
            Math.abs(Object.values(a.probabilities).reduce((x, y) => x + y, 0) - 1) > 1e-6 || a.output === undefined) throw new Error('PROBABILITIES_INVALID');
      }
    }
    byProvider.set(run.provider, [...(byProvider.get(run.provider) ?? []), run]);
  }
  return [...byProvider].map(([provider, providerRuns]) => {
    const first = providerRuns[0];
    if (providerRuns.some(run => run.modelVersion !== first.modelVersion || run.adapterSha256 !== first.adapterSha256 || run.promptSha256 !== first.promptSha256)) throw new Error('RUN_CONFIG_MISMATCH');
    const attempts = providerRuns.flatMap(run => run.attempts);
    const valid: Array<{ id: string; expected: SoftJudgmentV0; actual: SoftJudgmentV0; critical: boolean; probabilities?: Record<Contribution, number> }> = [];
    for (const a of attempts) {
      if (a.output === undefined) continue;
      try {
        const actual = parseSoftJudgment(a.output);
        const c = CORPUS.find(row => row.id === a.caseId)!;
        const packet = evaluatePersonalDecision(c.makeInput());
        valid.push({ id: a.caseId, expected: c.expected, actual,
          critical: packet.evidenceNeeds.some(n => n.critical) || packet.findings.some(f => f.severity === 'caution'), probabilities: a.probabilities });
      } catch (error) { if (!(error instanceof Error) || error.message !== 'SCHEMA_INVALID') throw error; }
    }
    const pairs = valid.map(r => [r.expected.routineContribution, r.actual.routineContribution] as const);
    const labels = [...new Set(pairs.flat())];
    const macroF1 = labels.length ? average(labels.map(label => {
      const tp = pairs.filter(([gold, actual]) => gold === label && actual === label).length;
      const fp = pairs.filter(([gold, actual]) => gold !== label && actual === label).length;
      const fn = pairs.filter(([gold, actual]) => gold === label && actual !== label).length;
      return 2 * tp / (2 * tp + fp + fn);
    })) : null;
    const brierRows = valid.filter(r => r.probabilities);
    const byCase = ids.map(id => valid.filter(row => row.id === id).map(row => row.actual));
    const stabilityPairs = byCase.flatMap(outputs => outputs.flatMap((a, i) => outputs.slice(i + 1).map(b => Number(JSON.stringify(a) === JSON.stringify(b)))));
    return { provider, status: 'RUN', modelVersion: first.modelVersion, runCount: providerRuns.length, evaluatedCases: valid.length,
      exactLabelAccuracy: valid.length ? valid.filter(r => r.expected.routineContribution === r.actual.routineContribution).length / valid.length : null,
      macroF1, abstentionAccuracy: valid.length ? valid.filter(r => r.expected.abstain === r.actual.abstain).length / valid.length : null,
      schemaValidity: attempts.filter(a => a.output !== undefined).length ? valid.length / attempts.filter(a => a.output !== undefined).length : null,
      criticalFalsePositiveCount: valid.filter(r => r.critical && ['incremental', 'replacement_candidate'].includes(r.actual.routineContribution)).length,
      disagreementCaseIds: [...new Set(valid.filter(r => r.expected.routineContribution !== r.actual.routineContribution).map(r => r.id))].sort(),
      providerFailures: attempts.filter(a => a.failure !== undefined).length, repeatedRunStability: stabilityPairs.length ? average(stabilityPairs) : null,
      brierScore: brierRows.length ? average(brierRows.map(r => average(CONTRIBUTIONS.map(label => (r.probabilities![label] - Number(r.expected.routineContribution === label)) ** 2)))) : null,
      p50LatencyMs: percentile(attempts.map(a => a.latencyMs), 0.5), p95LatencyMs: percentile(attempts.map(a => a.latencyMs), 0.95),
      costUsdPerCase: average(attempts.map(a => a.costUsd)), inputTokens: attempts.reduce((sum, a) => sum + a.inputTokens, 0),
      outputTokens: attempts.reduce((sum, a) => sum + a.outputTokens, 0) } satisfies Result;
  });
}
