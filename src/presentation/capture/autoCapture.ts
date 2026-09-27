import type { CaptureRole, PhotoRole } from './productEvidence.ts';

/** Routing intent is not evidence and never enters the product-truth contract. */
export type CaptureIntent = 'auto' | CaptureRole;

/** Without a validated still-image signal, Auto must ask rather than guess. */
export function stillPhotoRole(intent: CaptureIntent): PhotoRole | null {
  return intent === 'auto' || intent === 'barcode' ? null : intent;
}

export function canObserveLiveBarcode(intent: CaptureIntent, state: {
  busy: boolean; hasPreview: boolean; locked: boolean;
}): boolean {
  return (intent === 'auto' || intent === 'barcode') && !state.busy && !state.hasPreview && !state.locked;
}

export function isObservedGtin(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  let sum = 0;
  for (let index = value.length - 2, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) {
    sum += Number(value[index]) * weight;
  }
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}

/** UPC-E requires explicit expansion; its eight digits must not masquerade as EAN-8. */
export function isObservedRetailBarcode(value: string, type: string): boolean {
  const expectedLength = type === 'ean8' ? 8 : type === 'upc_a' ? 12 : type === 'ean13' ? 13 : 0;
  return expectedLength !== 0 && value.length === expectedLength && isObservedGtin(value);
}
