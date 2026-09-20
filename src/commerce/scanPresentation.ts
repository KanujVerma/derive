import { ProductScanVerdictLabels, type ProductScanVerdict } from '../types/schema.ts';

/** Fail closed on an unrecognized server verdict; never display a numeric score. */
export function resolveScanVerdictLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(ProductScanVerdictLabels, value)) {
    return null;
  }
  return ProductScanVerdictLabels[value as ProductScanVerdict];
}
