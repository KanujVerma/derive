import { isValidGtin } from './product-identity.ts';

const OBF_ORIGIN = 'https://world.openbeautyfacts.org';
const MAX_RESPONSE_BYTES = 32_768;
const LOOKUP_TIMEOUT_MS = 2_500;
const MAX_LABEL_LENGTH = 180;

/** Evaluation-only identity evidence. It is never a Derive catalog or formula record. */
export interface OpenBeautyFactsCandidate {
  source: 'open_beauty_facts';
  sourceLicense: 'ODbL-1.0';
  sourceUrl: string;
  retrievedAt: string;
  sourceModifiedAt: string | null;
  /** Digits seen by Derive's scanner. UPC-A and zero-prefixed EAN-13 are equivalent. */
  barcode: string;
  /** Identifier actually returned by OBF, retained for source provenance. */
  sourceBarcode: string;
  brand: string | null;
  name: string;
  quantity: string | null;
  category: string | null;
  canonicalProductId: null;
  formulaVerified: false;
}

export type OpenBeautyFactsLookup =
  | { status: 'found'; candidate: OpenBeautyFactsCandidate }
  | { status: 'not_found' | 'incomplete' | 'unavailable' | 'rate_limited'; candidate: null };

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, MAX_LABEL_LENGTH) : null;
}

function modifiedAt(value: unknown): string | null {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 4_102_444_800) return null;
  return new Date((value as number) * 1_000).toISOString();
}

function sameRetailBarcode(observed: string, returned: unknown): returned is string {
  if (typeof returned !== 'string' || !isValidGtin(returned)) return false;
  if (returned === observed) return true;
  return (observed.length === 12 && returned === `0${observed}`)
    || (observed.length === 13 && observed.startsWith('0') && returned === observed.slice(1));
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return null;
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
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return null; }
}

export async function lookupOpenBeautyFacts(
  barcode: string,
  options: { fetcher?: typeof fetch; now?: () => Date; userAgent: string },
): Promise<OpenBeautyFactsLookup> {
  if (!isValidGtin(barcode)) throw new Error('INVALID_BARCODE');
  if (!options.userAgent.trim()) throw new Error('MISSING_USER_AGENT');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const fields = 'code,brands,product_name,quantity,categories,last_modified_t';
    const response = await (options.fetcher ?? fetch)(
      `${OBF_ORIGIN}/api/v3/product/${barcode}.json?fields=${fields}`,
      { headers: { 'User-Agent': options.userAgent, Accept: 'application/json' }, redirect: 'error', signal: controller.signal },
    );
    if (response.status === 404) return { status: 'not_found', candidate: null };
    if (response.status === 429) return { status: 'rate_limited', candidate: null };
    if (!response.ok) return { status: 'unavailable', candidate: null };
    const payload = await readBoundedJson(response);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 'unavailable', candidate: null };
    const body = payload as Record<string, unknown>;
    if (body.result && typeof body.result === 'object' && !Array.isArray(body.result)
      && (body.result as Record<string, unknown>).id === 'product_not_found') {
      return { status: 'not_found', candidate: null };
    }
    if (body.status !== 'success' || !body.result || typeof body.result !== 'object'
      || (body.result as Record<string, unknown>).id !== 'product_found'
      || !body.product || typeof body.product !== 'object' || Array.isArray(body.product)) {
      return { status: 'unavailable', candidate: null };
    }
    const product = body.product as Record<string, unknown>;
    // Only the mathematically equivalent UPC-A / zero-prefixed EAN-13 form is
    // accepted. Preserve the provider's actual identifier rather than erasing it.
    if (!sameRetailBarcode(barcode, body.code) || !sameRetailBarcode(barcode, product.code)) {
      return { status: 'unavailable', candidate: null };
    }
    const name = cleanLabel(product.product_name);
    if (!name) return { status: 'incomplete', candidate: null };
    return {
      status: 'found',
      candidate: {
        source: 'open_beauty_facts', sourceLicense: 'ODbL-1.0',
        sourceUrl: `${OBF_ORIGIN}/product/${product.code}`,
        retrievedAt: (options.now ?? (() => new Date()))().toISOString(),
        sourceModifiedAt: modifiedAt(product.last_modified_t),
        barcode, sourceBarcode: product.code, brand: cleanLabel(product.brands), name,
        quantity: cleanLabel(product.quantity), category: cleanLabel(product.categories),
        canonicalProductId: null, formulaVerified: false,
      },
    };
  } catch {
    return { status: 'unavailable', candidate: null };
  } finally {
    clearTimeout(timeout);
  }
}
