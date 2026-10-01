import type { PrivateUpcCandidate, PrivateUpcLookup } from '../../contracts/PrivateUpcLookup.ts';

const emptyStatuses = new Set(['disabled', 'invalid_barcode', 'configuration_required', 'not_found', 'incomplete', 'rate_limited', 'unavailable']);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const nullableLabel = (value: unknown, max: number) => value === null || bounded(value, max);

export function validPrivateBarcode(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

function validCandidate(value: unknown, barcode: string): value is PrivateUpcCandidate {
  if (!object(value) || value.source !== 'upcitemdb' || value.rightsPolicy !== 'internal_evaluation_only'
    || value.canonicalProductId !== null || value.formulaVerified !== false
    || value.observedBarcode !== barcode || typeof value.sourceBarcode !== 'string'
    || !validPrivateBarcode(value.sourceBarcode) || value.sourceRecordId !== value.sourceBarcode
    || !bounded(value.name, 180) || !nullableLabel(value.brand, 100)
    || !nullableLabel(value.size, 80) || !nullableLabel(value.category, 120)
    || typeof value.retrievedAt !== 'string' || value.retrievedAt.length > 40 || !Number.isFinite(Date.parse(value.retrievedAt))) return false;
  if (!(value.sourceBarcode === barcode || barcode.length === 12 && value.sourceBarcode === '0' + barcode
    || barcode.length === 13 && barcode[0] === '0' && value.sourceBarcode === barcode.slice(1))) return false;
  return value.sourceUrl === 'https://api.upcitemdb.com/prod/trial/lookup?upc=' + barcode;
}

/** Reject mismatched identity/trust markers before any phone presentation. */
export function parsePrivateUpcLookup(value: unknown, barcode: string): PrivateUpcLookup {
  if (!validPrivateBarcode(barcode) || !object(value) || !Array.isArray(value.candidates) || typeof value.truncated !== 'boolean') {
    throw new Error('INVALID_UPC_RESPONSE');
  }
  if (typeof value.status === 'string' && emptyStatuses.has(value.status) && value.candidates.length === 0 && value.truncated === false) {
    return value as unknown as PrivateUpcLookup;
  }
  if ((value.status === 'found' && value.candidates.length === 1 && value.truncated === false
    || value.status === 'ambiguous' && value.candidates.length >= 1 && value.candidates.length <= 5)
    && value.candidates.every(candidate => validCandidate(candidate, barcode))) {
    // Project explicitly: unexpected upstream properties (photos/formula/etc.) never cross this boundary.
    const candidates = value.candidates.map(candidate => ({
      source: candidate.source, rightsPolicy: candidate.rightsPolicy, sourceRecordId: candidate.sourceRecordId,
      sourceUrl: candidate.sourceUrl, retrievedAt: candidate.retrievedAt, observedBarcode: candidate.observedBarcode,
      sourceBarcode: candidate.sourceBarcode, brand: candidate.brand, name: candidate.name, size: candidate.size,
      category: candidate.category, canonicalProductId: null, formulaVerified: false,
    }));
    return { status: value.status, candidates, truncated: value.truncated } as PrivateUpcLookup;
  }
  throw new Error('INVALID_UPC_RESPONSE');
}

export interface PrivateLookupClient {
  functions: { invoke(name: string, options: { body: object }): Promise<{ data: unknown; error: unknown }> };
}

export async function requestPrivateUpcLookup(barcode: string, ownerId: string, getOwner: () => string | null,
  client: PrivateLookupClient): Promise<PrivateUpcLookup> {
  if (!validPrivateBarcode(barcode)) throw new Error('INVALID_BARCODE');
  if (!ownerId || getOwner() !== ownerId) throw new Error('OWNER_CHANGED');
  const { data, error } = await client.functions.invoke('private-upc-lookup', { body: { barcode } });
  if (getOwner() !== ownerId) throw new Error('OWNER_CHANGED');
  if (error) {
    const status = object(error) && object(error.context) ? error.context.status : null;
    if (status === 429) return { status: 'rate_limited', candidates: [], truncated: false };
    throw new Error(status === 403 ? 'PRIVATE_TESTER_REQUIRED' : status === 401 ? 'SIGN_IN_REQUIRED' : 'UPC_UNAVAILABLE');
  }
  return parsePrivateUpcLookup(data, barcode);
}
