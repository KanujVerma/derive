import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import {
  ServiceError, authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject,
} from "../_shared/runtime.ts";
import {
  CatalogRequestError, parseCatalogRequest, projectCatalogSummary, publicSourceReference, resolveCatalogFormula,
} from "./catalog.ts";
import type { CatalogProductDetail, CatalogVariantDetail } from "../../../src/contracts/ProductCatalog.ts";

type ProductRow = {
  id: string; brand: string; name: string; category: string;
  is_catalog_standard: boolean; catalog_verified_at: string | null;
  catalog_public_source_url: string | null; catalog_observed_at: string | null;
};
type VariantRow = { id: string; product_id: string; variant_name: string; region_code: string | null; package_size: string | null; catalog_public_source_url: string | null; catalog_observed_at: string | null; catalog_verification_status: 'provisional' | 'verified' };
type FormulaRow = {
  id: string; variant_id: string | null; ingredients: string[]; provenance_type: string;
  source_reference: string; observed_at: string; verification_status: string;
};
type IdentifierRow = { variant_id: string; formula_version_id: string | null; source_authority: string; verified_at: string | null };

async function search(admin: SupabaseClient, query: string, limit: number) {
  if (!query) return { items: [] };
  const { data, error } = await admin.rpc('search_product_catalog', { p_query: query, p_limit: limit });
  if (error) {
    console.error('catalog search query failed:', error.code);
    throw new ServiceError('CATALOG_UNAVAILABLE', 'Product search is temporarily unavailable', 503);
  }
  return { items: (data ?? []).map((row: Record<string, unknown>) => projectCatalogSummary(row)) };
}

async function detail(admin: SupabaseClient, productId: string, variantId?: string): Promise<{ product: CatalogProductDetail }> {
  const { data: product, error: productError } = await admin.from('products')
    .select('id,brand,name,category,is_catalog_standard,catalog_verified_at,catalog_public_source_url,catalog_observed_at')
    .eq('id', productId).maybeSingle();
  if (productError) {
    console.error('catalog detail product query failed:', productError.code);
    throw new ServiceError('CATALOG_UNAVAILABLE', 'Product detail is temporarily unavailable', 503);
  }
  const row = product as ProductRow | null;
  if (!row || row.is_catalog_standard !== true || !row.catalog_verified_at) {
    throw new ServiceError('PRODUCT_NOT_FOUND', 'Product was not found in the catalog', 404);
  }

  const variantsQuery = await admin.from('product_variants')
    .select('id,product_id,variant_name,region_code,package_size,catalog_public_source_url,catalog_observed_at,catalog_verification_status')
    .eq('product_id', productId).eq('lifecycle_status', 'active')
    .order('variant_name').order('id').limit(31);
  if (variantsQuery.error || !variantsQuery.data) {
    console.error('catalog detail variants query failed:', variantsQuery.error?.code ?? 'empty');
    throw new ServiceError('CATALOG_UNAVAILABLE', 'Product detail is temporarily unavailable', 503);
  }
  if (variantsQuery.data.length > 30) throw new ServiceError('CATALOG_TOO_LARGE', 'Product detail requires operator review', 503);
  const allVariants = variantsQuery.data as VariantRow[];
  if (variantId && !allVariants.some((variant) => variant.id === variantId)) {
    throw new ServiceError('VARIANT_NOT_FOUND', 'Variant was not found for this product', 404);
  }
  const ids = allVariants.map((variant) => variant.id);
  let formulas: FormulaRow[] = [];
  let identifiers: IdentifierRow[] = [];
  if (ids.length > 0) {
    const [formulaQuery, identifierQuery] = await Promise.all([
      admin.from('product_formula_versions')
        .select('id,variant_id,ingredients,provenance_type,source_reference,catalog_public_source_url,observed_at,verification_status')
        .in('variant_id', ids).eq('verification_status','verified').limit(101),
      admin.from('product_identifiers')
        .select('variant_id,formula_version_id,source_authority,verified_at')
        .in('variant_id', ids).not('verified_at','is',null).limit(101),
    ]);
    if (formulaQuery.error || identifierQuery.error || !formulaQuery.data || !identifierQuery.data) {
      console.error('catalog detail formula query failed:', formulaQuery.error?.code ?? identifierQuery.error?.code ?? 'empty');
      throw new ServiceError('CATALOG_UNAVAILABLE', 'Product detail is temporarily unavailable', 503);
    }
    if (formulaQuery.data.length > 100 || identifierQuery.data.length > 100) {
      throw new ServiceError('CATALOG_TOO_LARGE', 'Product detail requires operator review', 503);
    }
    formulas = formulaQuery.data as FormulaRow[];
    identifiers = identifierQuery.data as IdentifierRow[];
  }
  const facts = allVariants.map((variant) => ({ variant, resolved: resolveCatalogFormula(variant.id, formulas, identifiers) }));
  const summary = projectCatalogSummary({
    product_id: row.id, brand: row.brand, name: row.name, category: row.category,
    image_url: null, variant_count: allVariants.length,
    formula_state: facts.some((fact) => fact.resolved.state === 'multiple_versions')
      || facts.filter((fact) => fact.resolved.state === 'verified').length > 1
      ? 'multiple_versions'
      : facts.some((fact) => fact.resolved.state === 'verified') ? 'verified_variant_available' : 'unverified',
    is_catalog_standard: row.is_catalog_standard,
  });
  const variants: CatalogVariantDetail[] = facts
    .filter((fact) => !variantId || fact.variant.id === variantId)
    .map(({ variant, resolved }) => ({
      variantId: variant.id, name: variant.variant_name,
      regionCode: variant.region_code, packageSize: variant.package_size,
      sourceReference: publicSourceReference(variant.catalog_public_source_url),
      observedAt: variant.catalog_observed_at, verificationState: variant.catalog_verification_status,
      formulaState: resolved.state,
      ...(resolved.state === 'verified' ? { formula: resolved.formula } : {}),
    }));
  return { product: { ...summary, sourceReference: publicSourceReference(row.catalog_public_source_url), observedAt: row.catalog_observed_at!, variants } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const { admin } = await authenticate(req);
    let request;
    try { request = parseCatalogRequest(await readJsonObject(req)); }
    catch (error) {
      if (error instanceof CatalogRequestError) throw new ServiceError('INVALID_PAYLOAD', error.message, 400);
      throw error;
    }
    return jsonResponse(request.operation === 'search'
      ? await search(admin, request.query, request.limit)
      : await detail(admin, request.productId, request.variantId));
  } catch (error) { return errorResponse(error); }
});
