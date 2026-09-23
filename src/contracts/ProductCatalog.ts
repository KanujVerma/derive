/** Shared catalog facts. Identity and formula facts never imply personalized fit. */
export type CatalogFormulaState = 'unverified' | 'verified_variant_available' | 'multiple_versions';

export interface CatalogProductSummary {
  productId: string;
  brand: string;
  name: string;
  category: string;
  imageUrl: string | null;
  isCatalogStandard: true;
  variantCount: number;
  formulaState: CatalogFormulaState;
}

export interface CatalogFormulaFacts {
  formulaVersionId: string;
  ingredients: string[];
  provenanceType: 'manufacturer' | 'package_label' | 'regulator' | 'founder_review';
  sourceReference: string | null;
  observedAt: string;
}

export interface CatalogVariantDetail {
  variantId: string;
  name: string;
  regionCode: string | null;
  packageSize: string | null;
  sourceReference: string | null;
  observedAt: string | null;
  verificationState: 'provisional' | 'verified';
  formulaState: 'verified' | 'unverified' | 'multiple_versions';
  formula?: CatalogFormulaFacts;
}

export interface CatalogProductDetail extends CatalogProductSummary {
  sourceReference: string | null;
  observedAt: string;
  variants: CatalogVariantDetail[];
}

export type CatalogRequest =
  | { operation: 'search'; query: string; limit: number }
  | { operation: 'detail'; productId: string; variantId?: string };
