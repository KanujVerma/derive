import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import type { FreeSkinProfile, FreeSkinProfileInput, PersonalFitResult } from "../../../src/contracts/FreePersonalFit.ts";
import { resolveCatalogFormula } from "../catalog-products/catalog.ts";
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from "../_shared/runtime.ts";
import { determinePersonalFit, FitRequestError, parseFreePersonalFitRequest } from "./fit.ts";

const PROFILE_FIELDS = "goals,skin_behavior,reactivity,pregnancy_status,sensitivities_status,known_sensitivities,treatment_status,current_treatments,updated_at";

function projectProfile(row: Record<string, unknown>): FreeSkinProfile {
  return {
    goals: row.goals as FreeSkinProfile['goals'],
    skinBehavior: row.skin_behavior as FreeSkinProfile['skinBehavior'],
    reactivity: row.reactivity as FreeSkinProfile['reactivity'],
    pregnancyStatus: row.pregnancy_status as FreeSkinProfile['pregnancyStatus'],
    sensitivitiesStatus: row.sensitivities_status as FreeSkinProfile['sensitivitiesStatus'],
    knownSensitivities: row.known_sensitivities as string[],
    treatmentStatus: row.treatment_status as FreeSkinProfile['treatmentStatus'],
    currentTreatments: row.current_treatments as FreeSkinProfile['currentTreatments'],
    updatedAt: row.updated_at as string,
  };
}

async function loadProfile(admin: SupabaseClient, userId: string): Promise<FreeSkinProfile | null> {
  const { data, error } = await admin.from('free_skin_profiles').select(PROFILE_FIELDS).eq('user_id', userId).maybeSingle();
  if (error) {
    console.error('free profile read failed:', error.code);
    throw new ServiceError('PROFILE_UNAVAILABLE', 'Skin context is temporarily unavailable', 503);
  }
  return data ? projectProfile(data) : null;
}

async function saveProfile(admin: SupabaseClient, userId: string, profile: FreeSkinProfileInput): Promise<FreeSkinProfile> {
  const { data, error } = await admin.from('free_skin_profiles').upsert({
    user_id: userId,
    goals: profile.goals,
    skin_behavior: profile.skinBehavior,
    reactivity: profile.reactivity,
    pregnancy_status: profile.pregnancyStatus,
    sensitivities_status: profile.sensitivitiesStatus,
    known_sensitivities: profile.knownSensitivities,
    treatment_status: profile.treatmentStatus,
    current_treatments: profile.currentTreatments,
  }, { onConflict: 'user_id' }).select(PROFILE_FIELDS).single();
  if (error || !data) {
    console.error('free profile write failed:', error?.code ?? 'empty');
    throw new ServiceError('PROFILE_UNAVAILABLE', 'Skin context could not be saved', 503);
  }
  return projectProfile(data);
}

async function fit(admin: SupabaseClient, userId: string, productId: string, variantId?: string): Promise<PersonalFitResult> {
  const [profile, productResult] = await Promise.all([
    loadProfile(admin, userId),
    admin.from('products').select('id,category,is_catalog_standard,catalog_verified_at').eq('id', productId).maybeSingle(),
  ]);
  if (productResult.error) throw new ServiceError('CATALOG_UNAVAILABLE', 'Product facts are temporarily unavailable', 503);
  const product = productResult.data;
  if (!product || product.is_catalog_standard !== true || !product.catalog_verified_at) {
    throw new ServiceError('PRODUCT_NOT_FOUND', 'Product was not found in the verified catalog', 404);
  }
  if (!variantId) return determinePersonalFit(profile, {
    productId, variantId: null, formulaVersionId: null, category: product.category, ingredients: null,
  });
  const variantResult = await admin.from('product_variants')
    .select('id,product_id,lifecycle_status,catalog_verification_status')
    .eq('id', variantId).eq('product_id', productId).maybeSingle();
  if (variantResult.error) throw new ServiceError('CATALOG_UNAVAILABLE', 'Product facts are temporarily unavailable', 503);
  const variant = variantResult.data;
  if (!variant || variant.lifecycle_status !== 'active' || variant.catalog_verification_status !== 'verified') {
    throw new ServiceError('VARIANT_NOT_FOUND', 'Verified variant was not found for this product', 404);
  }
  const [formulas, identifiers] = await Promise.all([
    admin.from('product_formula_versions')
      .select('id,variant_id,ingredients,provenance_type,source_reference,catalog_public_source_url,observed_at,verification_status')
      .eq('variant_id', variantId).eq('verification_status', 'verified').limit(101),
    admin.from('product_identifiers')
      .select('variant_id,formula_version_id,source_authority,verified_at')
      .eq('variant_id', variantId).not('verified_at', 'is', null).limit(101),
  ]);
  if (formulas.error || identifiers.error || !formulas.data || !identifiers.data) {
    throw new ServiceError('CATALOG_UNAVAILABLE', 'Product formula facts are temporarily unavailable', 503);
  }
  if (formulas.data.length > 100 || identifiers.data.length > 100) {
    throw new ServiceError('CATALOG_TOO_LARGE', 'Product formula needs review', 503);
  }
  const resolved = resolveCatalogFormula(variantId, formulas.data, identifiers.data);
  return determinePersonalFit(profile, {
    productId, variantId,
    formulaVersionId: resolved.state === 'verified' ? resolved.formula.formulaVersionId : null,
    category: product.category,
    ingredients: resolved.state === 'verified' ? resolved.formula.ingredients : null,
    sourceReference: resolved.state === 'verified' ? resolved.formula.sourceReference : null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const { userId, admin } = await authenticate(req);
    let request;
    try { request = parseFreePersonalFitRequest(await readJsonObject(req)); }
    catch (error) {
      if (error instanceof FitRequestError) throw new ServiceError('INVALID_PAYLOAD', error.message, 400);
      throw error;
    }
    if (request.operation === 'get_profile') return jsonResponse({ profile: await loadProfile(admin, userId) });
    if (request.operation === 'save_profile') return jsonResponse({ profile: await saveProfile(admin, userId, request.profile) });
    return jsonResponse({ fit: await fit(admin, userId, request.productId, request.variantId) });
  } catch (error) { return errorResponse(error); }
});
