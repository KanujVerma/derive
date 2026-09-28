/// <reference types="node" />
import { createHash } from 'node:crypto';
import { parseProductEvidenceExtraction, projectProductEvidenceExtraction } from '../supabase/functions/_shared/product-evidence-extraction.ts';
import type { ProductEvidenceExtractionCandidate, ExtractionEvidenceRole } from '../src/contracts/ProductEvidenceExtraction.ts';

const roles = ['front_label', 'ingredients', 'packaging'] as const;
export const PERCEPTION_SCENARIOS = ['clear_front', 'ingredients', 'curved', 'reflective', 'tiny_barcode', 'blur', 'low_light', 'store_aisle', 'bathroom', 'old_new_packaging', 'similar_variants', 'kj_beauty', 'multilingual'] as const;
const metricFields = ['role', 'outcome', 'abstentionReason', 'brandText', 'productNameText', 'variantText', 'barcodeText', 'regionText', 'labelText', 'orderedIngredients', 'numbers'] as const;
type Metric = typeof metricFields[number];
type RightsUse = 'local_evaluation' | 'provider_evaluation';
interface BenchmarkCase {
  id: string; imageFile: string; imageSha256: string; scenarios: string[];
  rights: { sourceEvidenceRef: string; permissionEvidenceRef: string; allowedUses: RightsUse[] };
  goldEvidenceRef: string; gold: ProductEvidenceExtractionCandidate;
}
interface BenchmarkProvider {
  id: string; processing: 'local' | 'cloud'; privacyReviewRef?: string;
}
export interface PerceptionManifest { schemaVersion: 1; benchmarkId: string; cases: BenchmarkCase[]; providers: BenchmarkProvider[] }
interface ProviderRun { providerId: string; modelVersion: string; adapterSha256: string; promptSha256: string; entries: Array<{ caseId: string; imageSha256: string; output: unknown; latencyMs: number; costUsd: number }> }
const invalid = (): never => { throw new Error('INVALID_PERCEPTION_BENCHMARK_INPUT'); };
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const id = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && hashPattern.test(value);
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !keys.includes(key) || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return invalid();
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > max) return invalid();
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) return invalid();
  return value;
}
export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

/** Private JSON plus its independently recorded digest bind rights, images and gold together. */
export function parseFrozenPerceptionManifest(json: string, expectedSha256: string): PerceptionManifest {
  if (!hash(expectedSha256) || json.length > 2_000_000 || sha256(json) !== expectedSha256) return invalid();
  const root = object(JSON.parse(json), ['schemaVersion', 'benchmarkId', 'cases', 'providers']);
  if (root.schemaVersion !== 1 || !id(root.benchmarkId)) return invalid();
  const cases = array(root.cases, 1000).map(value => {
    const row = object(value, ['id', 'imageFile', 'imageSha256', 'scenarios', 'rights', 'goldEvidenceRef', 'gold']);
    if (!id(row.id) || typeof row.imageFile !== 'string' || !/^[a-zA-Z0-9_-]{1,100}\.(jpg|png|webp)$/.test(row.imageFile)
      || !hash(row.imageSha256) || !id(row.goldEvidenceRef)) return invalid();
    const scenarios = array(row.scenarios, PERCEPTION_SCENARIOS.length);
    if (new Set(scenarios).size !== scenarios.length || scenarios.some(scenario => !PERCEPTION_SCENARIOS.includes(scenario as typeof PERCEPTION_SCENARIOS[number]))) return invalid();
    const rights = object(row.rights, ['sourceEvidenceRef', 'permissionEvidenceRef', 'allowedUses']);
    if (!id(rights.sourceEvidenceRef) || !id(rights.permissionEvidenceRef)) return invalid();
    const uses = array(rights.allowedUses, 2);
    if (new Set(uses).size !== uses.length || !uses.includes('local_evaluation') || uses.some(use => !['local_evaluation', 'provider_evaluation'].includes(use as string))) return invalid();
    const goldObject = object(row.gold, ['schemaVersion', 'evidenceId', 'role', 'outcome', 'abstentionReason', 'barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText', 'labelText', 'orderedIngredients', 'numbers']);
    if (!roles.includes(goldObject.role as ExtractionEvidenceRole)) return invalid();
    const gold = parseProductEvidenceExtraction(row.gold, { evidenceId: row.id, role: goldObject.role as ExtractionEvidenceRole });
    return { id: row.id, imageFile: row.imageFile, imageSha256: row.imageSha256, scenarios: scenarios as string[], goldEvidenceRef: row.goldEvidenceRef,
      rights: { sourceEvidenceRef: rights.sourceEvidenceRef, permissionEvidenceRef: rights.permissionEvidenceRef, allowedUses: uses as RightsUse[] }, gold };
  });
  if (new Set(cases.map(row => row.id)).size !== cases.length || new Set(cases.map(row => row.imageFile)).size !== cases.length
    || new Set(cases.map(row => row.imageSha256)).size !== cases.length) return invalid();
  const providers = array(root.providers, 20).map(value => {
    const row = object(value, ['id', 'processing', 'privacyReviewRef']);
    if (!id(row.id) || !['local', 'cloud'].includes(row.processing as string) || (row.privacyReviewRef !== undefined && !id(row.privacyReviewRef))
      || (row.processing === 'cloud' && !id(row.privacyReviewRef))) return invalid();
    return { id: row.id, processing: row.processing as 'local' | 'cloud', privacyReviewRef: row.privacyReviewRef as string | undefined };
  });
  if (new Set(providers.map(row => row.id)).size !== providers.length) return invalid();
  return { schemaVersion: 1, benchmarkId: root.benchmarkId, cases, providers };
}
function parseRuns(value: unknown, manifest: PerceptionManifest): ProviderRun[] {
  if (!Array.isArray(value) || value.length > manifest.providers.length) return invalid();
  const runs = value.map(input => {
    const run = object(input, ['providerId', 'modelVersion', 'adapterSha256', 'promptSha256', 'entries']);
    if (!id(run.providerId) || typeof run.modelVersion !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(run.modelVersion)
      || !hash(run.adapterSha256) || !hash(run.promptSha256)) return invalid();
    const provider = manifest.providers.find(row => row.id === run.providerId);
    if (!provider) return invalid();
    const entries = array(run.entries, manifest.cases.length).map(inputEntry => {
      const entry = object(inputEntry, ['caseId', 'imageSha256', 'output', 'latencyMs', 'costUsd']);
      const fixture = manifest.cases.find(row => row.id === entry.caseId);
      if (!fixture || entry.imageSha256 !== fixture.imageSha256 || typeof entry.latencyMs !== 'number' || !Number.isFinite(entry.latencyMs) || entry.latencyMs < 0
        || typeof entry.costUsd !== 'number' || !Number.isFinite(entry.costUsd) || entry.costUsd < 0
        || (provider.processing === 'cloud' && !fixture.rights.allowedUses.includes('provider_evaluation'))) return invalid();
      return { caseId: fixture.id, imageSha256: fixture.imageSha256, output: entry.output, latencyMs: entry.latencyMs, costUsd: entry.costUsd };
    });
    if (new Set(entries.map(row => row.caseId)).size !== entries.length) return invalid();
    return { providerId: run.providerId, modelVersion: run.modelVersion, adapterSha256: run.adapterSha256, promptSha256: run.promptSha256, entries };
  });
  if (new Set(runs.map(row => row.providerId)).size !== runs.length) return invalid();
  return runs;
}
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Offline replay only. Digests must come from image bytes, never a provider's claimed hash. */
export function evaluatePerceptionBenchmark(manifestJson: string, manifestSha256: string, imageDigests: ReadonlyMap<string, string>, outputs: unknown = []) {
  const manifest = parseFrozenPerceptionManifest(manifestJson, manifestSha256);
  for (const row of manifest.cases) if (imageDigests.get(row.imageFile) !== row.imageSha256) return invalid();
  const runs = parseRuns(outputs, manifest);
  const providers = manifest.providers.map(provider => {
    const run = runs.find(row => row.providerId === provider.id);
    const metrics = Object.fromEntries(metricFields.map(field => [field, { eligible: 0, correct: 0, rate: null as number | null }])) as Record<Metric, { eligible: number; correct: number; rate: number | null }>;
    let unsupportedCandidateCount = 0; let abstained = 0;
    const rows = manifest.cases.map(fixture => {
      const entry = run?.entries.find(row => row.caseId === fixture.id);
      if (!entry) return { id: fixture.id, status: 'NOT_RUN' as const, errors: [] as string[] };
      let candidate: ProductEvidenceExtractionCandidate | undefined;
      try {
        candidate = parseProductEvidenceExtraction(entry.output, { evidenceId: fixture.id, role: fixture.gold.role });
        // Reuse the canonical candidate-only projection; no authority fields enter this tool.
        projectProductEvidenceExtraction(candidate, { evidenceId: fixture.id, role: fixture.gold.role });
      } catch { /* Invalid provider shape remains a failed executed row, not NOT_RUN. */ }
      if (candidate?.outcome === 'abstained') abstained++;
      if (candidate?.outcome === 'candidate' && fixture.gold.outcome === 'abstained') unsupportedCandidateCount++;
      const errors: string[] = [];
      for (const field of metricFields) {
        if (fixture.gold[field] !== undefined) {
          metrics[field].eligible++;
          if (candidate && equal(candidate[field], fixture.gold[field])) metrics[field].correct++;
        }
        if (!candidate || !equal(candidate[field], fixture.gold[field])) errors.push(field);
      }
      return { id: fixture.id, status: errors.length ? 'FAIL' as const : 'PASS' as const, errors: candidate ? errors : ['INVALID_EXTRACTION_OUTPUT'] };
    });
    const executed = rows.filter(row => row.status !== 'NOT_RUN').length;
    const passed = rows.filter(row => row.status === 'PASS').length;
    for (const metric of Object.values(metrics)) metric.rate = metric.eligible ? metric.correct / metric.eligible : null;
    // Corpus coverage alone is not provider coverage. A partial run must visibly
    // leave difficult scenes NOT_RUN instead of looking like equivalent evidence.
    const scenarios = PERCEPTION_SCENARIOS.map(scenario => {
      const indices = manifest.cases.flatMap((fixture, index) => fixture.scenarios.includes(scenario) ? [index] : []);
      const scenarioRows = indices.map(index => rows[index]);
      const scenarioExecuted = scenarioRows.filter(row => row.status !== 'NOT_RUN').length;
      const scenarioPassed = scenarioRows.filter(row => row.status === 'PASS').length;
      return { scenario, images: indices.length, executed: scenarioExecuted, passed: scenarioPassed,
        failed: scenarioExecuted - scenarioPassed, notRun: indices.length - scenarioExecuted,
        coverageRate: indices.length ? scenarioExecuted / indices.length : null,
        exactCandidateRate: scenarioExecuted ? scenarioPassed / scenarioExecuted : null };
    });
    return { id: provider.id, status: executed ? 'EXECUTED' : 'NOT_RUN', executed, passed, failed: executed - passed,
      notRun: rows.length - executed, exactCandidateRate: executed ? passed / executed : null, metrics,
      unsupportedCandidateCount: executed ? unsupportedCandidateCount : null, abstentionRate: executed ? abstained / executed : null,
      meanLatencyMs: executed ? run!.entries.reduce((sum, row) => sum + row.latencyMs, 0) / executed : null,
      totalCostUsd: executed ? run!.entries.reduce((sum, row) => sum + row.costUsd, 0) : null,
      runIdentity: run ? { modelVersion: run.modelVersion, adapterSha256: run.adapterSha256, promptSha256: run.promptSha256 } : null, scenarios, rows };
  });
  return { schemaVersion: 1, scope: 'offline_real_image_replay', benchmarkId: manifest.benchmarkId, manifestSha256,
    imageCount: manifest.cases.length, providerWinner: 'NONE_SELECTED',
    scenarios: PERCEPTION_SCENARIOS.map(scenario => ({ scenario, images: manifest.cases.filter(row => row.scenarios.includes(scenario)).length })), providers };
}

export function unpreparedPerceptionReport() {
  return { schemaVersion: 1, scope: 'offline_real_image_replay', status: 'CORPUS_NOT_READY', imageCount: 0, providerWinner: 'NONE_SELECTED',
    realImageAccuracy: null, latencyMs: null, costUsd: null,
    scenarios: PERCEPTION_SCENARIOS.map(scenario => ({ scenario, status: 'NOT_RUN' })) };
}
