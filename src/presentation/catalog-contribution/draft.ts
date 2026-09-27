import { parseCatalogContribution, type CatalogContributionRequest } from '../../domain/catalog-contribution/proposal.ts';

export interface ContributionDraft {
  brand: string;
  name: string;
  gtin: string;
  variant: string;
  packageSize: string;
  region: string;
  evidence: ReadonlyArray<{ evidenceId: string; role: 'front_label' | 'ingredients' | 'packaging' }>;
}

export type ContributionDraftErrors = Partial<Record<keyof ContributionDraft | 'requestId', string>>;
export type PreparedContribution =
  | { kind: 'ready'; request: CatalogContributionRequest }
  | { kind: 'invalid'; errors: ContributionDraftErrors };

export interface ContributionReviewAttempt { fingerprint: string; requestId: string }
export type PreparedContributionReview =
  | { kind: 'ready'; request: CatalogContributionRequest; attempt: ContributionReviewAttempt }
  | { kind: 'invalid'; errors: ContributionDraftErrors };

const VALID_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const FIELD_COPY: Record<Exclude<keyof ContributionDraft, 'evidence'>, string> = {
  brand: 'Check the brand.',
  name: 'Check the product name.',
  gtin: 'Enter a valid barcode number, or leave it blank.',
  variant: 'Check the variant.',
  packageSize: 'Check the package size.',
  region: 'Enter a country code such as US, or leave it blank.',
};

export function createContributionDraft(seed: Partial<ContributionDraft> = {}): ContributionDraft {
  return {
    brand: seed.brand ?? '', name: seed.name ?? '', gtin: seed.gtin ?? '',
    variant: seed.variant ?? '', packageSize: seed.packageSize ?? '', region: seed.region ?? '',
    evidence: seed.evidence?.map(({ evidenceId, role }) => ({ evidenceId, role })) ?? [],
  };
}

function rawProduct(draft: ContributionDraft): CatalogContributionRequest['product'] {
  const product: CatalogContributionRequest['product'] = { brand: draft.brand, name: draft.name };
  for (const key of ['gtin', 'variant', 'packageSize', 'region'] as const) {
    if (draft[key].trim()) product[key] = draft[key];
  }
  return product;
}

function rawRequest(product: CatalogContributionRequest['product'], requestId = VALID_REQUEST_ID,
  evidence?: ContributionDraft['evidence']): CatalogContributionRequest {
  return { version: 1, intent: 'help_add_product', requestId, product,
    ...(evidence?.length ? { evidence } : {}),
  };
}

export function validateContributionDraft(draft: ContributionDraft,
  options: { includePrivateEvidence?: boolean } = {}): ContributionDraftErrors {
  const errors: ContributionDraftErrors = {};
  for (const key of ['brand', 'name', 'gtin', 'variant', 'packageSize', 'region'] as const) {
    const value = draft[key];
    if (!value.trim()) {
      if (key === 'brand') errors.brand = 'Add the brand.';
      if (key === 'name') errors.name = 'Add the product name.';
      continue;
    }
    try {
      parseCatalogContribution(rawRequest({ brand: 'Brand', name: 'Product', [key]: value }));
    } catch {
      errors[key] = FIELD_COPY[key];
    }
  }
  if (options.includePrivateEvidence) {
    try {
      parseCatalogContribution(rawRequest({ brand: 'Brand', name: 'Product' }, VALID_REQUEST_ID, draft.evidence));
    } catch {
      errors.evidence = 'One of the product photos cannot be reused for this request.';
    }
  }
  return errors;
}

export function prepareContributionRequest(draft: ContributionDraft, requestId: string,
  options: { includePrivateEvidence?: boolean } = {}): PreparedContribution {
  const errors = validateContributionDraft(draft, options);
  if (Object.keys(errors).length) return { kind: 'invalid', errors };
  try {
    return { kind: 'ready', request: parseCatalogContribution(rawRequest(rawProduct(draft), requestId,
      options.includePrivateEvidence ? draft.evidence : undefined)) };
  } catch {
    return { kind: 'invalid', errors: { requestId: 'Could not prepare this request. Try again.' } };
  }
}

export function prepareContributionReview(draft: ContributionDraft, previous: ContributionReviewAttempt | null,
  createRequestId: () => string, options: { includePrivateEvidence?: boolean } = {}): PreparedContributionReview {
  const preflight = prepareContributionRequest(draft, VALID_REQUEST_ID, options);
  if (preflight.kind === 'invalid') return preflight;
  const fingerprint = JSON.stringify([preflight.request.product, preflight.request.evidence ?? []]);
  const requestId = previous?.fingerprint === fingerprint ? previous.requestId : createRequestId();
  const prepared = prepareContributionRequest(draft, requestId, options);
  if (prepared.kind === 'invalid') return prepared;
  return { kind: 'ready', request: prepared.request, attempt: { fingerprint, requestId: prepared.request.requestId } };
}
