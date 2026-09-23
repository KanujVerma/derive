import type { CatalogProductDetail, CatalogProductSummary } from '../contracts/ProductCatalog.ts';

/** Sourced product-only local sample. It is never used as Remote catalog authority. */
const SAMPLE: CatalogProductDetail = {
  productId: 'ef6b7fc6-fa95-47ec-a86b-edcf11a8ab66',
  brand: 'CeraVe',
  name: 'Renewing SA Cleanser',
  category: 'cleanser',
  imageUrl: null,
  isCatalogStandard: true,
  variantCount: 0,
  formulaState: 'unverified',
  sourceReference: 'https://www.cerave.com/skincare/cleansers/renewing-sa-cleanser',
  observedAt: '2026-09-22T00:00:00Z',
  variants: [],
};

const SEARCH_NAMES = ['CeraVe Renewing SA Cleanser', 'Renewing SA Cleanser', 'CeraVe SA Cleanser'];
const SUMMARY: CatalogProductSummary = {
  productId: SAMPLE.productId,
  brand: SAMPLE.brand,
  name: SAMPLE.name,
  category: SAMPLE.category,
  imageUrl: SAMPLE.imageUrl,
  isCatalogStandard: true,
  variantCount: SAMPLE.variantCount,
  formulaState: SAMPLE.formulaState,
};

export async function searchPreviewCatalog(query: string): Promise<CatalogProductSummary[]> {
  const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalized.length < 2) return [];
  return SEARCH_NAMES.some((name) => name.toLowerCase().includes(normalized)) ? [SUMMARY] : [];
}

export function getPreviewCatalogDetail(productId: string): CatalogProductDetail | null {
  return productId === SAMPLE.productId ? SAMPLE : null;
}
