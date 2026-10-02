import type { Code } from '../../contracts/PartOne.ts';

export const BARCODE_NORMALIZATION_VERSION = 'part-one-gtin-1';
export type BarcodeNormalization = {
  supported: boolean; reason: 'invalid_code' | 'unsupported_namespace' | null;
  raw: string; symbology: string | null; namespace: 'gtin' | 'retailer' | 'unknown';
  retailerId: string | null; canonicalCode: string | null; canonicalGtin14: string | null;
  nativeCode: string | null; normalizationVersion: string;
};
export function hasValidGtinCheckDigit(value: string): boolean {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(value[i]) * weight;
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}
/** UPC-E number-system 0/1 compression; final digit is the original UPC-A check digit. */
export function expandUpce(raw: string): string | null {
  if (!/^[01]\d{7}$/.test(raw)) return null;
  const [ns, a, b, c, d, e, f, check] = raw;
  let body: string;
  if ('012'.includes(f)) body = `${ns}${a}${b}${f}0000${c}${d}${e}`;
  else if (f === '3') body = `${ns}${a}${b}${c}00000${d}${e}`;
  else if (f === '4') body = `${ns}${a}${b}${c}${d}00000${e}`;
  else body = `${ns}${a}${b}${c}${d}${e}0000${f}`;
  const expanded = body + check;
  return hasValidGtinCheckDigit(expanded) ? expanded : null;
}
export function normalizeBarcode(code: Code): BarcodeNormalization {
  const base: BarcodeNormalization = { supported: false, reason: 'unsupported_namespace', raw: code.raw, symbology: code.symbology, namespace: code.namespace, retailerId: code.retailerId, canonicalCode: null, canonicalGtin14: null, nativeCode: null, normalizationVersion: BARCODE_NORMALIZATION_VERSION };
  const symbol = code.symbology?.toLowerCase().replace(/[-_ ]/g, '') ?? null;
  if (symbol && !['upca', 'upce', 'ean13', 'ean8', 'itf14', 'gtin14'].includes(symbol)) return base;
  if (!/^\d+$/.test(code.raw)) return { ...base, reason: 'invalid_code' };
  if (code.raw.length === 8 && !symbol) return base;
  if (code.namespace === 'unknown') return base;
  let native = code.raw;
  if (symbol === 'upce') {
    const expanded = expandUpce(native);
    if (!expanded) return { ...base, reason: 'invalid_code' };
    native = expanded;
  } else {
    const expected = symbol === 'upca' ? 12 : symbol === 'ean13' ? 13 : symbol === 'ean8' ? 8 : symbol === 'itf14' || symbol === 'gtin14' ? 14 : null;
    // Existing iOS Expo entry retains EAN-13 type after removing its leading zero.
    // Accept only checksum-valid UPC-A length here; preserve the native raw/type pair.
    const iosUpcaRepresentation = symbol === 'ean13' && native.length === 12;
    if ((expected !== null && native.length !== expected && !iosUpcaRepresentation) || !hasValidGtinCheckDigit(native)) return { ...base, reason: 'invalid_code' };
  }
  // Restricted circulation/variable-weight codes have meaning only in their retailer namespace.
  const restricted = native.length === 12 && /^[24]/.test(native) || native.length === 13 && /^2\d/.test(native);
  if (restricted && (code.namespace !== 'retailer' || !code.retailerId)) return base;
  if (code.namespace === 'retailer') {
    if (!code.retailerId) return base;
    return { ...base, supported: true, reason: null, canonicalCode: `retailer:${code.retailerId}:${native}`, nativeCode: native };
  }
  const canonicalGtin14 = native.padStart(14, '0');
  return { ...base, supported: true, reason: null, canonicalCode: canonicalGtin14, canonicalGtin14, nativeCode: native };
}
/** Market routing never mutates evidence; JSON framing prevents namespace/key collisions. */
export function publicLookupKey(code: BarcodeNormalization, requestedMarket: string | null, capabilityGap: string, policyVersion: string): string | null {
  return code.supported ? JSON.stringify([code.namespace, code.canonicalCode, requestedMarket, capabilityGap, policyVersion]) : null;
}
