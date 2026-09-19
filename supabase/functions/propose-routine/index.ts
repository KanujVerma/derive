// Supabase Edge Function: propose-routine
// DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { MembershipEntitlementError, requireActiveMembership } from "../_shared/entitlement.ts";

import type {
  RoutineErrorCode,
  RoutineErrorResponse,
  RoutineIntelligenceProposal,
} from './types.ts';
import {
  formatRoutineStepScheduleText,
  validateRoutineProposal,
  validateSensitivities,
  type TrustedProductInfo,
} from './validator.ts';
import { assembleCanonicalContext } from './context.ts';
import { resolveRoutineProvider } from './provider.ts';

// Section 10: x-routine-fixture completely removed from CORS and request inspection
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(code: RoutineErrorCode, message: string, status = 400): Response {
  const body: RoutineErrorResponse = { code, error: message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hydrateUserProducts(rows: any[], userId: string): { ok: true; value: any[] } | { ok: false } {
  const value: any[] = [];
  for (const row of rows) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!row.product_id || !product?.id) return { ok: false };
    value.push({
      id: row.id,
      userId,
      productId: row.product_id,
      action: row.action,
      actionReason: row.action_reason || "",
      frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
      isConfirmedByUser: row.is_confirmed_by_user === true,
      product: {
        id: product.id,
        brand: product.brand,
        name: product.name,
        category: product.category,
        keyActives: product.key_actives || [],
        fullIngredients: product.full_ingredients || [],
        retailPriceApprox: product.retail_price_approx == null
          ? undefined
          : Number(product.retail_price_approx),
      },
    });
  }
  return { ok: true, value };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("INTERNAL_ERROR", "Method not allowed.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Authenticate caller from JWT (handler-level defense in depth)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return errorResponse("UNAUTHORIZED", "Invalid or expired session token", 401);
    }

    const userId = user.id;

    // Service-role client for verified data pipeline execution
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    try {
      await requireActiveMembership(adminClient, userId);
    } catch (error) {
      if (error instanceof MembershipEntitlementError) {
        return errorResponse(error.code, error.message, error.status);
      }
      throw error;
    }

    // 2. Fail closed unless customer has committed onboarding intake
    const { data: submission, error: subErr } = await adminClient
      .from("onboarding_submissions")
      .select("id, status, payload_snapshot")
      .eq("user_id", userId)
      .eq("status", "committed")
      .maybeSingle();

    if (subErr) {
      console.error(`[propose-routine] Error querying onboarding_submissions: ${subErr.message}`);
      return errorResponse("INTERNAL_ERROR", "Failed to verify onboarding intake status.", 500);
    }

    if (!submission) {
      return errorResponse(
        "INTAKE_NOT_COMMITTED",
        "Please complete and submit your onboarding intake before requesting a routine.",
        400
      );
    }

    // 3. Replay Idempotency: if version-1 routine already exists, assemble and return it directly
    const { data: existingRoutine } = await adminClient
      .from("routines")
      .select("id, version, status, summary_sentence, created_at, updated_at, published_at")
      .eq("user_id", userId)
      .eq("version", 1)
      .maybeSingle();

    if (existingRoutine) {
      const { data: items, error: itemsError } = await adminClient
        .from("routine_items")
        .select("*")
        .eq("routine_id", existingRoutine.id)
        .order("order_index", { ascending: true });

      const { data: upRows, error: userProductsError } = await adminClient
        .from("user_products")
        .select("id, product_id, action, action_reason, frequency_nights_per_week, is_confirmed_by_user, products(id, brand, name, category, key_actives, full_ingredients, retail_price_approx)")
        .eq("user_id", userId);

      const amSteps = (items || [])
        .filter((i: any) => i.timing === "am")
        .map((item: any) => ({
          order: item.order_index,
          timing: "am" as const,
          productId: item.product_id,
          productName: item.product_name,
          brand: item.brand,
          category: item.category,
          amount: item.amount,
          area: item.area,
          days: item.days || [],
          purpose: item.purpose,
          whyChosen: item.why_chosen,
          watchFor: item.watch_for || undefined,
          scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
        }));

      const pmSteps = (items || [])
        .filter((i: any) => i.timing === "pm")
        .map((item: any) => ({
          order: item.order_index,
          timing: "pm" as const,
          productId: item.product_id,
          productName: item.product_name,
          brand: item.brand,
          category: item.category,
          amount: item.amount,
          area: item.area,
          days: item.days || [],
          purpose: item.purpose,
          whyChosen: item.why_chosen,
          watchFor: item.watch_for || undefined,
          scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
        }));

      const hydratedProducts = hydrateUserProducts(upRows || [], userId);
      if (itemsError || userProductsError || !hydratedProducts.ok) {
        console.error("[propose-routine] Existing routine hydration failed");
        return errorResponse("INTERNAL_ERROR", "Existing routine could not be loaded.", 500);
      }
      const userProducts = hydratedProducts.value;

      return new Response(
        JSON.stringify({
          routine: {
            id: existingRoutine.id,
            userId,
            version: existingRoutine.version,
            status: existingRoutine.status,
            summarySentence: existingRoutine.summary_sentence,
            amSteps,
            pmSteps,
            createdAt: existingRoutine.created_at,
            updatedAt: existingRoutine.updated_at || existingRoutine.created_at,
            publishedAt: existingRoutine.published_at || undefined,
          },
          userProducts,
          clarificationQuestions: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Assemble canonical context & fail closed on invalid or missing data
    const { data: skinProfile } = await adminClient
      .from("skin_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const assemblyResult = assembleCanonicalContext(skinProfile, submission.payload_snapshot);
    if (!assemblyResult.valid || !assemblyResult.context) {
      return errorResponse(
        "INTAKE_CONTEXT_INVALID",
        assemblyResult.error || "Committed intake contains invalid clinical profile data.",
        400
      );
    }

    const context = assemblyResult.context;

    // 5. Resolve Provider-Neutral Routine Intelligence Provider
    // Selection is strictly server-side runtime configuration. Customer requests cannot select a provider.
    const provider = await resolveRoutineProvider(adminClient);
    if (!provider) {
      console.error("[propose-routine] No model provider configured (ROUTINE_MODEL_PROVIDER is unset)");
      return errorResponse(
        "MODEL_UNAVAILABLE",
        "Routine intelligence service is temporarily unavailable.",
        503
      );
    }

    let proposal: RoutineIntelligenceProposal;
    try {
      proposal = await provider.generateProposal(context);
    } catch (provErr: any) {
      console.error(`[propose-routine] Provider '${provider.providerId}' execution failed: ${provErr?.message}`);
      if (provErr?.code === "MODEL_OUTPUT_INVALID") {
        return errorResponse(
          "MODEL_OUTPUT_INVALID",
          "Routine intelligence returned an invalid response structure.",
          502
        );
      }
      return errorResponse(
        "MODEL_UNAVAILABLE",
        "Routine intelligence service is temporarily unavailable.",
        503
      );
    }

    // 6. Check for Clarification Questions
    if (proposal.clarificationQuestions && proposal.clarificationQuestions.length > 0) {
      return new Response(
        JSON.stringify({
          code: "CLARIFICATION_REQUIRED",
          error: "Additional clinical clarification is required before formulating your routine.",
          clarificationQuestions: proposal.clarificationQuestions,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Deterministic Safety & Clinical Invariant Validation
    const validation = validateRoutineProposal(proposal, context);
    if (!validation.valid) {
      console.error(`[propose-routine] Validation failed: ${validation.errors.join("; ")}`);
      return errorResponse(
        "VALIDATION_FAILED",
        "Generated routine proposal did not satisfy clinical safety criteria.",
        422
      );
    }

    // 8. Catalog Provenance & Sensitivity Evaluation against Trusted Database Records
    const { data: dbCatalogRows, error: catErr } = await adminClient
      .from("products")
      .select("id, brand, name, category, key_actives, full_ingredients, retail_price_approx, is_catalog_standard");

    if (catErr) {
      console.error(`[propose-routine] Failed reading products catalog: ${catErr.message}`);
      return errorResponse("INTERNAL_ERROR", "Failed to verify catalog products.", 500);
    }

    const trustedMap = new Map<string, TrustedProductInfo>();
    for (const p of dbCatalogRows || []) {
      const key = `${p.brand.trim().toLowerCase()}::${p.name.trim().toLowerCase()}`;
      trustedMap.set(key, {
        brand: p.brand,
        name: p.name,
        category: p.category,
        isCatalogStandard: p.is_catalog_standard === true,
        fullIngredients: Array.isArray(p.full_ingredients) ? p.full_ingredients : [],
        keyActives: Array.isArray(p.key_actives) ? p.key_actives : [],
      });
    }

    // Section 21: Reported Sensitivities Verification
    const sensValidation = validateSensitivities(proposal, context, trustedMap);
    if (!sensValidation.valid) {
      console.error(`[propose-routine] Sensitivity validation failed: ${sensValidation.errors.join("; ")}`);
      return errorResponse(
        "VALIDATION_FAILED",
        `Routine validation failed: ${sensValidation.errors.join("; ")}`,
        422
      );
    }

    // 9. Prepare Catalog Products Payload with Provenance Protection
    // Section 18 & 19: Trusted catalog rows cannot be overwritten; new proposed products are non-catalog-standard
    const catalogProductsPayload = proposal.catalogProducts.map((cp: any) => {
      const key = `${cp.brand.trim().toLowerCase()}::${cp.name.trim().toLowerCase()}`;
      const trusted = trustedMap.get(key);

      if (trusted && trusted.isCatalogStandard) {
        return {
          brand: trusted.brand,
          name: trusted.name,
          category: trusted.category,
          key_actives: trusted.keyActives,
          full_ingredients: trusted.fullIngredients,
          is_catalog_standard: true,
        };
      }

      // New or unverified product proposal: persist minimal identity for review; do not promote model inference to catalog truth
      return {
        brand: cp.brand.trim(),
        name: cp.name.trim(),
        category: cp.category,
        key_actives: [],
        full_ingredients: [],
        retail_price_approx: null,
        is_catalog_standard: false,
      };
    });

    // 10. Prepare User Products Payload with Provenance Preservation
    // Section 22 & 23: Onboarding-confirmed shelf products retain is_confirmed_by_user = true across action updates.
    // New provider-proposed additions are is_confirmed_by_user = false.
    const confirmedShelfKeys = new Set(
      context.confirmedProducts.map((p) => `${p.brand.trim().toLowerCase()}::${p.name.trim().toLowerCase()}`)
    );

    const userProductsPayload = proposal.productDecisions.map((d: any) => {
      const brand = (d.brand || '').trim();
      const name = (d.productName ?? d.product_name ?? '').trim();
      const key = `${brand.toLowerCase()}::${name.toLowerCase()}`;
      const isConfirmed = confirmedShelfKeys.has(key) && d.action !== 'ADD';

      return {
        detected_brand: brand,
        detected_name: name,
        action: d.action,
        action_reason: d.actionReason ?? d.action_reason,
        frequency_nights_per_week: d.frequencyNightsPerWeek ?? d.frequency_nights_per_week,
        is_confirmed_by_user: isConfirmed,
      };
    });

    // 11. Prepare Routine Items Payload
    const routineItemsPayload = [
      ...proposal.amSteps.map((s: any) => ({
        order_index: s.order_index ?? s.order,
        timing: "am",
        product_name: s.product_name ?? s.productName,
        brand: s.brand,
        category: s.category,
        amount: s.amount,
        area: s.area,
        days: s.days || [],
        purpose: s.purpose,
        why_chosen: s.why_chosen ?? s.whyChosen,
        watch_for: s.watch_for ?? s.watchFor,
      })),
      ...proposal.pmSteps.map((s: any) => ({
        order_index: s.order_index ?? s.order,
        timing: "pm",
        product_name: s.product_name ?? s.productName,
        brand: s.brand,
        category: s.category,
        amount: s.amount,
        area: s.area,
        days: s.days || [],
        purpose: s.purpose,
        why_chosen: s.why_chosen ?? s.whyChosen,
        watch_for: s.watch_for ?? s.watchFor,
      })),
    ];

    // 12. Execute Atomic Relational Persistence RPC
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc("commit_routine_proposal", {
      p_user_id: userId,
      p_version: 1,
      p_summary_sentence: proposal.summarySentence,
      p_founder_notes: null,
      p_products: catalogProductsPayload,
      p_routine_items: routineItemsPayload,
      p_user_products: userProductsPayload,
      p_task_notes: "Initial routine generated (v1). Awaiting founder review.",
    });

    if (rpcErr || !rpcResult) {
      console.error(`[propose-routine] commit_routine_proposal RPC failed: ${rpcErr?.message}`);
      return errorResponse(
        "PERSISTENCE_FAILED",
        "Failed to persist routine proposal. Please try again.",
        500
      );
    }

    const routineId = rpcResult.routine_id;

    // 13. Read back persisted canonical structure
    const { data: routineRow, error: routineReadError } = await adminClient
      .from("routines")
      .select("id, user_id, version, status, summary_sentence, created_at, updated_at, published_at")
      .eq("id", routineId)
      .single();

    const { data: items, error: itemsReadError } = await adminClient
      .from("routine_items")
      .select("*")
      .eq("routine_id", routineId)
      .order("order_index", { ascending: true });

    const { data: upRows, error: userProductsReadError } = await adminClient
      .from("user_products")
      .select("id, product_id, action, action_reason, frequency_nights_per_week, is_confirmed_by_user, products(id, brand, name, category, key_actives, full_ingredients, retail_price_approx)")
      .eq("user_id", userId);

    const amSteps = (items || [])
      .filter((i: any) => i.timing === "am")
      .map((item: any) => ({
        order: item.order_index,
        timing: "am" as const,
        productId: item.product_id,
        productName: item.product_name,
        brand: item.brand,
        category: item.category,
        amount: item.amount,
        area: item.area,
        days: item.days || [],
        purpose: item.purpose,
        whyChosen: item.why_chosen,
        watchFor: item.watch_for || undefined,
        scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
      }));

    const pmSteps = (items || [])
      .filter((i: any) => i.timing === "pm")
      .map((item: any) => ({
        order: item.order_index,
        timing: "pm" as const,
        productId: item.product_id,
        productName: item.product_name,
        brand: item.brand,
        category: item.category,
        amount: item.amount,
        area: item.area,
        days: item.days || [],
        purpose: item.purpose,
        whyChosen: item.why_chosen,
        watchFor: item.watch_for || undefined,
        scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
      }));

    const hydratedProducts = hydrateUserProducts(upRows || [], userId);
    if (
      routineReadError ||
      itemsReadError ||
      userProductsReadError ||
      !routineRow ||
      !hydratedProducts.ok
    ) {
      console.error("[propose-routine] Persisted routine hydration failed");
      return errorResponse("PERSISTENCE_FAILED", "Routine proposal could not be loaded.", 500);
    }
    const userProducts = hydratedProducts.value;

    return new Response(
      JSON.stringify({
        routine: {
          id: routineRow.id,
          userId,
          version: routineRow.version,
          status: routineRow.status,
          summarySentence: routineRow.summary_sentence,
          amSteps,
          pmSteps,
          createdAt: routineRow.created_at,
          updatedAt: routineRow.updated_at || routineRow.created_at,
          publishedAt: routineRow.published_at || undefined,
        },
        userProducts,
        clarificationQuestions: [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    // Customer-safe error boundary. Zero internal leakages.
    console.error(`[propose-routine] Internal error: ${err?.message}`);
    return errorResponse("INTERNAL_ERROR", "An unexpected internal error occurred.", 500);
  }
});
