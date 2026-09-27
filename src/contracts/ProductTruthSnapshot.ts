import type { ProductResolutionState, ResolvedProductIdentity, ProductEvidencePhotoRole } from './ProductIdentityResolver.ts';

/** Authoritative, immutable S6 output. Never a personal decision or OCR result. */
export interface ProductTruthSnapshotV1 {
  schemaVersion: 1;
  snapshotId: string;
  createdAt: string;
  resolutionCaseId: string;
  /** Increments only when the case is reviewed; catalog refresh never rewrites history. */
  caseRevision: number;
  resolverVersion: string;
  state: ProductResolutionState;
  product: ResolvedProductIdentity | null;
  identityStatus: 'identified' | 'unresolved';
  formula: {
    formulaVersionId: string;
    verificationStatus: 'verified';
    /** Formula-only matches do not prove which package the customer holds. */
    appliesToSelectedVariant: boolean;
    ingredients: string[];
    observedAt: string;
    provenanceType: 'manufacturer' | 'package_label' | 'regulator' | 'founder_review';
    /** Approved public source only. Internal references are never returned. */
    publicSourceUrl: string | null;
  } | null;
  identifiers: Array<{ type: 'gtin'; value: string; status: 'customer_observed' }>;
  evidence: Array<{
    evidenceId: string;
    type: ProductEvidencePhotoRole | 'barcode' | 'typed_identity';
    source: 'device_barcode' | 'member_input' | 'trusted_ocr' | 'founder_review';
    /** Every customer or extraction observation remains candidate evidence. */
    authority: 'candidate';
  }>;
  catalogReferences: { productId: string | null; variantId: string | null; formulaVersionId: string | null };
  unknownFields: Array<'product' | 'variant' | 'region' | 'formula' | 'public_source'>;
  conflicts: Array<{
    code: 'identity_mismatch' | 'region_mismatch' | 'ingredient_mismatch' | 'identifier_conflict';
    status: 'unresolved' | 'reviewed';
  }>;
  nextRequiredEvidence: 'none' | 'front_label' | 'ingredients' | 'variant_selection' | 'manual_review';
  customerConfirmation: 'not_required' | 'required';
  founderReview: 'not_needed' | 'pending' | 'resolved' | 'dismissed';
}

/** Consumers must abstain from package-specific formula decisions for formula-only. */
export function hasVerifiedPackageFormula(snapshot: ProductTruthSnapshotV1): boolean {
  return snapshot.state === 'verified_product_formula' && snapshot.identityStatus === 'identified'
    && !!snapshot.product?.variantId && snapshot.formula?.verificationStatus === 'verified'
    && snapshot.formula.appliesToSelectedVariant
    && snapshot.catalogReferences.productId === snapshot.product.productId
    && snapshot.catalogReferences.variantId === snapshot.product.variantId
    && snapshot.catalogReferences.formulaVersionId === snapshot.formula.formulaVersionId
    && snapshot.formula.ingredients.length > 0
    && !snapshot.conflicts.some((conflict) => conflict.status === 'unresolved');
}
