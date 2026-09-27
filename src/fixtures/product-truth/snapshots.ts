import type { ProductTruthSnapshotV1 } from '../../contracts/ProductTruthSnapshot.ts';

/** Synthetic boundary fixtures, not production catalog products or provider benchmarks. */
export const unresolvedProductTruth: ProductTruthSnapshotV1 = {
  schemaVersion: 1,
  snapshotId: '10000000-0000-4000-8000-000000000001',
  createdAt: '2026-09-26T00:00:00.000Z',
  resolutionCaseId: '10000000-0000-4000-8000-000000000002',
  caseRevision: 1,
  resolverVersion: 's6-p0a-1',
  state: 'insufficient_evidence', product: null, identityStatus: 'unresolved', formula: null,
  identifiers: [], evidence: [],
  catalogReferences: { productId: null, variantId: null, formulaVersionId: null },
  unknownFields: ['product', 'variant', 'region', 'formula', 'public_source'], conflicts: [],
  nextRequiredEvidence: 'front_label', customerConfirmation: 'not_required', founderReview: 'not_needed',
};

export const verifiedProductTruth: ProductTruthSnapshotV1 = {
  ...unresolvedProductTruth, snapshotId: '10000000-0000-4000-8000-000000000003',
  state: 'verified_product_formula', identityStatus: 'identified',
  product: { productId: '10000000-0000-4000-8000-000000000004', brand: 'Synthetic', name: 'Fixture Cleanser',
    variantId: '10000000-0000-4000-8000-000000000005', variantName: '100 mL', regionCode: 'US' },
  formula: { formulaVersionId: '10000000-0000-4000-8000-000000000006', verificationStatus: 'verified',
    appliesToSelectedVariant: true, ingredients: ['Water', 'Glycerin'], observedAt: '2026-09-25T00:00:00.000Z',
    provenanceType: 'manufacturer', publicSourceUrl: 'https://example.org/synthetic-fixture' },
  catalogReferences: { productId: '10000000-0000-4000-8000-000000000004',
    variantId: '10000000-0000-4000-8000-000000000005', formulaVersionId: '10000000-0000-4000-8000-000000000006' },
  unknownFields: [], nextRequiredEvidence: 'none',
};

export const formulaOnlyProductTruth: ProductTruthSnapshotV1 = {
  ...unresolvedProductTruth, snapshotId: '10000000-0000-4000-8000-000000000007', state: 'formula_only',
  formula: { ...verifiedProductTruth.formula!, appliesToSelectedVariant: false },
  catalogReferences: { productId: null, variantId: null, formulaVersionId: verifiedProductTruth.formula!.formulaVersionId },
  unknownFields: ['product', 'variant', 'region'], nextRequiredEvidence: 'variant_selection',
  customerConfirmation: 'required',
};
