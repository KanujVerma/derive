import type { ProductResolutionResult } from '../../../contracts/ProductIdentityResolver.ts';
import type { PhotoRole } from '../../capture/productEvidence.ts';

/** Evidence gaps and operation failures require different actions. Verified abstentions never request more photos. */
export function checkRecoveryPlan(input: { loading: boolean; error: string | null; resolution: ProductResolutionResult | null;
  unknownBarcode: string | null; hasPhotos: boolean; hasCatalogIdentity: boolean; enteredName?: boolean; linkNeedsDetails?: boolean }): { photoRole: PhotoRole | null; search: boolean; retry: boolean } {
  if (input.loading) return { photoRole: null, search: false, retry: false };
  if (input.error) return { photoRole: null, search: false, retry: true };
  const result = input.resolution;
  if (result?.state === 'verified_product_formula') return { photoRole: null, search: false, retry: false };
  if (result?.truthSnapshot?.conflicts.length) return { photoRole: 'front_label', search: true, retry: false };
  if (result?.state === 'identified_formula_unverified' || !result && input.hasCatalogIdentity) {
    return { photoRole: result && result.nextAction !== 'photograph_ingredients' ? null : 'ingredients', search: false, retry: false };
  }
  if (result || input.unknownBarcode || input.hasPhotos || input.enteredName || input.linkNeedsDetails) return { photoRole: 'front_label', search: true, retry: false };
  return { photoRole: null, search: false, retry: false };
}
