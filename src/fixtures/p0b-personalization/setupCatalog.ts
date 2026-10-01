import type { CatalogProductSummary } from '../../contracts/ProductCatalog.ts';
import { searchPreviewCatalog } from '../../commerce/checkPreview.ts';

/** Authored category fact for the guarded five-step fixture only. Never a catalog authority. */
const moisturizer: CatalogProductSummary = {
  productId: '00000000-0000-4000-8000-000000000099', brand: 'Fictional example', name: 'Comfort Cream',
  category: 'moisturizer', imageUrl: null, isCatalogStandard: true, variantCount: 0, formulaState: 'unverified',
};
export async function searchSetupPreviewCatalog(query: string): Promise<CatalogProductSummary[]> {
  const cleaned = query.trim().toLowerCase();
  const sourced = await searchPreviewCatalog(query);
  return cleaned.length >= 2 && 'fictional example comfort cream moisturizer'.includes(cleaned) ? [...sourced, moisturizer] : sourced;
}
