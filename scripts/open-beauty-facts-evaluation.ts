/// <reference types="node" />
import { coverageSha256, evaluateCoverage, parseCoverageCorpus } from './catalog-coverage-benchmark.ts';
import { normalizeBarcode } from '../src/utils/barcode.ts';

const SOURCE_ID = 'open-beauty-facts';
const VERSION = 'obf-v3-eval-1';
const MIN_START_SPACING_MS = 6_000; // At most 10 reads/minute from this process, below OBF's 15/IP limit.
const TIMEOUT_MS = 2_500;
const MAX_RESPONSE_BYTES = 32_768;
const URL_BASE = 'https://world.openbeautyfacts.org';
const FIELDS = 'code,brands,product_name,quantity,categories,last_modified_t';
let evaluationActive = false;

interface PendingCandidate {
  identity: { brand: string; name: string; variant: string; packageSize: string; region: string };
  recordRef: string; retrievedAt: string; datasetVersion: string;
}
interface PendingEntry { caseId: string; outcome: 'candidate' | 'miss' | 'error' | 'timeout'; latencyMs: number;
  action: 'confirm_candidate' | 'capture_label' | 'search_name'; claim: 'candidate'; candidate?: PendingCandidate }
export interface PendingObfRun { sourceId: typeof SOURCE_ID; adapterVersion: typeof VERSION; corpusSha256: string; entries: PendingEntry[] }
interface Options { allowNetwork: true; evaluationPermissionRef: string; termsReviewRef: string; userAgent: string; maxUniqueReads: number }
interface Dependencies { fetcher?: typeof fetch; clock?: () => number; now?: () => Date; sleep?: (milliseconds: number) => Promise<void> }
interface HumanReview { caseId: string; identityMatch: 'exact' | 'possible' | 'wrong' | 'unknown'; reviewerRef: string; evidenceRef: string;
  customerConfirmation?: { confirmedExactPackageVariant: boolean; evidenceRef: string } }

const fail = (): never => { throw new Error('OBF_EVALUATION_NOT_AUTHORIZED'); };
const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const label = value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return label || null;
};
const ref = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
const userAgentValid = (value: unknown): value is string => typeof value === 'string' && value.length <= 180
  && /^DeriveCatalogEval\/\d+\.\d+ \((?:[^\s()@]+@[^\s()@]+\.[^\s()@]+|https:\/\/[^\s()]+)\)$/.test(value);
const waitDefault = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const equivalentGtin = (value: unknown, target: string): value is string => typeof value === 'string'
  && /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) && normalizeBarcode(value) === normalizeBarcode(target);

async function boundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw new Error('OVERSIZE');
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) throw new Error('NOT_JSON');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); throw new Error('OVERSIZE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function readOne(gtin: string, userAgent: string, deps: Dependencies): Promise<{ status: 'candidate' | 'miss' | 'error' | 'timeout'; candidate?: PendingCandidate; stop: boolean }> {
  const controller = new AbortController(); let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error('TIMEOUT')); }, TIMEOUT_MS);
  });
  try {
    const operation = (async () => {
      const response = await (deps.fetcher ?? fetch)(
        `${URL_BASE}/api/v3/product/${gtin}.json?fields=${FIELDS}`,
        { method: 'GET', headers: { 'User-Agent': userAgent, Accept: 'application/json' }, redirect: 'error', signal: controller.signal },
      );
      if (response.status === 404) return { status: 'miss' as const, stop: false };
      if (response.status === 429 || response.status === 503) return { status: 'error' as const, stop: true };
      if (!response.ok) return { status: 'error' as const, stop: false };
      const payload = await boundedJson(response);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 'error' as const, stop: false };
      const root = payload as Record<string, unknown>;
      if (root.result && typeof root.result === 'object' && (root.result as Record<string, unknown>).id === 'product_not_found')
        return { status: 'miss' as const, stop: false };
      if (root.status !== 'success' || !root.result || typeof root.result !== 'object'
        || (root.result as Record<string, unknown>).id !== 'product_found'
        || !root.product || typeof root.product !== 'object' || Array.isArray(root.product))
        return { status: 'error' as const, stop: false };
      const product = root.product as Record<string, unknown>;
      // iOS may observe UPC-A as leading-zero EAN-13. This is the same GS1 item,
      // not a different product; unrelated returned codes still fail closed.
      if (!equivalentGtin(root.code, gtin) || !equivalentGtin(product.code, gtin)) return { status: 'error' as const, stop: false };
      const name = clean(product.product_name);
      if (!name) return { status: 'miss' as const, stop: false };
      const modified = Number.isSafeInteger(product.last_modified_t) && (product.last_modified_t as number) >= 0
        ? `t${product.last_modified_t}` : 'unversioned-v3';
      return { status: 'candidate' as const, stop: false, candidate: {
        identity: { brand: clean(product.brands) ?? 'Unspecified', name, variant: '',
          packageSize: clean(product.quantity) ?? 'Unspecified', region: 'Unverified' },
        // An opaque reference preserves provenance without echoing a user's raw GTIN in output.
        recordRef: `obf:gtin-sha256:${coverageSha256(normalizeBarcode(product.code as string))}`,
        retrievedAt: (deps.now ?? (() => new Date()))().toISOString(), datasetVersion: modified,
      } };
    })();
    return await Promise.race([operation, timeout]);
  } catch {
    return { status: timedOut ? 'timeout' : 'error', stop: timedOut };
  } finally { if (timer) clearTimeout(timer); }
}

/** Explicitly authorized evaluator only. No import, catalog write, image or ingredient read. */
export async function runOpenBeautyFactsEvaluation(json: string, digest: string, options: Options, deps: Dependencies = {}): Promise<PendingObfRun> {
  if (options?.allowNetwork !== true || !userAgentValid(options.userAgent) || !ref(options.evaluationPermissionRef)
    || !ref(options.termsReviewRef) || !Number.isSafeInteger(options.maxUniqueReads)
    || options.maxUniqueReads < 1 || options.maxUniqueReads > 200) return fail();
  const corpus = parseCoverageCorpus(json, digest);
  const source = corpus.sources.find(row => row.id === SOURCE_ID && row.kind === 'external');
  if (!source || source.evaluationPermissionRef !== options.evaluationPermissionRef || source.termsReviewRef !== options.termsReviewRef
    || corpus.cases.some(row => !row.rights.providerEvaluationAllowed)) return fail();
  const uniqueGtins = [...new Set(corpus.cases.map(row => normalizeBarcode(row.gtin)))];
  if (uniqueGtins.length > options.maxUniqueReads) return fail(); // No silently partial launch benchmark.
  if (evaluationActive) return fail();
  evaluationActive = true;
  try {
    const clock = deps.clock ?? Date.now; const sleep = deps.sleep ?? waitDefault;
    const lookup = new Map<string, { result: Awaited<ReturnType<typeof readOne>>; latencyMs: number }>();
    let previousStart: number | null = null;
    for (const gtin of uniqueGtins) {
      if (previousStart !== null) await sleep(Math.max(0, MIN_START_SPACING_MS - (clock() - previousStart)));
      const start = clock(); previousStart = start;
      const result = await readOne(gtin, options.userAgent, deps);
      lookup.set(gtin, { result, latencyMs: Math.max(0, clock() - start) });
      if (result.stop) break; // 429, 503, or timeout: do not pressure the provider further.
    }
    const entries: PendingEntry[] = corpus.cases.flatMap(row => {
      const hit = lookup.get(normalizeBarcode(row.gtin)); if (!hit) return [];
      const { result, latencyMs } = hit;
      return [{ caseId: row.id, outcome: result.status, latencyMs, claim: 'candidate' as const,
        action: result.status === 'candidate' ? 'confirm_candidate' as const
          : result.status === 'miss' ? 'capture_label' as const : 'search_name' as const,
        ...(result.candidate ? { candidate: result.candidate } : {}) }];
    });
    // Candidate rows intentionally lack review: this file is NOT yet accepted by the scorer.
    return { sourceId: SOURCE_ID, adapterVersion: VERSION, corpusSha256: digest, entries };
  } finally { evaluationActive = false; }
}

/** Requires independent human package comparison; never invents review or confirmation. */
export function adjudicateOpenBeautyFactsRun(json: string, digest: string, pending: PendingObfRun, reviews: HumanReview[]) {
  const corpus = parseCoverageCorpus(json, digest);
  if (pending.sourceId !== SOURCE_ID || pending.corpusSha256 !== digest || !Array.isArray(reviews)) return fail();
  const candidates = pending.entries.filter(entry => entry.outcome === 'candidate');
  if (reviews.length !== candidates.length || new Set(reviews.map(row => row.caseId)).size !== reviews.length) return fail();
  const rows = pending.entries.map(entry => {
    if (entry.outcome !== 'candidate') return entry;
    const review = reviews.find(row => row.caseId === entry.caseId);
    if (!review || !ref(review.reviewerRef) || !ref(review.evidenceRef)
      || !['exact', 'possible', 'wrong', 'unknown'].includes(review.identityMatch)
      || (review.customerConfirmation && (review.identityMatch !== 'possible'
        || typeof review.customerConfirmation.confirmedExactPackageVariant !== 'boolean'
        || !ref(review.customerConfirmation.evidenceRef)))) return fail();
    return { ...entry, review: { identityMatch: review.identityMatch, reviewerRef: review.reviewerRef,
      evidenceRef: review.evidenceRef, ...(review.customerConfirmation ? { customerConfirmation: review.customerConfirmation } : {}) } };
  });
  const run = { ...pending, entries: rows };
  evaluateCoverage(json, digest, [run]); // Reuse scorer's strict shape and provenance validation.
  if (!corpus.sources.some(source => source.id === SOURCE_ID)) return fail();
  return run;
}

export const openBeautyFactsEvaluationReadiness = () => ({ status: 'NETWORK_DISABLED_UNTIL_EXPLICIT_RIGHTS_REVIEW',
  sourceId: SOURCE_ID, providerCalls: 0, measuredCoverage: null });
export const frozenCorpusSha256 = coverageSha256;
