import type { CatalogProductSummary } from '../../../contracts/ProductCatalog.ts';
import type { ProductResolutionResult } from '../../../contracts/ProductIdentityResolver.ts';
import type { ProductTruthSnapshotV1 } from '../../../contracts/ProductTruthSnapshot.ts';
import { hasVerifiedPackageFormula } from '../../../contracts/ProductTruthSnapshot.ts';
import { projectTrustedSnapshot } from '../../personal-decision/truthAdapter.ts';
import { describeProductTruth } from '../../capture/productTruthPresentation.ts';

export type SheetImage = { kind: 'placeholder' } | { kind: 'catalog'; uri: string; label: 'Product image, package may differ' }
  | { kind: 'customer_unverified'; uri: string; label: 'Your photo, unverified' };
export interface LocalCustomerPhoto {
  uri: string;
  ownerId: string;
  caseId: string;
  snapshotId: string;
  evidenceId: string;
}
export interface SheetBinding {
  ownerId: string | null;
  caseId: string;
  snapshotId: string;
  caseRevision: number;
  productId: string | null;
  variantId: string | null;
  formulaVersionId: string | null;
}
export interface RequestedEvidenceAction {
  kind: 'add_requested_evidence';
  role: 'ingredients';
  binding: SheetBinding;
}
export type SheetInput = { kind: 'loading'; ownerId: string | null; scanId: string }
  | { kind: 'error'; ownerId: string | null; scanId: string }
  | { kind: 'unknown'; ownerId: string | null; scanId: string } | {
  kind: 'snapshot'; snapshot: ProductTruthSnapshotV1; ownerId?: string | null;
  catalogProduct?: CatalogProductSummary | null; localCustomerPhoto?: LocalCustomerPhoto | null;
  resolverResult?: ProductResolutionResult | null;
};
export type SheetModel = { kind: 'loading' | 'error' | 'unknown'; title: string; detail: string;
  ownerId: string | null; scanId: string } | {
  kind: 'result'; title: string; brand: string | null; status: string; detail: string;
  nextAction: string; image: SheetImage; binding: SheetBinding;
  personalFit: null | { title: string; reason: string };
  requestedEvidence: RequestedEvidenceAction | null;
};

/** The catalog service must first approve public image provenance and rights. */
export function catalogImagePresentation(value: string | null): SheetImage {
  if (!value) return { kind: 'placeholder' };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password
      || url.search || url.hash || url.hostname === 'localhost'
      || /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return { kind: 'placeholder' };
    return { kind: 'catalog', uri: value, label: 'Product image, package may differ' };
  } catch { return { kind: 'placeholder' }; }
}

function localPhotoPresentation(photo: LocalCustomerPhoto | null | undefined,
  ownerId: string | null, snapshot: ProductTruthSnapshotV1): SheetImage {
  if (!photo || !ownerId || photo.ownerId !== ownerId
    || photo.caseId !== snapshot.resolutionCaseId || photo.snapshotId !== snapshot.snapshotId
    || !snapshot.evidence.some(item => item.evidenceId === photo.evidenceId
      && item.source === 'member_input'
      && (item.type === 'front_label' || item.type === 'ingredients' || item.type === 'packaging'))
    || !/^file:\/\/\/[^\s]+$/i.test(photo.uri)) return { kind: 'placeholder' };
  return { kind: 'customer_unverified', uri: photo.uri, label: 'Your photo, unverified' };
}

function bindingFor(ownerId: string | null, snapshot: ProductTruthSnapshotV1): SheetBinding {
  const projection = projectTrustedSnapshot({ snapshot });
  const identity = (snapshot.state === 'verified_product_formula' || snapshot.state === 'identified_formula_unverified')
    && projection.identity.state === 'known' ? projection.identity.value : null;
  return {
    ownerId, caseId: snapshot.resolutionCaseId, snapshotId: snapshot.snapshotId,
    caseRevision: snapshot.caseRevision,
    productId: identity?.productId ?? null, variantId: identity?.variantId ?? null,
    formulaVersionId: hasVerifiedPackageFormula(snapshot) ? snapshot.formula!.formulaVersionId : null,
  };
}

function requestedEvidenceFor(snapshot: ProductTruthSnapshotV1, binding: SheetBinding,
  result: ProductResolutionResult | null | undefined): RequestedEvidenceAction | null {
  if (!result || snapshot.nextRequiredEvidence !== 'ingredients'
    || result.caseId !== snapshot.resolutionCaseId || result.state !== snapshot.state
    || result.nextAction !== 'photograph_ingredients' || !binding.productId
    || result.product?.productId !== binding.productId
    || (result.product.variantId ?? null) !== binding.variantId) return null;
  return { kind: 'add_requested_evidence', role: 'ingredients', binding };
}

export function buildScanResultSheet(input: SheetInput): SheetModel {
  if (input.kind === 'loading') return { kind: 'loading', title: 'Checking product', detail: 'Checking available evidence.', ownerId: input.ownerId, scanId: input.scanId };
  if (input.kind === 'error') return { kind: 'error', title: 'Could not check', detail: 'Try again or search by name.', ownerId: input.ownerId, scanId: input.scanId };

  if (input.kind === 'unknown') return { kind: 'unknown', title: 'No verified barcode match', detail: 'Product and formula are unverified. Search the exact name or photograph the package.', ownerId: input.ownerId, scanId: input.scanId };

  const { snapshot } = input;
  const binding = bindingFor(input.ownerId ?? null, snapshot);
  const identity = binding.productId && snapshot.product ? snapshot.product : null;
  const description = describeProductTruth(snapshot);
  const catalogImage = identity && input.catalogProduct?.productId === binding.productId
    ? catalogImagePresentation(input.catalogProduct.imageUrl)
    : { kind: 'placeholder' } as const;
  const image = catalogImage.kind === 'catalog' ? catalogImage
    : localPhotoPresentation(input.localCustomerPhoto, input.ownerId ?? null, snapshot);
  const title = identity?.name ?? (snapshot.state === 'ambiguous_candidates'
    ? 'Several possible products' : snapshot.state === 'formula_only'
      ? 'Formula clue found' : 'Product not confirmed');
  const status = hasVerifiedPackageFormula(snapshot) ? 'Exact formula verified'
    : identity ? 'Formula unverified'
      : snapshot.state === 'formula_only' ? 'Product unconfirmed'
        : snapshot.state === 'ambiguous_candidates' ? 'Choose a match' : 'More evidence needed';
  return {
    kind: 'result', title, brand: identity?.brand ?? null, status,
    detail: description.detail, nextAction: description.nextAction,
    image, binding, personalFit: null,
    requestedEvidence: requestedEvidenceFor(snapshot, binding, input.resolverResult),
  };
}

/** Recheck immediately before opening details; a previous scan must never act on a new case. */
export function isCurrentSheetBinding(binding: SheetBinding, ownerId: string | null, snapshot: ProductTruthSnapshotV1): boolean {
  const current = bindingFor(ownerId, snapshot);
  return Object.keys(current).every((key) => current[key as keyof SheetBinding] === binding[key as keyof SheetBinding]);
}

/** The host checks again against its current resolver result before presenting capture. */
export function isCurrentRequestedEvidenceAction(action: RequestedEvidenceAction, ownerId: string | null,
  snapshot: ProductTruthSnapshotV1, resolverResult: ProductResolutionResult | null): boolean {
  return action.kind === 'add_requested_evidence' && action.role === 'ingredients'
    && isCurrentSheetBinding(action.binding, ownerId, snapshot)
    && requestedEvidenceFor(snapshot, action.binding, resolverResult)?.role === action.role;
}

/** Hide a stale card before render, not only when its detail button is pressed. */
export function selectCurrentSheetModel(model: SheetModel | null, ownerId: string | null,
  snapshot: ProductTruthSnapshotV1 | null, scanId: string): SheetModel | null {
  if (!model) return null;
  if (model.kind !== 'result') return model.ownerId === ownerId && model.scanId.length > 0
    && model.scanId === scanId && !snapshot ? model : null;
  return snapshot && isCurrentSheetBinding(model.binding, ownerId, snapshot) ? model : null;
}

/** Expanded text scrolls within this cap instead of covering the camera. */
export function resultSheetDetailMaxHeight(viewportHeight: number): number {
  return Math.max(96, Math.min(320, Math.floor(viewportHeight * 0.42)));
}

/** A missing same-case callback is a capability limitation, not an instruction to collect photos. */
export function resultSheetNextAction(model: Extract<SheetModel, { kind: 'result' }>, canAddRequestedEvidence: boolean): string | null {
  if (canAddRequestedEvidence) return null;
  if (model.requestedEvidence || model.nextAction === 'Photograph the ingredient list') {
    return 'The exact package formula remains unverified.';
  }
  return model.nextAction;
}

/** A different immutable result/request owns a fresh scroll position and disclosure state. */
export function resultSheetPresentationKey(model: SheetModel | null): string {
  if (!model) return 'closed';
  return model.kind === 'result'
    ? JSON.stringify([model.kind, model.binding.ownerId, model.binding.caseId, model.binding.snapshotId, model.binding.caseRevision])
    : JSON.stringify([model.kind, model.ownerId, model.scanId]);
}
