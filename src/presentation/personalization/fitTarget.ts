import type { CatalogProductDetail } from '../../contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../../contracts/ProductIdentityResolver.ts';
import { getVerifiedFormulaForResolution } from '../../commerce/checkProductPresentation.ts';

/** Only a matched verified package may carry a variant into S-FREE-2. */
export function selectFreeFitTarget(detail: CatalogProductDetail | null, resolution: ProductResolutionResult | null):
  { productId: string; variantId?: string } | null {
  if (!detail || (resolution && resolution.product?.productId !== detail.productId)) return null;
  const formula = getVerifiedFormulaForResolution(detail, resolution);
  return formula && resolution?.product?.variantId
    ? { productId: detail.productId, variantId: resolution.product.variantId }
    : { productId: detail.productId };
}
