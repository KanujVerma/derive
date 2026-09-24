/**
 * Stable S6 backend contract shared by Scan and Shelf consumers.
 *
 * Product identity and formula identity are deliberately separate. A visual or
 * text resemblance may produce candidates, but only authoritative catalog
 * evidence can produce a verified product/formula result.
 */

export type ProductResolutionConsumer = 'scan' | 'shelf';

export type ProductResolutionState =
  | 'verified_product_formula'
  | 'identified_formula_unverified'
  | 'ambiguous_candidates'
  | 'formula_only'
  | 'insufficient_evidence';

export type ProductEvidencePhotoRole = 'front_label' | 'ingredients' | 'packaging';

export interface ProductEvidencePhoto {
  /** Private `customer-product-evidence` object path owned by the caller. */
  storagePath: string;
  role: ProductEvidencePhotoRole;
  /** Optional OCR or typed text. It is untrusted, candidate-only evidence. */
  extractedText?: string;
}

export interface ResolveProductIdentityInput {
  /** Caller-generated UUID. Retries with the same value return the same case. */
  requestId: string;
  consumer: ProductResolutionConsumer;
  barcode?: string;
  brand?: string;
  productName?: string;
  variantName?: string;
  regionCode?: string;
  labelText?: string;
  packagingText?: string;
  ingredientList?: string[];
  evidencePhotos?: ProductEvidencePhoto[];
}

export interface ResolvedProductIdentity {
  productId: string;
  brand: string;
  name: string;
  variantId?: string;
  variantName?: string;
  regionCode?: string;
}

export interface ResolvedFormulaIdentity {
  formulaVersionId: string;
  verificationStatus: 'verified';
  sourceReference: string;
  observedAt: string;
}

export type ProductCandidateBasis =
  | 'authoritative_identifier'
  | 'exact_typed_identity'
  | 'label_text'
  | 'ingredient_fingerprint'
  | 'packaging'
  | 'combined_candidate_evidence';

export interface ProductResolutionCandidate {
  productId?: string;
  variantId?: string;
  formulaVersionId?: string;
  brand?: string;
  name?: string;
  variantName?: string;
  basis: ProductCandidateBasis;
  matchReasons: string[];
}

export type ProductResolutionNextAction =
  | 'evaluate_product_fit'
  | 'confirm_variant'
  | 'photograph_ingredients'
  | 'choose_candidate'
  | 'manual_review';

export interface ProductResolutionResult {
  caseId: string;
  state: ProductResolutionState;
  product?: ResolvedProductIdentity;
  formula?: ResolvedFormulaIdentity;
  candidates: ProductResolutionCandidate[];
  nextAction: ProductResolutionNextAction;
  requiresFounderReview: boolean;
}
