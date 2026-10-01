/** Public-source evidence, not a package-verified formula or personal verdict. */
export interface ProductIngredientQuery {
  barcode: string;
  name: string | null;
  brand: string | null;
  size: string | null;
}

export interface PublishedIngredientEvidence {
  source: 'open_beauty_facts' | 'dailymed';
  sourceUrl: string;
  sourceLicense: 'ODbL-1.0' | 'DailyMed-public-label';
  retrievedAt: string;
  sourceModifiedAt: string | null;
  barcode: string | null;
  productName: string;
  brand: string | null;
  quantity: string | null;
  ingredientsText: string;
  matchBasis: 'barcode' | 'name_variant';
  formulaVerified: false;
  canonicalProductId: null;
}

export type IngredientSourceStatus = 'found' | 'not_found' | 'incomplete' | 'unavailable' | 'rate_limited' | 'ambiguous' | 'not_queried';
export interface ProductIngredientLookup {
  status: 'found' | 'not_found' | 'unavailable' | 'rate_limited' | 'ambiguous';
  query: ProductIngredientQuery;
  evidence: PublishedIngredientEvidence[];
  sources: { source: PublishedIngredientEvidence['source']; status: IngredientSourceStatus }[];
  /** This rollout is an ephemeral private test, not a licensed proprietary catalog import. */
  rightsPolicy: 'private_evaluation_only';
}
