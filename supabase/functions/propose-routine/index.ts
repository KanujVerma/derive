// Supabase Edge Function: propose-routine
// DERIVE I1-B2.1 Real Model Intelligence, Trust Semantics & Error-Boundary Closure

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

import type {
  RoutineErrorCode,
  RoutineErrorResponse,
  RoutineIntelligenceProposal,
} from './types.ts';
import { formatRoutineStepScheduleText, validateRoutineProposal } from './validator.ts';
import { assembleCanonicalContext } from './context.ts';
import {
  DEFAULT_GEMINI_MODEL,
  callGeminiProposalProvider,
  createDeterministicTestProposal,
} from './gemini-provider.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-routine-fixture",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(code: RoutineErrorCode, message: string, status = 400): Response {
  const body: RoutineErrorResponse = { code, error: message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Verify committed onboarding intake
    const { data: submission, error: subErr } = await adminClient
      .from("onboarding_submissions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "committed")
      .maybeSingle();

    if (subErr || !submission) {
      return errorResponse(
        "INTAKE_NOT_COMMITTED",
        "Cannot generate routine proposal: onboarding intake has not been committed.",
        400
      );
    }

    // 3. Replay Idempotency: Check if version-1 routine ALREADY exists
    const { data: existingRoutine } = await adminClient
      .from("routines")
      .select("*")
      .eq("user_id", userId)
      .eq("version", 1)
      .maybeSingle();

    if (existingRoutine) {
      // Replay existing routine and its items + user_products
      const { data: items } = await adminClient
        .from("routine_items")
        .select("*")
        .eq("routine_id", existingRoutine.id)
        .order("order_index", { ascending: true });

      const { data: upRows } = await adminClient
        .from("user_products")
        .select("*, products(*)")
        .eq("user_id", userId);

      const amSteps = (items || [])
        .filter((item: any) => item.timing === "am")
        .map((item: any) => ({
          id: item.id,
          order: item.order_index,
          productId: item.product_id || "",
          productName: item.product_name,
          brand: item.brand,
          category: item.category,
          amount: item.amount,
          area: item.area,
          timing: item.timing,
          days: item.days || [],
          purpose: item.purpose,
          whyChosen: item.why_chosen,
          watchFor: item.watch_for || undefined,
          scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
        }));

      const pmSteps = (items || [])
        .filter((item: any) => item.timing === "pm")
        .map((item: any) => ({
          id: item.id,
          order: item.order_index,
          productId: item.product_id || "",
          productName: item.product_name,
          brand: item.brand,
          category: item.category,
          amount: item.amount,
          area: item.area,
          timing: item.timing,
          days: item.days || [],
          purpose: item.purpose,
          whyChosen: item.why_chosen,
          watchFor: item.watch_for || undefined,
          scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
        }));

      const userProducts = (upRows || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        productId: row.product_id || "",
        action: row.action,
        actionReason: row.action_reason || "",
        frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
        isConfirmedByUser: row.is_confirmed_by_user ?? false,
        product: row.products
          ? {
              id: row.products.id,
              brand: row.products.brand,
              name: row.products.name,
              category: row.products.category,
              keyActives: row.products.key_actives || [],
              fullIngredients: row.products.full_ingredients || [],
              retailPriceApprox: row.products.retail_price_approx
                ? Number(row.products.retail_price_approx)
                : undefined,
            }
          : {
              id: row.product_id || row.id,
              brand: row.detected_brand || "Unknown",
              name: row.detected_name || "Unknown Product",
              category: "other",
              keyActives: [],
            },
      }));

      return new Response(
        JSON.stringify({
          routine: {
            id: existingRoutine.id,
            userId: existingRoutine.user_id,
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

    // 4. Assemble canonical context & Fail-Closed Validation
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

    // 5. Generate Routine Proposal via Model or Test Seam
    let proposal: RoutineIntelligenceProposal;

    const isFixtureMode =
      req.headers.get("x-routine-fixture") === "true" ||
      Deno.env.get("ROUTINE_FIXTURE_MODE") === "true";

    if (isFixtureMode) {
      proposal = createDeterministicTestProposal(context);
    } else {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) {
        console.error("[propose-routine] Missing GEMINI_API_KEY server secret");
        return errorResponse(
          "MODEL_UNAVAILABLE",
          "Routine intelligence service is temporarily unavailable.",
          503
        );
      }

      const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
      try {
        proposal = await callGeminiProposalProvider(context, apiKey, model);
      } catch (provErr: any) {
        if (provErr.code === "MODEL_OUTPUT_INVALID") {
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

    // 8. Atomic Relational Persistence RPC
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

    // DEFECT D Fix: AI recommendations are proposals, NOT member-confirmed truth.
    // Set is_confirmed_by_user = false for persisted recommendation rows.
    const userProductsPayload = proposal.productDecisions.map((d: any) => ({
      detected_brand: d.brand,
      detected_name: d.productName ?? d.product_name,
      action: d.action,
      action_reason: d.actionReason ?? d.action_reason,
      frequency_nights_per_week: d.frequencyNightsPerWeek ?? d.frequency_nights_per_week,
      is_confirmed_by_user: false,
    }));

    const { data: rpcResult, error: rpcErr } = await adminClient.rpc("commit_routine_proposal", {
      p_user_id: userId,
      p_version: 1,
      p_summary_sentence: proposal.summarySentence,
      p_founder_notes: null,
      p_products: proposal.catalogProducts.map((cp: any) => ({
        brand: cp.brand,
        name: cp.name,
        category: cp.category,
        key_actives: cp.keyActives || cp.key_actives || [],
        full_ingredients: cp.fullIngredients || cp.full_ingredients || [],
        retail_price_approx: cp.retailPriceApprox ?? cp.retail_price_approx,
        is_catalog_standard: cp.isCatalogStandard ?? true,
      })),
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

    // 9. Read back persisted canonical structure
    const { data: routineRow } = await adminClient
      .from("routines")
      .select("id, user_id, version, status, summary_sentence, created_at, updated_at, published_at")
      .eq("id", routineId)
      .single();

    const { data: items } = await adminClient
      .from("routine_items")
      .select("*")
      .eq("routine_id", routineId)
      .order("order_index", { ascending: true });

    const { data: upRows } = await adminClient
      .from("user_products")
      .select("*, products(*)")
      .eq("user_id", userId);

    const amSteps = (items || [])
      .filter((item: any) => item.timing === "am")
      .map((item: any) => ({
        id: item.id,
        order: item.order_index,
        productId: item.product_id || "",
        productName: item.product_name,
        brand: item.brand,
        category: item.category,
        amount: item.amount,
        area: item.area,
        timing: item.timing,
        days: item.days || [],
        purpose: item.purpose,
        whyChosen: item.why_chosen,
        watchFor: item.watch_for || undefined,
        scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
      }));

    const pmSteps = (items || [])
      .filter((item: any) => item.timing === "pm")
      .map((item: any) => ({
        id: item.id,
        order: item.order_index,
        productId: item.product_id || "",
        productName: item.product_name,
        brand: item.brand,
        category: item.category,
        amount: item.amount,
        area: item.area,
        timing: item.timing,
        days: item.days || [],
        purpose: item.purpose,
        whyChosen: item.why_chosen,
        watchFor: item.watch_for || undefined,
        scheduleText: formatRoutineStepScheduleText(item.timing, item.days || []),
      }));

    const userProducts = (upRows || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id || "",
      action: row.action,
      actionReason: row.action_reason || "",
      frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
      isConfirmedByUser: row.is_confirmed_by_user ?? false,
      product: row.products
        ? {
            id: row.products.id,
            brand: row.products.brand,
            name: row.products.name,
            category: row.products.category,
            keyActives: row.products.key_actives || [],
            fullIngredients: row.products.full_ingredients || [],
            retailPriceApprox: row.products.retail_price_approx
              ? Number(row.products.retail_price_approx)
              : undefined,
          }
        : {
            id: row.product_id || row.id,
            brand: row.detected_brand || "Unknown",
            name: row.detected_name || "Unknown Product",
            category: "other",
            keyActives: [],
          },
    }));

    return new Response(
      JSON.stringify({
        routine: {
          id: routineRow.id,
          userId: routineRow.user_id,
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
    // DEFECT E Fix: Customer-safe error boundary. Do NOT leak stacks or provider errors.
    console.error(`[propose-routine] Internal error: ${err?.message}`);
    return errorResponse("INTERNAL_ERROR", "An unexpected internal error occurred.", 500);
  }
});
