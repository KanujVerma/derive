/**
 * Barcode normalization and validation utilities for Derive.
 *
 * Handles standard retail barcode formats:
 * - UPC-A (12 digits)
 * - EAN-13 (13 digits, often UPC-A with leading '0')
 * - EAN-8 (8 digits)
 * - UPC-E (expanded to UPC-A where applicable)
 */

/**
 * Normalizes raw scanned barcode string:
 * - Strips whitespace, hyphens, and non-numeric characters.
 * - If 13 digits and starts with '0' (standard EAN-13 encoding of UPC-A),
 *   normalizes to the canonical 12-digit UPC-A.
 * - Preserves leading zeros for genuine 12-digit UPC-A (e.g. '077043103847').
 */
export function normalizeBarcode(rawBarcode: string): string {
  if (!rawBarcode || typeof rawBarcode !== 'string') {
    return '';
  }

  // Remove any non-numeric characters
  const clean = rawBarcode.replace(/\D/g, '');

  // If 13 digits and begins with 0, canonicalize to 12-digit UPC-A
  if (clean.length === 13 && clean.startsWith('0')) {
    return clean.slice(1);
  }

  return clean;
}

/**
 * Generates an array of lookup keys for resilient catalog matching.
 * E.g., for a 12-digit UPC-A '769915190602', returns ['769915190602', '0769915190602'].
 * E.g., for 13-digit EAN-13 starting with 0 '0769915190602', returns ['769915190602', '0769915190602'].
 */
export function getBarcodeLookupKeys(rawBarcode: string): string[] {
  const normalized = normalizeBarcode(rawBarcode);
  if (!normalized) return [];

  const keys = new Set<string>();
  keys.add(normalized);

  // If 12 digits (UPC-A), also include the 13-digit EAN-13 padded version
  if (normalized.length === 12) {
    keys.add(`0${normalized}`);
  }

  // If original had a leading zero and was 13 digits, ensure both are present
  const digitsOnly = rawBarcode.replace(/\D/g, '');
  if (digitsOnly.length === 13 && digitsOnly.startsWith('0')) {
    keys.add(digitsOnly);
  }

  return Array.from(keys);
}

/**
 * Validates the GS1 check digit algorithm for 8, 12, or 13-digit barcodes.
 * Returns true if valid check digit, false otherwise.
 */
export function validateBarcodeChecksum(barcode: string): boolean {
  const clean = barcode.replace(/\D/g, '');
  const len = clean.length;

  if (len !== 8 && len !== 12 && len !== 13) {
    return false;
  }

  const digits = clean.split('').map(Number);
  const checkDigit = digits[len - 1];

  let sum = 0;
  // GS1 rule: moving left from the check digit, weights alternate 3, 1, 3, 1...
  for (let i = len - 2; i >= 0; i--) {
    const distanceFromCheck = (len - 1) - i;
    const weight = distanceFromCheck % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  return checkDigit === expectedCheckDigit;
}
