import { createHash } from 'node:crypto';
import { CORPUS, CORPUS_VERSION } from './corpus.ts';
import { evaluatePersonalDecision, ENGINE_VERSION, POLICY_VERSION } from '../../src/domain/personal-decision/evaluate.ts';
import { parseSoftJudgment, CONTRIBUTIONS, type Contribution, type SoftJudgmentV0 } from './schema.ts';
import type { PersonalDecisionPacketV1 } from '../../src/contracts/PersonalDecision.ts';

export const PROVIDERS = ['p0b_deterministic', 'jev', 'gemini_structured'] as const;
export type Provider = typeof PROVIDERS[number];
export interface Result {
  provider: Provider;
  status: 'RUN' | 'NOT_RUN';
  modelVersion: string | null;
  runCount: number;
  evaluatedCases: number;
  exactLabelAccuracy: number | null;
  macroF1: number | null;
  abstentionAccuracy: number | null;
  schemaValidity: number | null;
  criticalFalsePositiveCount: number | null;
  disagreementCaseIds: string[];
  providerFailures: number;
  repeatedRunStability: number | null;
  brierScore: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  costUsdPerCase: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface Report { corpusVersion: string; corpusSha256: string; provenance: string; cases: number; results: Result[]; }

export function baseline(packet: PersonalDecisionPacketV1): SoftJudgmentV0 {
  const impacts = packet.routineImpacts;
  const missing = packet.evidenceNeeds.some(n => n.critical);
  const replacement = impacts.some(i => i.kind === 'replacement_candidate');
  const redundant = impacts.some(i => i.kind === 'duplicates_role');
  const strongOverlap = impacts.some(i => i.kind === 'active_overlap' || i.kind === 'duplicates_role' || i.kind === 'replacement_candidate');
  const contribution: Contribution = replacement ? 'replacement_candidate' : redundant ? 'redundant' :
    !missing && packet.findings.some(f => f.kind === 'goal_role_match') ? 'incremental' : 'unclear';
  return parseSoftJudgment({ routineContribution: contribution, overlap: strongOverlap ? 'strong' : missing ? 'unknown' : 'none',
    needsMoreContext: missing, abstain: contribution === 'unclear' });
}

function macroF1(pairs: Array<[Contribution, Contribution]>): number {
  const labels = [...new Set(pairs.flat())];
  return labels.reduce((sum, label) => {
    const tp = pairs.filter(([expected, actual]) => expected === label && actual === label).length;
    const fp = pairs.filter(([expected, actual]) => expected !== label && actual === label).length;
    const fn = pairs.filter(([expected, actual]) => expected === label && actual !== label).length;
    return sum + (2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : 0);
  }, 0) / labels.length;
}

export function runBaseline(): Report {
  const rows = CORPUS.map(c => {
    const packet = evaluatePersonalDecision(c.makeInput());
    return { id: c.id, expected: c.expected, actual: baseline(packet), critical: packet.evidenceNeeds.some(n => n.critical) || packet.findings.some(f => f.severity === 'caution') };
  });
  const pairs = rows.map(r => [r.expected.routineContribution, r.actual.routineContribution] as [Contribution, Contribution]);
  const correct = rows.filter(r => r.expected.routineContribution === r.actual.routineContribution).length;
  const abstainCorrect = rows.filter(r => r.expected.abstain === r.actual.abstain).length;
  const falsePositive = rows.filter(r => r.critical && ['incremental', 'replacement_candidate'].includes(r.actual.routineContribution)).length;
  const corpusSha256 = createHash('sha256').update(JSON.stringify(CORPUS.map(c => ({ id: c.id, scenario: c.scenario, provenance: c.provenance, expected: c.expected, input: c.makeInput() })))).digest('hex');
  const common: Omit<Result, 'provider' | 'status' | 'modelVersion' | 'runCount' | 'evaluatedCases' | 'exactLabelAccuracy' | 'macroF1' | 'abstentionAccuracy' | 'schemaValidity' | 'criticalFalsePositiveCount' | 'disagreementCaseIds' | 'providerFailures' | 'repeatedRunStability'> =
    { brierScore: null, p50LatencyMs: null, p95LatencyMs: null, costUsdPerCase: null, inputTokens: null, outputTokens: null };
  const results: Result[] = [
    { provider: 'p0b_deterministic', status: 'RUN', modelVersion: `${ENGINE_VERSION};${POLICY_VERSION}`, runCount: 1,
      evaluatedCases: rows.length, exactLabelAccuracy: correct / rows.length, macroF1: macroF1(pairs),
      abstentionAccuracy: abstainCorrect / rows.length, schemaValidity: 1, criticalFalsePositiveCount: falsePositive,
      disagreementCaseIds: rows.filter(r => r.expected.routineContribution !== r.actual.routineContribution).map(r => r.id),
      providerFailures: 0, repeatedRunStability: null, ...common },
    ...(['jev', 'gemini_structured'] as const).map(provider => ({ provider, status: 'NOT_RUN' as const, modelVersion: null, runCount: 0,
      evaluatedCases: 0, exactLabelAccuracy: null, macroF1: null, abstentionAccuracy: null, schemaValidity: null,
      criticalFalsePositiveCount: null, disagreementCaseIds: [], providerFailures: 0, repeatedRunStability: null, ...common })),
  ];
  return { corpusVersion: CORPUS_VERSION, corpusSha256, provenance: 'Reviewed P0-B policy assertions; not independent founder-reviewed gold', cases: rows.length, results };
}
