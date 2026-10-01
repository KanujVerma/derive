import { isValidGtin } from './product-identity.ts';
import type { PrivateUpcCandidate, PrivateUpcLookup } from '../../../src/contracts/PrivateUpcLookup.ts';

/** Private evaluation suggestions only; caller must reserve a durable budget. */
export type UpcItemDbCandidate = PrivateUpcCandidate;
export type UpcItemDbLookup = PrivateUpcLookup;

export interface UpcItemDbOptions {
  enabled?: boolean;
  plan: 'trial' | 'paid';
  /** Paid-plan key is server-side only. Never put it in EXPO_PUBLIC_*. */
  apiKey?: string;
  /** Must atomically reserve one request before the outbound call. */
  reserveRequest?: () => Promise<'reserved' | 'rate_limited'>;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

const ORIGIN = 'https://api.upcitemdb.com';
const MAX_RESPONSE_BYTES = 65_536;
const MAX_TIMEOUT_MS = 3_000;
const MAX_CANDIDATES = 5;
const empty = (status: Exclude<UpcItemDbLookup['status'], 'found' | 'ambiguous'>): UpcItemDbLookup =>
  ({ status, candidates: [], truncated: false });

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function label(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

/** A 14-digit pack GTIN is never inferred from its contained item's UPC. */
function equivalentBarcode(observed: string, source: unknown): source is string {
  if (typeof source !== 'string' || !isValidGtin(source)) return false;
  return source === observed
    || (observed.length === 12 && source === `0${observed}`)
    || (observed.length === 13 && observed.startsWith('0') && source === observed.slice(1));
}

async function boundedJson(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.body) return null;
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { return null; }
}

function toCandidate(item: Record<string, unknown>, barcode: string, retrievedAt: string, sourceUrl: string): UpcItemDbCandidate | null {
  // The API documents EAN-13 as the primary item ID and UPC as optional. An
  // unrelated returned identifier must never become a plausible-looking hit.
  const ean = item.ean;
  const sourceCode = barcode.length === 14 ? item.gtin : ean;
  if (!equivalentBarcode(barcode, sourceCode)) return null;
  // For GTIN-14, the provider may also return an inner item EAN/UPC. It is
  // never used to infer the pack identity; only an exact item.gtin qualifies.
  if (barcode.length !== 14 && item.upc !== undefined && !equivalentBarcode(ean as string, item.upc)) return null;
  const name = label(item.title);
  if (!name) return null;
  return {
    source: 'upcitemdb', rightsPolicy: 'internal_evaluation_only',
    sourceRecordId: sourceCode, sourceUrl,
    retrievedAt, observedBarcode: barcode, sourceBarcode: sourceCode,
    brand: label(item.brand, 100), name, size: label(item.size, 80), category: label(item.category, 120),
    canonicalProductId: null, formulaVerified: false,
  };
}

export async function lookupUpcItemDb(barcode: string, options: UpcItemDbOptions): Promise<UpcItemDbLookup> {
  if (!options.enabled) return empty('disabled');
  if (!isValidGtin(barcode)) return empty('invalid_barcode');
  if (!options.reserveRequest || (options.plan === 'paid' && !options.apiKey?.trim())) return empty('configuration_required');
  const url = new URL(options.plan === 'paid' ? '/prod/v1/lookup' : '/prod/trial/lookup', ORIGIN);
  url.searchParams.set('upc', barcode);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.plan === 'paid') {
    headers.user_key = options.apiKey!.trim();
    headers.key_type = '3scale';
  }
  // The reservation callback is responsible for a durable per-owner and
  // provider-wide budget; failure closes this adapter before network access.
  try {
    if (await options.reserveRequest() !== 'reserved') return empty('rate_limited');
  } catch { return empty('unavailable'); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(options.timeoutMs ?? MAX_TIMEOUT_MS, 1), MAX_TIMEOUT_MS));
  try {
    const response = await (options.fetcher ?? fetch)(url, { headers, redirect: 'error', signal: controller.signal });
    if (response.status === 404) return empty('not_found');
    if (response.status === 429) return empty('rate_limited');
    if (!response.ok) return empty('unavailable');
    const body = await boundedJson(response);
    if (!body || body.code !== 'OK' || !Array.isArray(body.items)
      || !Number.isSafeInteger(body.total) || (body.total as number) < 0) return empty('unavailable');
    const total = body.total as number;
    // A single surviving match is not a unique result when the raw envelope
    // contains extra, invalid or unrelated rows. Reject impossible counts;
    // preserve genuinely partial responses as ambiguous below.
    if (body.items.length > total || body.offset !== 0) return empty('unavailable');
    if (total === 0) return empty('not_found');
    const retrievedAt = (options.now ?? (() => new Date()))().toISOString();
    const matching = body.items.map(object).filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => toCandidate(item, barcode, retrievedAt, url.toString()))
      .filter((item): item is UpcItemDbCandidate => Boolean(item));
    if (!matching.length) return empty('incomplete');
    // A multiple-item response is not silently promoted to the first hit.
    if (total !== 1 || body.items.length !== 1 || matching.length !== 1) return {
      status: 'ambiguous', candidates: matching.slice(0, MAX_CANDIDATES),
      truncated: total > matching.length || matching.length > MAX_CANDIDATES,
    };
    return { status: 'found', candidates: [matching[0]], truncated: false };
  } catch { return empty('unavailable'); }
  finally { clearTimeout(timeout); }
}
