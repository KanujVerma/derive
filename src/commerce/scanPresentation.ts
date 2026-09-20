import { ProductScanVerdictLabels, type ProductScanVerdict } from '../types/schema.ts';

/** Fail closed on an unrecognized server verdict; never display a numeric score. */
export function resolveScanVerdictLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(ProductScanVerdictLabels, value)) {
    return null;
  }
  return ProductScanVerdictLabels[value as ProductScanVerdict];
}

export type ScanResultPresentation =
  | { kind: 'waiting' }
  | { kind: 'invalid' }
  | { kind: 'ready'; label: string };

/** The UI never trusts an unvalidated verdict label from an Edge response. */
export function resolveScanResultPresentation(result: unknown): ScanResultPresentation {
  if (result == null) return { kind: 'waiting' };
  if (typeof result !== 'object' || Array.isArray(result)) return { kind: 'invalid' };
  const label = resolveScanVerdictLabel((result as { verdict?: unknown }).verdict);
  return label ? { kind: 'ready', label } : { kind: 'invalid' };
}
