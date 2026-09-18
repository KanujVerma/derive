import type { ProductScanResult } from '../domain/types.ts';

export type AskRouteParams = {
  initialQuery?: string;
  productName?: string;
  brand?: string;
  verdict?: string;
  reason?: string;
  whatItWouldChangeOrReplace?: string;
  scannedProductName?: string;
  scannedBrand?: string;
  scannedVerdict?: string;
  scannedReason?: string;
  [key: string]: string | string[] | undefined;
};

export interface AskDisplayBannerInfo {
  productName: string;
  verdictLabel: string;
  source: 'transient_store' | 'route_params';
}

/**
 * Resolves visible banner metadata for the Ask screen.
 *
 * Full transient store scan result always outranks route query strings.
 * Lightweight route params are used strictly for display continuity (e.g. deep-links),
 * and are NEVER synthesized into a ProductScanResult or sent to IDeriveService.
 */
export function resolveAskDisplayBanner(
  activeScannedProduct: ProductScanResult | null,
  params?: AskRouteParams
): AskDisplayBannerInfo | null {
  if (activeScannedProduct) {
    return {
      productName: activeScannedProduct.productName,
      verdictLabel: (activeScannedProduct.verdictLabel || activeScannedProduct.verdict).toUpperCase().replace(/_/g, ' '),
      source: 'transient_store',
    };
  }

  const rawName = params?.productName || params?.scannedProductName;
  const rawVerdict = params?.verdict || params?.scannedVerdict;
  const fallbackName = Array.isArray(rawName) ? rawName[0] : rawName;
  const fallbackVerdict = Array.isArray(rawVerdict) ? rawVerdict[0] : rawVerdict;

  if (fallbackName && fallbackVerdict) {
    return {
      productName: fallbackName,
      verdictLabel: fallbackVerdict.toUpperCase().replace(/_/g, ' '),
      source: 'route_params',
    };
  }

  return null;
}

/**
 * Resolves the service domain context for an Ask message.
 *
 * Returns strictly the full typed ProductScanResult from transient store or explicit override.
 * Route query strings are deliberately excluded so partial strings are never passed as synthetic domain records.
 */
export function resolveAskServiceContext(
  transientStoreProduct: ProductScanResult | null,
  overrideContext?: ProductScanResult
): ProductScanResult | undefined {
  if (overrideContext !== undefined) {
    return overrideContext;
  }
  return transientStoreProduct || undefined;
}
