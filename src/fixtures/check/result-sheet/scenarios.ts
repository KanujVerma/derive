import type { CatalogProductSummary } from '../../../contracts/ProductCatalog.ts';
import { verifiedProductTruth, unresolvedProductTruth, formulaOnlyProductTruth } from '../../product-truth/snapshots.ts';
import { buildScanResultSheet } from '../../../presentation/check/result-sheet/model.ts';

/** Synthetic presentation states. They are not catalog coverage or a device acceptance receipt. */
const product: CatalogProductSummary = {
  productId: verifiedProductTruth.product!.productId,
  brand: 'Synthetic', name: 'Fixture Cleanser', category: 'cleanser',
  imageUrl: null, isCatalogStandard: true, variantCount: 1,
  formulaState: 'verified_variant_available',
};

export const scanResultSheetFixtures = {
  loading: buildScanResultSheet({ kind: 'loading', ownerId: 'synthetic-owner', scanId: 'synthetic-scan' }),
  verified: buildScanResultSheet({ kind: 'snapshot', snapshot: verifiedProductTruth, catalogProduct: product }),
  formulaUnverified: buildScanResultSheet({ kind: 'snapshot', snapshot: {
    ...verifiedProductTruth, state: 'identified_formula_unverified', formula: null,
    catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null },
    unknownFields: ['formula'], nextRequiredEvidence: 'ingredients',
  }, catalogProduct: { ...product, formulaState: 'unverified' } }),
  ambiguous: buildScanResultSheet({ kind: 'snapshot', snapshot: {
    ...unresolvedProductTruth, state: 'ambiguous_candidates', customerConfirmation: 'required',
  } }),
  formulaOnly: buildScanResultSheet({ kind: 'snapshot', snapshot: formulaOnlyProductTruth }),
  unknown: buildScanResultSheet({ kind: 'snapshot', snapshot: unresolvedProductTruth }),
  error: buildScanResultSheet({ kind: 'error', ownerId: 'synthetic-owner', scanId: 'synthetic-scan' }),
} as const;
