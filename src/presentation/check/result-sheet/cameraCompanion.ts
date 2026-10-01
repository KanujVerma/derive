import type { CatalogProductSummary } from '../../../contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../../../contracts/ProductIdentityResolver.ts';
import { buildScanResultSheet, type SheetModel } from './model.ts';

export interface CameraCompanionInput {
  awaiting: boolean;
  checking: boolean;
  ownerId: string | null;
  scanId: string;
  error: string | null;
  unknownBarcode?: string | null;
  resolution: ProductResolutionResult | null;
  catalogProduct: CatalogProductSummary | null;
}

/**
 * Overlay for a camera that stays mounted.
 * A finished resolver result without an immutable snapshot cannot be bound here.
 */
export function cameraCompanionSheet(input: CameraCompanionInput): SheetModel | null {
  if (!input.awaiting || input.scanId.length === 0) return null;
  if (input.checking) {
    return buildScanResultSheet({ kind: 'loading', ownerId: input.ownerId, scanId: input.scanId });
  }
  const snapshot = input.resolution?.truthSnapshot;
  if (snapshot) {
    return buildScanResultSheet({
      kind: 'snapshot', snapshot, ownerId: input.ownerId,
      catalogProduct: input.catalogProduct, resolverResult: input.resolution,
    });
  }
  if (input.error) {
    return buildScanResultSheet({ kind: 'error', ownerId: input.ownerId, scanId: input.scanId });
  }
  if (input.unknownBarcode) return buildScanResultSheet({ kind: 'unknown', ownerId: input.ownerId, scanId: input.scanId });
  return null;
}

/** The existing full-page result remains the path when a finished case has no snapshot to bind. */
export function cameraResultNeedsExistingPage(input: CameraCompanionInput): boolean {
  return input.awaiting && !input.checking && !input.error
    && input.resolution !== null && input.resolution.truthSnapshot === undefined;
}
