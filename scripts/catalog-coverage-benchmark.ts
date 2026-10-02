/// <reference types="node" />
import { createHash } from 'node:crypto';

// Offline, source-neutral replay. This module never calls a provider or writes to the catalog.
const categories = [
  'facial_cleanser', 'facial_moisturizer', 'sunscreen', 'facial_serum', 'facial_treatment',
  'deodorant', 'antiperspirant', 'shampoo', 'conditioner', 'body_wash', 'body_moisturizer', 'other',
] as const;
const channels = ['drugstore', 'mass_retail', 'beauty_retail', 'warehouse_club', 'direct_brand', 'other'] as const;
const outcomes = ['candidate', 'miss', 'error', 'timeout', 'no_barcode'] as const;
const matches = ['exact', 'possible', 'wrong', 'unknown'] as const;
const actions = ['confirm_candidate', 'show_verified_product', 'show_verified_formula', 'capture_label', 'search_name', 'report_missing'] as const;
const claims = ['candidate', 'canonical_product', 'canonical_formula'] as const;
type Category = typeof categories[number];
type Channel = typeof channels[number];
type Outcome = typeof outcomes[number];
type Match = typeof matches[number];
type Action = typeof actions[number];
type Claim = typeof claims[number];
type SourceKind = 'external' | 'canonical';
interface Identity { brand: string; name: string; variant: string; packageSize: string; region: string }
interface CorpusCase {
  id: string; gtin: string | null; category: Category; channel: Channel;
  scan: { decoded: boolean; deviceEvidenceRef: string };
  reference: { identity: Identity; evidenceRef: string; canonicalProductId?: string; formulaSnapshotId?: string };
  rights: { collectionEvidenceRef: string; permissionEvidenceRef: string; providerEvaluationAllowed: boolean };
}
interface Source { id: string; kind: SourceKind; evaluationPermissionRef: string; termsReviewRef: string }
export interface CoverageCorpus { schemaVersion: 1; cohort: string; cases: CorpusCase[]; sources: Source[] }
interface Candidate { identity: Identity; recordRef: string; retrievedAt: string; datasetVersion: string; canonicalProductId?: string; formulaSnapshotId?: string }
interface Review { identityMatch: Match; reviewerRef: string; evidenceRef: string;
  customerConfirmation?: { confirmedExactPackageVariant: boolean; evidenceRef: string };
  customerUsefulness?: { usefulSkincareResult: boolean; evidenceRef: string } }
interface Entry { caseId: string; outcome: Outcome; latencyMs: number; action: Action; claim: Claim; candidate?: Candidate; review?: Review }
interface Run { sourceId: string; adapterVersion: string; corpusSha256: string; entries: Entry[] }

const bad = (): never => { throw new Error('INVALID_CATALOG_COVERAGE_INPUT'); };
const opaque = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const label = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && !/[\x00-\x1f]/.test(v);
const iso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v);
const member = <T extends readonly string[]>(v: unknown, list: T): v is T[number] => typeof v === 'string' && list.includes(v);
function validGtin(v: unknown): v is string {
  if (typeof v !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)) return false;
  const digits = [...v].map(Number);
  const checksum = digits.slice(0, -1).reverse().reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - checksum % 10) % 10 === digits.at(-1);
}
function obj(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return bad();
  for (const key of Reflect.ownKeys(v)) {
    const desc = Object.getOwnPropertyDescriptor(v, key);
    if (typeof key !== 'string' || !keys.includes(key) || !desc?.enumerable || !Object.hasOwn(desc, 'value')) return bad();
  }
  return v as Record<string, unknown>;
}
function rows(v: unknown, max: number, allowEmpty = false): unknown[] {
  if (!Array.isArray(v) || v.length > max || (!allowEmpty && !v.length)) return bad();
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) return bad();
  return v;
}
function identity(v: unknown): Identity {
  const r = obj(v, ['brand', 'name', 'variant', 'packageSize', 'region']);
  if (![r.brand, r.name, r.packageSize, r.region].every(label) || typeof r.variant !== 'string' || r.variant.length > 160) return bad();
  return r as unknown as Identity;
}
export const coverageSha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export function parseCoverageCorpus(json: string, expectedSha256: string): CoverageCorpus {
  if (json.length > 3_000_000 || !sha(expectedSha256) || coverageSha256(json) !== expectedSha256) return bad();
  const root = obj(JSON.parse(json), ['schemaVersion', 'cohort', 'cases', 'sources']);
  if (root.schemaVersion !== 1 || !opaque(root.cohort)) return bad();
  const cases = rows(root.cases, 5000).map(v => {
    const r = obj(v, ['id', 'gtin', 'category', 'channel', 'scan', 'reference', 'rights']);
    if (!opaque(r.id) || (r.gtin !== null && !validGtin(r.gtin))
      || !member(r.category, categories) || !member(r.channel, channels)) return bad();
    const scan = obj(r.scan, ['decoded', 'deviceEvidenceRef']);
    const reference = obj(r.reference, ['identity', 'evidenceRef', 'canonicalProductId', 'formulaSnapshotId']);
    const rights = obj(r.rights, ['collectionEvidenceRef', 'permissionEvidenceRef', 'providerEvaluationAllowed']);
    if (typeof scan.decoded !== 'boolean' || (r.gtin === null && scan.decoded) || !opaque(scan.deviceEvidenceRef) || !opaque(reference.evidenceRef)
      || (reference.canonicalProductId !== undefined && !opaque(reference.canonicalProductId))
      || (reference.formulaSnapshotId !== undefined && (!opaque(reference.formulaSnapshotId) || !reference.canonicalProductId))
      || !opaque(rights.collectionEvidenceRef) || !opaque(rights.permissionEvidenceRef)
      || typeof rights.providerEvaluationAllowed !== 'boolean') return bad();
    identity(reference.identity);
    return r as unknown as CorpusCase;
  });
  // One case is one target-cohort scan encounter; a popular GTIN may occur more than once.
  if (new Set(cases.map(r => r.id)).size !== cases.length) return bad();
  const sources = rows(root.sources, 20).map(v => {
    const r = obj(v, ['id', 'kind', 'evaluationPermissionRef', 'termsReviewRef']);
    if (!opaque(r.id) || !member(r.kind, ['external', 'canonical'] as const) || !opaque(r.evaluationPermissionRef) || !opaque(r.termsReviewRef)) return bad();
    return r as unknown as Source;
  });
  if (new Set(sources.map(r => r.id)).size !== sources.length) return bad();
  return { schemaVersion: 1, cohort: root.cohort, cases, sources };
}
function parseRuns(v: unknown, corpus: CoverageCorpus, corpusSha256: string): Run[] {
  const parsed = rows(v, corpus.sources.length, true).map(raw => {
    const run = obj(raw, ['sourceId', 'adapterVersion', 'corpusSha256', 'entries']);
    if (!opaque(run.sourceId) || !opaque(run.adapterVersion) || run.corpusSha256 !== corpusSha256) return bad();
    const source = corpus.sources.find(s => s.id === run.sourceId);
    if (!source) return bad();
    const entries = rows(run.entries, corpus.cases.length, true).map(rawEntry => {
      const entry = obj(rawEntry, ['caseId', 'outcome', 'latencyMs', 'action', 'claim', 'candidate', 'review']);
      const fixture = corpus.cases.find(c => c.id === entry.caseId);
      if (!fixture || !member(entry.outcome, outcomes) || !member(entry.action, actions) || !member(entry.claim, claims)
        || typeof entry.latencyMs !== 'number' || !Number.isFinite(entry.latencyMs) || entry.latencyMs < 0
        || (source.kind === 'external' && fixture.gtin !== null && !fixture.rights.providerEvaluationAllowed)
        || (fixture.gtin === null) !== (entry.outcome === 'no_barcode')
        || (entry.outcome === 'no_barcode' && entry.latencyMs !== 0)) return bad();
      if (entry.outcome === 'candidate') {
        const candidate = obj(entry.candidate, ['identity', 'recordRef', 'retrievedAt', 'datasetVersion', 'canonicalProductId', 'formulaSnapshotId']);
        identity(candidate.identity);
        if (!opaque(candidate.recordRef) || !opaque(candidate.datasetVersion) || !iso(candidate.retrievedAt)
          || (candidate.canonicalProductId !== undefined && !opaque(candidate.canonicalProductId))
          || (candidate.formulaSnapshotId !== undefined && !opaque(candidate.formulaSnapshotId))) return bad();
        const review = obj(entry.review, ['identityMatch', 'reviewerRef', 'evidenceRef', 'customerConfirmation', 'customerUsefulness']);
        if (!member(review.identityMatch, matches) || !opaque(review.reviewerRef) || !opaque(review.evidenceRef)) return bad();
        if (review.customerConfirmation !== undefined) {
          const confirmation = obj(review.customerConfirmation, ['confirmedExactPackageVariant', 'evidenceRef']);
          if (review.identityMatch !== 'possible' || typeof confirmation.confirmedExactPackageVariant !== 'boolean'
            || !opaque(confirmation.evidenceRef)) return bad();
        }
        if (review.customerUsefulness !== undefined) {
          const observation = obj(review.customerUsefulness, ['usefulSkincareResult', 'evidenceRef']);
          if (typeof observation.usefulSkincareResult !== 'boolean' || !opaque(observation.evidenceRef)) return bad();
        }
      } else if (entry.candidate !== undefined || entry.review !== undefined) return bad();
      return entry as unknown as Entry;
    });
    if (new Set(entries.map(e => e.caseId)).size !== entries.length) return bad();
    return { sourceId: run.sourceId, adapterVersion: run.adapterVersion, corpusSha256, entries } as Run;
  });
  if (new Set(parsed.map(r => r.sourceId)).size !== parsed.length) return bad();
  return parsed;
}
function quantile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}
const rate = (n: number, d: number): number | null => d ? n / d : null;
/** Denominators are always the frozen cohort, including missing/failed scans and unrun provider rows. */
export function evaluateCoverage(json: string, expectedSha256: string, rawRuns: unknown = []) {
  const corpus = parseCoverageCorpus(json, expectedSha256);
  const runs = parseRuns(rawRuns, corpus, expectedSha256);
  const total = corpus.cases.length;
  const decoded = corpus.cases.filter(c => c.scan.decoded).length;
  const sources = corpus.sources.map(source => {
    const run = runs.find(r => r.sourceId === source.id);
    const counts = { executed: 0, notRun: 0, candidate: 0, possibleCandidate: 0, confirmedPossibleCandidate: 0, exactCandidate: 0,
      verifiedExactProduct: 0, verifiedFormula: 0, identityRecovery: 0, usefulnessObserved: 0, usefulnessUnmeasured: total,
      userReportedUseful: 0, usefulHit: 0, honestNextAction: 0,
      falseCertainty: 0, wrongCandidate: 0, miss: 0, error: 0, timeout: 0, noBarcode: 0 };
    const latencies: number[] = [];
    const byCategory = Object.fromEntries(categories.map(category => [category, { total: 0, usefulHit: 0, identityRecovery: 0, candidate: 0 }])) as Record<Category, { total: number; usefulHit: number; identityRecovery: number; candidate: number }>;
    const byChannel = Object.fromEntries(channels.map(channel => [channel, { total: 0, usefulHit: 0, identityRecovery: 0, candidate: 0 }])) as Record<Channel, { total: number; usefulHit: number; identityRecovery: number; candidate: number }>;
    for (const fixture of corpus.cases) {
      const category = byCategory[fixture.category]; const channel = byChannel[fixture.channel];
      category.total++; channel.total++;
      const entry = run?.entries.find(e => e.caseId === fixture.id);
      if (!entry) { counts.notRun++; continue; }
      counts.executed++;
      if (entry.outcome !== 'no_barcode') latencies.push(entry.latencyMs);
      if (entry.outcome !== 'candidate') {
        if (entry.outcome === 'no_barcode') counts.noBarcode++;
        else counts[entry.outcome]++;
        if (entry.claim !== 'candidate' || !['capture_label', 'search_name', 'report_missing'].includes(entry.action)) counts.falseCertainty++;
        else counts.honestNextAction++;
        continue;
      }
      counts.candidate++; category.candidate++; channel.candidate++;
      const usefulness = entry.review!.customerUsefulness;
      if (usefulness) {
        counts.usefulnessObserved++; counts.usefulnessUnmeasured--;
        if (usefulness.usefulSkincareResult) counts.userReportedUseful++;
      }
      const match = entry.review!.identityMatch;
      if (match === 'exact') counts.exactCandidate++;
      if (match === 'possible') counts.possibleCandidate++;
      const confirmedPossible = match === 'possible' && entry.review!.customerConfirmation?.confirmedExactPackageVariant === true;
      if (confirmedPossible) counts.confirmedPossibleCandidate++;
      if (match === 'wrong') counts.wrongCandidate++;
      const productVerified = source.kind === 'canonical' && match === 'exact'
        && !!fixture.reference.canonicalProductId && entry.candidate!.canonicalProductId === fixture.reference.canonicalProductId;
      const formulaVerified = productVerified && !!fixture.reference.formulaSnapshotId
        && entry.candidate!.formulaSnapshotId === fixture.reference.formulaSnapshotId;
      if (productVerified) counts.verifiedExactProduct++;
      if (formulaVerified) counts.verifiedFormula++;
      const warranted = entry.claim === 'candidate' && entry.action === 'confirm_candidate'
        || entry.claim === 'canonical_product' && productVerified && entry.action === 'show_verified_product'
        || entry.claim === 'canonical_formula' && formulaVerified && entry.action === 'show_verified_formula';
      if (match === 'wrong' || match === 'unknown' || !warranted) counts.falseCertainty++;
      else counts.honestNextAction++;
      if (fixture.scan.decoded && (match === 'exact' || confirmedPossible) && warranted) {
        counts.identityRecovery++; category.identityRecovery++; channel.identityRecovery++;
        // A qualified identity hit alone is not evidence the user got useful skincare output.
        if (usefulness?.usefulSkincareResult === true) {
          counts.usefulHit++; category.usefulHit++; channel.usefulHit++;
        }
      }
    }
    const complete = counts.notRun === 0;
    return { id: source.id, kind: source.kind, adapterVersion: run?.adapterVersion ?? null,
      status: !run || counts.executed === 0 ? 'NOT_RUN' : complete ? 'COMPLETE' : 'PARTIAL',
      denominator: total, counts, rates: { decode: rate(decoded, total), candidate: complete ? rate(counts.candidate, total) : null,
        usefulScanHit: complete ? rate(counts.usefulHit, total) : null,
        usefulScanHitLowerBound: rate(counts.usefulHit, total),
        identityRecovery: complete ? rate(counts.identityRecovery, total) : null,
        identityRecoveryLowerBound: rate(counts.identityRecovery, total),
        userReportedUsefulness: rate(counts.userReportedUseful, counts.usefulnessObserved),
        verifiedExactProduct: complete ? rate(counts.verifiedExactProduct, total) : null,
        verifiedFormula: complete ? rate(counts.verifiedFormula, total) : null,
        honestNextAction: complete ? rate(counts.honestNextAction, total) : null,
        falseCertainty: rate(counts.falseCertainty, counts.executed) },
      latencyMs: { median: quantile(latencies, .5), p95: quantile(latencies, .95) },
      byCategory, byChannel };
  });
  return { schemaVersion: 1, corpusId: corpus.cohort, corpusSha256: expectedSha256, corpusCount: total,
    decodedCount: decoded, launchMetric: 'target_cohort_useful_scan_hit_rate',
    sourceWinner: 'NONE_SELECTED', sources };
}
export function unpreparedCoverageReport() {
  return { schemaVersion: 1, status: 'RIGHTS_CLEARED_US_PERSONAL_CARE_CORPUS_REQUIRED', corpusCount: 0,
    usefulScanHitRate: null, sourceWinner: 'NONE_SELECTED' };
}
