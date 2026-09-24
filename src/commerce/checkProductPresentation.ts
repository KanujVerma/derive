import type { CatalogProductDetail, CatalogFormulaFacts } from '../contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../contracts/ProductIdentityResolver.ts';
import type { ProductResolutionState } from '../contracts/ProductIdentityResolver.ts';

export type CheckProductFitState =
  | { kind: 'provider_unavailable'; message: string }
  | { kind: 'formula_unverified'; message: string }
  | { kind: 'choose_candidate'; message: string }
  | { kind: 'identity_unverified'; message: string };

/** H1P is not active for this release; identity evidence never becomes a fit verdict. */
export function describeCheckProductFit(state: ProductResolutionState): CheckProductFitState {
  if (state === 'verified_product_formula') return {
    kind: 'provider_unavailable',
    message: 'Personal fit is not available yet. Formula facts are shown separately below.',
  };
  if (state === 'identified_formula_unverified') return {
    kind: 'formula_unverified',
    message: 'We know the product, but not the formula in your exact package. Personal fit is unavailable.',
  };
  if (state === 'ambiguous_candidates') return {
    kind: 'choose_candidate',
    message: 'More than one product may match. Choose the exact product or wait for a founder review.',
  };
  return {
    kind: 'identity_unverified',
    message: 'We cannot confirm this product yet. Personal fit is unavailable.',
  };
}

/** A searched candidate is displayable only when S6 resolves that exact product. */
export function resolvedCatalogDetailId(
  resolution: Pick<ProductResolutionResult, 'state' | 'product'>,
  selectedProductId?: string,
): string | null {
  if (resolution.state !== 'verified_product_formula' && resolution.state !== 'identified_formula_unverified') return null;
  const id = resolution.product?.productId;
  if (!id || (selectedProductId && selectedProductId !== id)) return null;
  return id;
}


/** Catalog formula evidence is displayable only after exact S6 package resolution. */
export function getVerifiedFormulaForResolution(
  detail: CatalogProductDetail | null,
  resolution: Pick<ProductResolutionResult, 'state' | 'product' | 'formula'> | null,
): CatalogFormulaFacts | null {
  if (!detail || resolution?.state !== 'verified_product_formula' || !resolution.formula
    || resolution.product?.productId !== detail.productId || !resolution.product?.variantId) return null;
  return detail.variants.find((variant) =>
    variant.variantId === resolution.product?.variantId
      && variant.formulaState === 'verified'
      && variant.formula?.formulaVersionId === resolution.formula?.formulaVersionId
  )?.formula ?? null;
}
