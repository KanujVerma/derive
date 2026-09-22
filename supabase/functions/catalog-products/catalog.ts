import type {
  CatalogFormulaFacts,
  CatalogProductSummary,
  CatalogRequest,
} from '../../../src/contracts/ProductCatalog.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRUSTED_AUTHORITIES = new Set(['manufacturer', 'gs1', 'founder']);
const VERIFIED_PROVENANCE = new Set(['manufacturer', 'package_label', 'regulator', 'founder_review']);

export function publicSourceReference(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !/^https:\/\//.test(value) || /[?@#]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : null;
  } catch { return null; }
}

export class CatalogRequestError extends Error {
  constructor(message: string) { super(message); this.name = 'CatalogRequestError'; }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogRequestError('A JSON object is required');
  return value as Record<string, unknown>;
}
function onlyFields(body: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new CatalogRequestError('Unexpected catalog request field');
}

export function parseCatalogRequest(value: unknown): CatalogRequest {
  const body = record(value);
  if (body.operation === 'search') {
    onlyFields(body, ['operation','query','limit']);
    if (typeof body.query !== 'string' || body.query.length > 80 || /[\x00-\x1f\x7f]/.test(body.query)) {
      throw new CatalogRequestError('Search query is invalid');
    }
    const query = body.query.trim().replace(/\s+/g,' ');
    if (body.limit !== undefined && (!Number.isInteger(body.limit) || Number(body.limit) < 1)) {
      throw new CatalogRequestError('Search limit is invalid');
    }
    return { operation: 'search', query: query.length < 2 ? '' : query, limit: Math.min(Number(body.limit ?? 10), 20) };
  }
  if (body.operation === 'detail') {
    onlyFields(body, ['operation','productId','variantId']);
    if (typeof body.productId !== 'string' || !UUID.test(body.productId)) {
      throw new CatalogRequestError('Product ID is invalid');
    }
    if (body.variantId !== undefined && (typeof body.variantId !== 'string' || !UUID.test(body.variantId))) {
      throw new CatalogRequestError('Variant ID is invalid');
    }
    return { operation: 'detail', productId: body.productId, ...(body.variantId ? { variantId: body.variantId } : {}) };
  }
  throw new CatalogRequestError('Catalog operation is invalid');
}

export function projectCatalogSummary(row: Record<string, unknown>): CatalogProductSummary {
  if (row.is_catalog_standard === false) throw new CatalogRequestError('Product is not catalog-backed');
  const image = null; // Legacy image_url has no customer-public provenance.
  const state = row.formula_state === 'verified_variant_available' || row.formula_state === 'multiple_versions'
    ? row.formula_state : 'unverified';
  return {
    productId: String(row.product_id), brand: String(row.brand), name: String(row.name),
    category: String(row.category), imageUrl: image, isCatalogStandard: true,
    variantCount: Math.max(0, Number(row.variant_count) || 0), formulaState: state,
  };
}

type FormulaRow = {
  id: string;
  variant_id: string | null;
  ingredients: string[];
  provenance_type: string;
  source_reference: string;
  catalog_public_source_url?: string | null;
  observed_at: string;
  verification_status: string;
};
type IdentifierRow = {
  variant_id: string;
  formula_version_id: string | null;
  source_authority: string;
  verified_at: string | null;
};

/** Display only a uniquely linked S6-verified formula for the chosen variant. */
export function resolveCatalogFormula(
  variantId: string,
  formulas: FormulaRow[],
  identifiers: IdentifierRow[],
): { state: 'verified'; formula: CatalogFormulaFacts } | { state: 'unverified' | 'multiple_versions' } {
  const linked = new Set(identifiers.filter((identifier) =>
    identifier.variant_id === variantId && identifier.verified_at
      && TRUSTED_AUTHORITIES.has(identifier.source_authority) && identifier.formula_version_id
  ).map((identifier) => identifier.formula_version_id));
  const matches = formulas.filter((formula) =>
    formula.variant_id === variantId && linked.has(formula.id)
      && formula.verification_status === 'verified'
      && VERIFIED_PROVENANCE.has(formula.provenance_type)
      && Boolean(formula.source_reference && formula.observed_at)
      && Array.isArray(formula.ingredients) && formula.ingredients.length > 0
  );
  const unique = [...new Map(matches.map((formula) => [formula.id, formula])).values()];
  if (unique.length > 1) return { state: 'multiple_versions' };
  if (unique.length === 0) return { state: 'unverified' };
  const formula = unique[0];
  return {
    state: 'verified',
    formula: {
      formulaVersionId: formula.id, ingredients: [...formula.ingredients],
      provenanceType: formula.provenance_type as CatalogFormulaFacts['provenanceType'],
      sourceReference: publicSourceReference(formula.catalog_public_source_url), observedAt: formula.observed_at,
    },
  };
}
