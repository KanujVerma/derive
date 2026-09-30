/** Preserve legacy request fingerprints while distinguishing pasted/link-derived codes.
 * Origin is reported evidence, never proof that a camera or manufacturer supplied it.
 */
export function parseBarcodeSource(value: unknown, hasBarcode: boolean):
  { ok: true; source?: 'member_input' } | { ok: false } {
  if (value === undefined) return { ok: true };
  if (!hasBarcode || (value !== 'device_barcode' && value !== 'member_input')) {
    return { ok: false };
  }
  // Explicit device input and old clients serialize identically on retry.
  return value === 'member_input' ? { ok: true, source: value } : { ok: true };
}
