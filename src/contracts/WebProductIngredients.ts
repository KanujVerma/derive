/** Product facts only; never skin context or client-selected fetch URLs. */
export interface WebProductIngredientsRequest {
  barcode: string;
  name: string;
  brand: string | null;
  size: string | null;
}

export interface WebIngredientEvidence {
  productName: string;
  ingredientsText: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  basis: 'published_web';
  formulaVerified: false;
}
export type WebProductIngredientsResult = {
  status: 'found';
  evidence: WebIngredientEvidence;
} | { status: 'not_found' | 'ambiguous' | 'rate_limited' | 'configuration_required' | 'unavailable' };
export type WebProductIngredientLookup = WebProductIngredientsResult;
