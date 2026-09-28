import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CORPUS, CORPUS_VERSION, corpusSha256, type Case } from './corpus.ts';
import { CONTRIBUTIONS, OVERLAPS, parseSoftJudgment, type Contribution, type SoftJudgmentV0 } from './schema.ts';
import type { RecordedAttempt, RecordedRun } from './replay.ts';

type Challenger = 'jev' | 'gemini_structured';
export interface ProviderRequest { url: string; body: Record<string, unknown>; promptSha256: string; adapterSha256: string }
export interface DecodedResponse { output: SoftJudgmentV0; inputTokens: number | null; outputTokens: number | null;
  /** No provider API response is proof of the amount billed. */
  costUsd: null; probabilities?: Record<Contribution, number> }
export interface ProviderRunOptions {
  provider: Challenger;
  modelVersion: string;
  runs: number;
  pin: { corpusVersion: string; corpusSha256: string };
  /** Supplied only after credential, privacy, and spend gates are reviewed. The module never reads credentials or calls fetch. */
  invoke: (request: ProviderRequest) => Promise<unknown>;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const ownSource = readFileSync(new URL(import.meta.url), 'utf8');
const PROMPT_VERSION = 'synthetic-soft-judgment/1';
const instruction = 'Assess only the practical relation of the candidate to the reported routine. Unknown or conflicting evidence stays unknown. Do not infer product identity, formula, safety, diagnosis, prescription changes, or a final customer action.';
const jevQuestions = {
  contribution: { type: 'choice', instructions: 'Which narrow contribution relation is supported by the state?', criteria: {
    incremental: 'A supported role adds something absent from a complete routine.',
    redundant: 'A sourced current item already performs the same role.',
    replacement_candidate: 'Explicit replacement intent and a sourced current role match.',
    unclear: 'Evidence does not establish one of the other relations.',
  } },
  overlap: { type: 'choice', instructions: 'What role overlap with a current product is supported?', criteria: {
    none: 'Complete routine with no sourced current role match.', partial: 'Some supported overlap but not a full role match.',
    strong: 'A sourced current role match.', unknown: 'Routine or product evidence does not establish overlap.',
  } },
  needs_context: { type: 'noul', instructions: 'Is material context missing or conflicting for this relation?' },
} as const;
const outputSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    routineContribution: { type: 'string', enum: [...CONTRIBUTIONS] },
    overlap: { type: 'string', enum: [...OVERLAPS] },
    needsMoreContext: { type: 'boolean' }, abstain: { type: 'boolean' },
  }, required: ['routineContribution', 'overlap', 'needsMoreContext', 'abstain'],
} as const;

/** A synthetic-only, minimal view. Never includes corpus labels, identifiers, names, owner or source revisions. */
export function projectSyntheticCase(c: Case) {
  const input = c.makeInput();
  return {
    intent: input.intent,
    candidateCategory: input.product.category.state === 'known' ? input.product.category.value : input.product.category.state,
    candidateFormulaState: input.product.formula.state,
    candidateIngredients: input.product.formula.state === 'known' ? input.product.formula.value.ingredients : [],
    primaryGoal: input.profile?.primaryGoal ?? 'unknown',
    skinBehavior: input.profile?.skinBehavior ?? 'unknown',
    routineCompleteness: input.routine?.completeness ?? 'unknown',
    currentRoutine: input.routine?.items.filter(item => item.state === 'current').map(item => ({
      category: item.category.state === 'known' ? item.category.value : item.category.state,
      categorySourced: item.category.state === 'known' && item.category.sourceIds.length > 0,
      timing: item.timing, frequency: item.frequency,
    })) ?? [],
    priorCandidateReaction: input.history?.events.some(event => event.productId === input.binding.productId && event.outcome === 'reaction') ?? false,
  };
}

export function buildProviderRequest(provider: Challenger, modelVersion: string, c: Case): ProviderRequest {
  if (!/^[a-z][a-z0-9.-]{2,80}$/.test(modelVersion)) throw new Error('MODEL_INVALID');
  const state = projectSyntheticCase(c);
  const prompt = { version: PROMPT_VERSION, instruction,
    ...(provider === 'jev' ? { questions: jevQuestions } : { outputSchema }) };
  const promptSha256 = sha256(JSON.stringify(prompt));
  const adapterSha256 = sha256(`${provider}\n${ownSource}`);
  if (provider === 'jev') {
    return { url: 'https://api.typesafe.ai/v1/systemone',
      body: { state: { instruction, facts: state }, model: modelVersion, questions: jevQuestions }, promptSha256, adapterSha256 };
  }
  return { url: `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent`,
    body: {
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ instruction, facts: state }) }] }],
      generationConfig: { temperature: 0, candidateCount: 1, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: outputSchema } } },
    }, promptSha256, adapterSha256 };
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROVIDER_RESPONSE_INVALID');
  return value as Record<string, unknown>;
};
const maybeCount = (value: unknown): number | null => value === undefined ? null : Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : (() => { throw new Error('PROVIDER_RESPONSE_INVALID'); })();
const probability = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : (() => { throw new Error('PROVIDER_RESPONSE_INVALID'); })();
const choice = <T extends string>(value: unknown, choices: readonly T[]): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error('PROVIDER_RESPONSE_INVALID');
  return value as T;
};

/** Parses provider data into a fresh non-authoritative signal. No raw provider text survives. */
export function decodeProviderResponse(provider: Challenger, modelVersion: string, raw: unknown): DecodedResponse {
  try {
    const response = record(raw);
    const actualModel = provider === 'jev' ? response.model : response.modelVersion;
    if (actualModel !== modelVersion) throw new Error('MODEL_MISMATCH');
    if (provider === 'jev') {
      const answers = record(response.answers);
      const contribution = record(answers.contribution);
      const overlap = record(answers.overlap);
      const context = record(answers.needs_context);
      if (contribution.type !== 'choice' || overlap.type !== 'choice' || context.type !== 'noul') throw new Error('PROVIDER_RESPONSE_INVALID');
      const routineContribution = choice(contribution.choice, CONTRIBUTIONS);
      const overlapLabel = choice(overlap.choice, OVERLAPS);
      const distribution = record(contribution.probabilities);
      if (Object.keys(distribution).sort().join(',') !== [...CONTRIBUTIONS].sort().join(',')) throw new Error('PROVIDER_RESPONSE_INVALID');
      const probabilities = Object.fromEntries(CONTRIBUTIONS.map(label => [label, probability(distribution[label])])) as Record<Contribution, number>;
      if (Math.abs(Object.values(probabilities).reduce((sum, p) => sum + p, 0) - 1) > 1e-6) throw new Error('PROVIDER_RESPONSE_INVALID');
      if (probabilities[routineContribution] + 1e-9 < Math.max(...Object.values(probabilities))) throw new Error('PROVIDER_RESPONSE_INVALID');
      const output = parseSoftJudgment({ routineContribution, overlap: overlapLabel,
        needsMoreContext: probability(context.noul) >= 0.5, abstain: routineContribution === 'unclear' });
      const usage = record(response.usage);
      return { output, probabilities, inputTokens: maybeCount(usage.input_tokens), outputTokens: maybeCount(usage.output_tokens), costUsd: null };
    }
    const candidates = response.candidates;
    if (!Array.isArray(candidates) || candidates.length !== 1) throw new Error('PROVIDER_RESPONSE_INVALID');
    const candidate = record(candidates[0]);
    if (candidate.finishReason !== 'STOP') throw new Error('PROVIDER_RESPONSE_INVALID');
    const parts = record(candidate.content).parts;
    if (!Array.isArray(parts) || parts.length !== 1 || typeof record(parts[0]).text !== 'string') throw new Error('PROVIDER_RESPONSE_INVALID');
    let parsed: unknown;
    try { parsed = JSON.parse(record(parts[0]).text as string); } catch { throw new Error('SCHEMA_INVALID'); }
    const output = parseSoftJudgment(parsed);
    const usage = response.usageMetadata === undefined ? {} : record(response.usageMetadata);
    const inputTokens = maybeCount(usage.promptTokenCount);
    const candidatesTokens = maybeCount(usage.candidatesTokenCount);
    const thoughtTokens = maybeCount(usage.thoughtsTokenCount);
    const outputTokens = candidatesTokens === null ? null : candidatesTokens + (thoughtTokens ?? 0);
    return { output, inputTokens, outputTokens, costUsd: null };
  } catch (error) {
    if (error instanceof Error && ['MODEL_MISMATCH', 'SCHEMA_INVALID'].includes(error.message)) throw error;
    throw new Error('PROVIDER_RESPONSE_INVALID');
  }
}

/** Sequential, capped and transport-injected. No credentials, fetch, retry, file output or network side effect here. */
export async function runProviderEvaluation(options: ProviderRunOptions): Promise<RecordedRun[]> {
  if (options.pin.corpusVersion !== CORPUS_VERSION || options.pin.corpusSha256 !== corpusSha256()) throw new Error('RUN_CORPUS_MISMATCH');
  if (!Number.isSafeInteger(options.runs) || options.runs < 1 || options.runs > 3) throw new Error('RUN_COUNT_INVALID');
  const first = buildProviderRequest(options.provider, options.modelVersion, CORPUS[0]);
  const runs: RecordedRun[] = [];
  for (let runIndex = 0; runIndex < options.runs; runIndex++) {
    const attempts: RecordedAttempt[] = [];
    for (const c of CORPUS) {
      const request = buildProviderRequest(options.provider, options.modelVersion, c);
      const start = performance.now();
      try {
        const raw = await options.invoke(request);
        const decoded = decodeProviderResponse(options.provider, options.modelVersion, raw);
        attempts.push({ caseId: c.id, output: decoded.output, latencyMs: performance.now() - start,
          costUsd: decoded.costUsd, inputTokens: decoded.inputTokens, outputTokens: decoded.outputTokens,
          ...(decoded.probabilities ? { probabilities: decoded.probabilities } : {}) });
      } catch (error) {
        const code = error instanceof Error && ['SCHEMA_INVALID', 'PROVIDER_RESPONSE_INVALID'].includes(error.message) ? 'schema_invalid' :
          error instanceof Error && error.message === 'MODEL_MISMATCH' ? 'model_mismatch' : 'provider_error';
        attempts.push({ caseId: c.id, failure: code, latencyMs: performance.now() - start,
          costUsd: null, inputTokens: null, outputTokens: null });
      }
    }
    runs.push({ provider: options.provider, corpusVersion: options.pin.corpusVersion,
      corpusSha256: options.pin.corpusSha256, modelVersion: options.modelVersion,
      adapterSha256: first.adapterSha256, promptSha256: first.promptSha256, attempts });
  }
  return runs;
}
