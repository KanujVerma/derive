import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import type { PersonalContextSnapshot } from '../../src/contracts/PersonalContext.ts';
import { buildPersonalIngredientInsights } from '../../src/presentation/external-products/personalIngredientInsights.ts';
import { explainIngredientContext } from '../../supabase/functions/_shared/ingredient-explanation-model.ts';
import { CASES, CORPUS_VERSION, corpusSha256, projectCase, type GuidanceCase } from './corpus.ts';

function syntheticSnapshot(c: GuidanceCase): PersonalContextSnapshot {
  return { version: 'personal-context-v1', ownerId: 'synthetic-benchmark-only', revision: 1,
    profile: { id: 'synthetic', ownerId: 'synthetic-benchmark-only', revision: 1,
      recordedAt: '2026-09-30T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null,
      data: { intent: 'unanswered', primaryGoal: c.input.context.goals[0] ?? null, secondaryGoals: c.input.context.goals.slice(1),
        skinBehavior: c.input.context.skinBehavior, reactivity: c.input.context.reactivity,
        reproductive: { pregnancy: 'unanswered', nursing: 'unanswered', tryingToConceive: 'unanswered' },
        treatments: { status: 'unanswered', values: [] }, sensitivities: { status: 'unanswered', values: [] } } },
    routine: null, experiences: [], historyTruncated: false, historyRevision: null,
    legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
}
export function runLocalBaseline() {
  return CASES.map(c => {
    const start = performance.now();
    const result = buildPersonalIngredientInsights(syntheticSnapshot(c), [{ ingredientsText: c.input.ingredientsText }], 'user_label', c.input.category);
    return { caseId: c.id, provider: 'local_rules', model: 'current-local-rule-implementation', status: result.status,
      sentences: result.sentences, ingredientNames: result.ingredientNames,
      latencyMs: performance.now() - start, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  });
}
export async function runSyntheticGemini(apiKey: string, model = 'gemini-3.8-flash', transport: typeof fetch = fetch) {
  const attempts = [];
  let consecutiveUnavailable = 0;
  for (const c of CASES) {
    let http: number | null = null;
    let inputTokens: number | null = null, outputTokens: number | null = null;
    const observedFetch: typeof fetch = async (url, init) => {
      const response = await transport(url, init); http = response.status;
      if (response.ok) {
        // Observe usage without an unbounded clone/JSON allocation before the
        // production adapter's own response guard. Read once, then replay bytes.
        if (!response.body) return response;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = []; let bytes = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            bytes += value.byteLength;
            if (bytes > 65_536) throw Error('bounded benchmark response');
            chunks.push(value);
          }
        } finally { await reader.cancel().catch(() => undefined); }
        const payload = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
        let copy: { usageMetadata?: {
          promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } } | null;
        try { copy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)); }
        catch { copy = null; }
        const usage = copy?.usageMetadata;
        if (Number.isSafeInteger(usage?.promptTokenCount) && usage!.promptTokenCount! >= 0) inputTokens = usage!.promptTokenCount!;
        const output = usage?.candidatesTokenCount, thoughts = usage?.thoughtsTokenCount ?? 0;
        if (Number.isSafeInteger(output) && output! >= 0 && Number.isSafeInteger(thoughts) && thoughts >= 0
          && Number.isSafeInteger(output! + thoughts)) outputTokens = output! + thoughts;
        return new Response(payload, { status: response.status, headers: response.headers });
      }
      return response;
    };
    const started = performance.now();
    const result = await explainIngredientContext(projectCase(c), { apiKey, model, fetch: observedFetch });
    attempts.push({ caseId: c.id, provider: 'gemini', model, status: result.status, http,
      sentences: result.status === 'answer' ? result.sentences : [], latencyMs: performance.now() - started,
      inputTokens, outputTokens, costUsd: null });
    // No retries. Stop repeated operational failures rather than spending the run on a dead quota.
    consecutiveUnavailable = ['unavailable', 'rate_limited', 'configuration_required'].includes(result.status)
      ? consecutiveUnavailable + 1 : 0;
    if (consecutiveUnavailable >= 2) break;
  }
  return attempts;
}
export function summarizeAttempts(rows: Array<{ status: string; latencyMs: number; sentences: string[] }>) {
  const sorted = rows.map(row => row.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number) => sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
  const isAbstention = (status: string) => ['profile_missing', 'ingredients_missing'].includes(status);
  return { attempted: rows.length, usableAnswers: rows.filter(row => ['ready', 'answer'].includes(row.status)).length,
    abstentions: rows.filter(row => isAbstention(row.status)).length,
    failures: rows.filter(row => !['ready', 'answer'].includes(row.status) && !isAbstention(row.status)).length,
    p50Ms: percentile(.5), p95Ms: percentile(.95), stabilityMeasured: false,
    usefulnessMeasured: false, warning: 'Usable answers count emitted guidance, not useful findings. Latency includes abstentions and failures. This is synthetic regression evidence, not clinical correctness or a user preference result.' };
}
async function main() {
  const live = process.argv.includes('--gemini-synthetic');
  if (process.argv.slice(2).some(arg => arg !== '--gemini-synthetic')) throw Error('Use no arguments for local rules, or --gemini-synthetic for the capped synthetic-only model run.');
  if (live && !process.env.GEMINI_API_KEY) throw Error('GEMINI_API_KEY must be supplied privately in the process environment.');
  const rows = live ? await runSyntheticGemini(process.env.GEMINI_API_KEY!) : runLocalBaseline();
  console.log(JSON.stringify({ version: CORPUS_VERSION, corpusSha256: corpusSha256(), intendedCases: CASES.length,
    source: 'synthetic-only enumerated skin context and invented cosmetic lists; no real products, photos or customer data',
    summary: summarizeAttempts(rows), attempts: rows }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
