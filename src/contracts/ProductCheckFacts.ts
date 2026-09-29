/** A factual companion to PersonalDecision, not a personal-use recommendation.
 * The owner-bound host constructs this from a sealed S6 snapshot and immutable
 * observations. A source observation never becomes canonical formula truth.
 */
export type ProductCheckFactCode =
  | 'catalog_category' | 'verified_ingredients' | 'observed_ingredients'
  | 'deodorant_statement' | 'antiperspirant_statement'
  | 'shampoo_statement' | 'conditioner_statement'
  | 'body_wash_statement' | 'body_moisturizer_statement'
  | 'spf_statement' | 'broad_spectrum_statement'
  | 'water_resistance_statement' | 'drug_facts_statement';

export type ProductCheckFactBasis =
  | { kind: 'catalog_category'; sourceId: string; sourceRevision: string }
  | { kind: 'verified_package_formula'; sourceId: string; observedAt: string; publicSourceUrl: string | null }
  | { kind: 'submitted_label' | 'submitted_ingredients'; evidenceId: string; extraction: 'member_input' | 'trusted_ocr' };

export interface ProductCheckFact {
  code: ProductCheckFactCode;
  /** Parsed values only: no raw pages, image data, profile data, or free-form advice. */
  value: string | string[];
  basis: ProductCheckFactBasis;
  certainty: 'accepted' | 'observed_unverified';
}

export interface ProductCheckFactsV1 {
  schemaVersion: 'product-check-facts/v1';
  caseId: string;
  snapshotId: string;
  caseRevision: number;
  createdAt: string;
  /** Source category or label clue only; neither implies a suitable formula. */
  category: 'cleanser' | 'toner' | 'treatment' | 'serum' | 'moisturizer' | 'sunscreen' | 'oil' | 'mask' | 'deodorant' | 'body_care' | 'hair_care' | 'other' | 'unknown';
  facts: ProductCheckFact[];
  missing: Array<'identity' | 'ingredient_list' | 'readable_label' | 'drug_facts' | 'conflicting_spf'>;
  nextEvidence: 'none' | 'front_label' | 'ingredients' | 'drug_facts';
}
