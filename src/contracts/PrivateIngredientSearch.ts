/** Ephemeral Google-grounded display only; never catalog/formula/personal-decision input. */
export interface PrivateIngredientQuery {
  barcode: string;
  name: string;
  brand: string | null;
  size: string | null;
}

export interface PrivateGroundedAnswer {
  status: 'grounded_answer';
  query: PrivateIngredientQuery;
  text: string;
  searchSuggestionsHtml: string;
  sources: { title: string; url: string }[];
  retrievedAt: string;
  formulaVerified: false;
  canonicalProductId: null;
}

export type PrivateIngredientSearch = PrivateGroundedAnswer | {
  status: 'configuration_required' | 'rate_limited' | 'unavailable' | 'no_grounded_answer';
};
