import type { CatalogProductDetail, CatalogProductSummary } from '../contracts/ProductCatalog.ts';
import type { ProductResolutionResult, ResolveProductIdentityInput } from '../contracts/ProductIdentityResolver.ts';
import { ProductCategorySchema } from '../types/schema.ts';
import { supabase } from './supabase.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORMULA_STATES = new Set(['unverified','verified_variant_available','multiple_versions']);
const RESOLUTION_STATES = new Set([
  'verified_product_formula','identified_formula_unverified','ambiguous_candidates',
  'formula_only','insufficient_evidence',
]);

function catalogClient(client?: any): any {
  const selected = client || supabase;
  if (!selected) throw new Error('Product catalog is unavailable');
  return selected;
}
function validSummary(value: any): value is CatalogProductSummary {
  return Boolean(value && typeof value === 'object' && UUID.test(value.productId)
    && typeof value.brand === 'string' && value.brand.trim()
    && typeof value.name === 'string' && value.name.trim()
    && ProductCategorySchema.safeParse(value.category).success
    && value.isCatalogStandard === true
    && Number.isInteger(value.variantCount) && value.variantCount >= 0
    && FORMULA_STATES.has(value.formulaState)
    && (value.imageUrl === null || (typeof value.imageUrl === 'string' && value.imageUrl.startsWith('https://'))));
}

export async function searchCatalogProducts(query: string, client?: any): Promise<CatalogProductSummary[]> {
  const cleaned = query.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2) return [];
  if (cleaned.length > 80) throw new Error('Product search query is too long');
  const { data, error } = await catalogClient(client).functions.invoke('catalog-products', {
    body: { operation: 'search', query: cleaned, limit: 10 },
  });
  if (error || !Array.isArray(data?.items) || data.items.length > 20 || !data.items.every(validSummary)) {
    throw new Error('Product search is unavailable');
  }
  return data.items;
}

export async function getCatalogProductDetail(productId: string, client?: any): Promise<CatalogProductDetail> {
  if (!UUID.test(productId)) throw new Error('Invalid product identity');
  const { data, error } = await catalogClient(client).functions.invoke('catalog-products', {
    body: { operation: 'detail', productId },
  });
  if (error || !validSummary(data?.product)) throw new Error('Product detail is unavailable');
  const product = data.product as CatalogProductDetail;
  if (product.productId !== productId || !Array.isArray(product.variants)
    || product.variants.length > 30 || typeof product.observedAt !== 'string') {
    throw new Error('Product detail is unavailable');
  }
  for (const variant of product.variants) {
    if (!UUID.test(variant.variantId)
      || !['verified','unverified','multiple_versions'].includes(variant.formulaState)
      || (variant.formulaState === 'verified') !== Boolean(variant.formula)) {
      throw new Error('Product detail is unavailable');
    }
  }
  return product as CatalogProductDetail;
}

export async function resolveCatalogIdentity(
  input: ResolveProductIdentityInput,
  client?: any,
): Promise<ProductResolutionResult> {
  if (!UUID.test(input.requestId) || (input.consumer !== 'scan' && input.consumer !== 'shelf')) {
    throw new Error('Invalid product resolution request');
  }
  const { data, error } = await catalogClient(client).functions.invoke('resolve-product-identity', {
    body: input,
  });
  if (error || !data || !RESOLUTION_STATES.has(data.state)
    || typeof data.caseId !== 'string' || !Array.isArray(data.candidates)
    || (data.product && !UUID.test(data.product.productId))) {
    throw new Error('Product identity could not be confirmed');
  }
  return data as ProductResolutionResult;
}

/** Stable per-attempt UUID; callers may retain it for a response-loss retry. */
export function createCatalogRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
