// Supabase Edge Function: propose-routine
// DERIVE I1-B2 Server-Side Routine Intelligence, Product Normalization & Awaiting-Review Persistence

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatScheduleText(timing: "am" | "pm", days: string[] = []): string {
  if (!days || days.length === 0 || days.length === 7) {
    return timing === "am" ? "Every morning" : "Every evening";
  }
  const dayLabels: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  return days.map((d) => dayLabels[d] || d).join(", ");
}

const RETINOID_TERMS = ["adapalene", "differin", "tretinoin", "retinol", "retinal", "retinoid", "tazarotene", "trifarotene"];
const CONTRAINDICATED_PREGNANCY_TERMS = [...RETINOID_TERMS, "hydroquinone"];

function isRetinoid(name: string, actives: string[] = []): boolean {
  const lower = (name ?? "").toLowerCase();
  if (RETINOID_TERMS.some((term) => lower.includes(term))) return true;
  return (actives || []).some((active) => RETINOID_TERMS.some((term) => (active ?? "").toLowerCase().includes(term)));
}

function isContraindicatedInPregnancy(name: string, actives: string[] = []): boolean {
  const lower = (name ?? "").toLowerCase();
  if (CONTRAINDICATED_PREGNANCY_TERMS.some((term) => lower.includes(term))) return true;
  return (actives || []).some((active) => CONTRAINDICATED_PREGNANCY_TERMS.some((term) => (active ?? "").toLowerCase().includes(term)));
}

function isSunscreen(name: string, category: string): boolean {
  if ((category ?? "").toLowerCase() === "sunscreen") return true;
  const lower = (name ?? "").toLowerCase();
  return lower.includes("sunscreen") || lower.includes("spf");
}

function validateProposal(proposal: any, isPregnant: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!proposal.summarySentence || typeof proposal.summarySentence !== "string" || proposal.summarySentence.trim().length === 0) {
    errors.push("Missing required summarySentence.");
  }

  // Check amSteps
  for (const step of proposal.amSteps || []) {
    const prodName = step.product_name ?? step.productName ?? "";
    const timing = step.timing;
    if (timing !== "am") {
      errors.push(`AM step ${prodName} has timing ${timing}`);
    }
    if (isRetinoid(prodName, step.keyActives || step.key_actives || [])) {
      errors.push(`Retinoid ${prodName} must NOT be in the AM routine.`);
    }
    if (isPregnant && isContraindicatedInPregnancy(prodName, step.keyActives || step.key_actives || [])) {
      errors.push(`Contraindicated active ${prodName} must NOT be in routine during pregnancy.`);
    }
  }

  // Check pmSteps
  for (const step of proposal.pmSteps || []) {
    const prodName = step.product_name ?? step.productName ?? "";
    const cat = step.category ?? "";
    const timing = step.timing;
    if (timing !== "pm") {
      errors.push(`PM step ${prodName} has timing ${timing}`);
    }
    if (isSunscreen(prodName, cat)) {
      errors.push(`Sunscreen ${prodName} cannot be in the PM routine.`);
    }
    if (isPregnant && isContraindicatedInPregnancy(prodName, step.keyActives || step.key_actives || [])) {
      errors.push(`Contraindicated active ${prodName} must NOT be in routine during pregnancy.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function generateContextGroundedProposal(
  context: {
    userId: string;
    primaryGoal: string;
    secondaryGoals: string[];
    routineComplexity: string;
    middayFeel: string;
    postCleanseTightness: boolean;
    isPregnantOrNursing: boolean;
    pregnancyStatus: string;
    confirmedProducts: Array<{ brand: string; name: string; category?: string; keyActives?: string[] }>;
    pihTendencyAnswer?: string;
  }
) {
  const isPregnant = context.isPregnantOrNursing || context.pregnancyStatus === "yes";
  const hasPih = context.pihTendencyAnswer === "Often" || context.pihTendencyAnswer === "Sometimes";

  const productDecisions: any[] = [];
  const catalogProducts: any[] = [];
  const amSteps: any[] = [];
  const pmSteps: any[] = [];

  let userCleanser: any = null;
  let userMoisturizer: any = null;
  let userSunscreen: any = null;
  let userRetinoid: any = null;

  for (const p of context.confirmedProducts) {
    const lowerName = (p.name ?? "").toLowerCase();
    const cat = p.category || "other";
    const isActRet = isRetinoid(p.name, p.keyActives || []);

    let action = "KEEP";
    let actionReason = "Keep. Compatible with baseline skin barrier.";
    let frequency = 7;

    if (isActRet) {
      if (isPregnant) {
        action = "PAUSE";
        actionReason = "Pause during pregnancy and nursing. Topical retinoids are clinically contraindicated.";
        frequency = 0;
      } else {
        action = "KEEP";
        actionReason = "Keep at 3 nights/week. Scheduled with built-in recovery nights.";
        frequency = 3;
        userRetinoid = {
          brand: p.brand,
          name: p.name,
          category: "treatment",
          keyActives: p.keyActives || ["Adapalene"],
        };
      }
    } else if (lowerName.includes("scrub") || lowerName.includes("harsh")) {
      action = "PAUSE";
      actionReason = "Pause physical scrub to protect skin barrier from micro-tears.";
      frequency = 0;
    } else if (lowerName.includes("astringent") || lowerName.includes("denat")) {
      action = "STOP";
      actionReason = "Discontinue drying astringents to preserve natural lipid barrier.";
      frequency = 0;
    } else if (cat === "cleanser" || lowerName.includes("cleanser") || lowerName.includes("wash")) {
      action = "KEEP";
      actionReason = "Keep. Gentle cleanser that supports natural barrier lipids.";
      frequency = 7;
      if (!userCleanser) userCleanser = { brand: p.brand, name: p.name, category: "cleanser", keyActives: p.keyActives || ["Ceramides"] };
    } else if (cat === "moisturizer" || lowerName.includes("moistur") || lowerName.includes("cream")) {
      action = "KEEP";
      actionReason = "Keep. Restores barrier hydration without pore congestion.";
      frequency = 7;
      if (!userMoisturizer) userMoisturizer = { brand: p.brand, name: p.name, category: "moisturizer", keyActives: p.keyActives || ["Ceramides", "Glycerin"] };
    } else if (cat === "sunscreen" || isSunscreen(p.name, cat)) {
      action = "KEEP";
      actionReason = "Keep every morning. Essential daily photoprotection.";
      frequency = 7;
      if (!userSunscreen) userSunscreen = { brand: p.brand, name: p.name, category: "sunscreen", keyActives: p.keyActives || ["Zinc Oxide"] };
    }

    productDecisions.push({
      productName: p.name,
      brand: p.brand,
      category: cat,
      action,
      actionReason,
      frequencyNightsPerWeek: frequency,
    });
  }

  // Canonical baseline products if missing
  const effectiveCleanser = userCleanser || {
    brand: "Vanicream",
    name: "Gentle Facial Cleanser",
    category: "cleanser",
    keyActives: ["Glycerin", "Purified Water"],
  };
  if (!userCleanser) {
    productDecisions.push({
      productName: effectiveCleanser.name,
      brand: effectiveCleanser.brand,
      category: "cleanser",
      action: "ADD",
      actionReason: "Add gentle fragrance-free cleanser to maintain barrier lipids.",
      frequencyNightsPerWeek: 7,
    });
  }

  const effectiveMoisturizer = userMoisturizer || {
    brand: "La Roche-Posay",
    name: "Toleriane Double Repair Face Moisturizer",
    category: "moisturizer",
    keyActives: ["Ceramides", "Niacinamide", "Glycerin"],
  };
  if (!userMoisturizer) {
    productDecisions.push({
      productName: effectiveMoisturizer.name,
      brand: effectiveMoisturizer.brand,
      category: "moisturizer",
      action: "ADD",
      actionReason: "Add barrier-restorative moisturizer to balance trans-epidermal water loss.",
      frequencyNightsPerWeek: 7,
    });
  }

  const effectiveSunscreen = userSunscreen || {
    brand: "EltaMD",
    name: "UV Clear Broad-Spectrum SPF 46",
    category: "sunscreen",
    keyActives: ["Zinc Oxide", "Niacinamide"],
  };
  if (!userSunscreen) {
    productDecisions.push({
      productName: effectiveSunscreen.name,
      brand: effectiveSunscreen.brand,
      category: "sunscreen",
      action: "ADD",
      actionReason: "Add broad-spectrum daily SPF to prevent UV-mediated barrier breakdown.",
      frequencyNightsPerWeek: 7,
    });
  }

  const addCatalog = (prod: any) => {
    const b = (prod.brand ?? "").toLowerCase();
    const n = (prod.name ?? "").toLowerCase();
    if (!catalogProducts.some((c) => (c.brand ?? "").toLowerCase() === b && (c.name ?? "").toLowerCase() === n)) {
      catalogProducts.push({
        brand: prod.brand,
        name: prod.name,
        category: prod.category,
        key_actives: prod.keyActives || [],
        full_ingredients: prod.keyActives || [],
        is_catalog_standard: true,
      });
    }
  };

  addCatalog(effectiveCleanser);
  addCatalog(effectiveMoisturizer);
  addCatalog(effectiveSunscreen);

  let amOrder = 1;
  amSteps.push({
    order_index: amOrder++,
    timing: "am",
    product_name: effectiveCleanser.name,
    brand: effectiveCleanser.brand,
    category: effectiveCleanser.category,
    amount: "1-2 pumps",
    area: "Entire face with lukewarm water",
    days: [],
    purpose: "Cleanse",
    why_chosen: context.postCleanseTightness
      ? "Gentle cleanse formulated to remove overnight impurities without exacerbating post-wash tightness."
      : "Preps facial barrier for morning defense without stripping essential epidermal lipids.",
  });

  amSteps.push({
    order_index: amOrder++,
    timing: "am",
    product_name: effectiveMoisturizer.name,
    brand: effectiveMoisturizer.brand,
    category: effectiveMoisturizer.category,
    amount: "Dime-sized amount",
    area: "Entire face & neck",
    days: [],
    purpose: "Hydrate & Seal",
    why_chosen: `Formulated to support ${context.primaryGoal.replace(/_/g, " ")} while keeping midday feel ${context.middayFeel}.`,
  });

  amSteps.push({
    order_index: amOrder++,
    timing: "am",
    product_name: effectiveSunscreen.name,
    brand: effectiveSunscreen.brand,
    category: effectiveSunscreen.category,
    amount: "Two finger lengths (1/4 tsp)",
    area: "Entire face, ears, and neck",
    days: [],
    purpose: "UV Protection",
    why_chosen: hasPih
      ? "Critical photoprotection to stop reactive melanin synthesis and prevent blemish marks from deepening."
      : "Broad-spectrum daily defense against cellular UVA/UVB barrier damage.",
  });

  let pmOrder = 1;
  pmSteps.push({
    order_index: pmOrder++,
    timing: "pm",
    product_name: effectiveCleanser.name,
    brand: effectiveCleanser.brand,
    category: effectiveCleanser.category,
    amount: "1-2 pumps",
    area: "Entire face with lukewarm water",
    days: [],
    purpose: "Evening Cleanse",
    why_chosen: "Dissolves daily sunscreen, environmental particulates, and excess sebum.",
  });

  if (!isPregnant && userRetinoid) {
    addCatalog(userRetinoid);
    pmSteps.push({
      order_index: pmOrder++,
      timing: "pm",
      product_name: userRetinoid.name,
      brand: userRetinoid.brand,
      category: "treatment",
      amount: "Pea-sized amount",
      area: "Entire face avoiding eye contours and mouth corners",
      days: ["mon", "wed", "fri"],
      purpose: "Targeted Cellular Renewal",
      why_chosen: "Scheduled 3 nights/week to balance cellular turnover with recovery nights.",
      watch_for: "Mild dryness or flaking during acclimation. Buffer with moisturizer if needed.",
    });
  }

  pmSteps.push({
    order_index: pmOrder++,
    timing: "pm",
    product_name: effectiveMoisturizer.name,
    brand: effectiveMoisturizer.brand,
    category: effectiveMoisturizer.category,
    amount: "Nickel-sized amount",
    area: "Entire face & neck",
    days: [],
    purpose: "Barrier Recovery",
    why_chosen: "Overnight lipid replenishment to reinforce barrier recovery during sleep.",
  });

  const summarySentence = isPregnant
    ? `Pregnancy-safe barrier-supportive routine focused on ${context.primaryGoal.replace(/_/g, " ")} with gentle hydration and daily UV defense.`
    : userRetinoid
    ? `Targeted 3-night active routine balancing cellular renewal with barrier protection for ${context.primaryGoal.replace(/_/g, " ")}.`
    : `Balanced barrier-stabilizing routine designed for ${context.primaryGoal.replace(/_/g, " ")} and ${context.middayFeel} skin comfort.`;

  return {
    summarySentence,
    productDecisions,
    amSteps,
    pmSteps,
    catalogProducts,
  };
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
      return errorResponse("INTAKE_NOT_COMMITTED", "Cannot generate routine proposal: onboarding intake has not been committed.", 400);
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
          scheduleText: formatScheduleText(item.timing, item.days),
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
          scheduleText: formatScheduleText(item.timing, item.days),
        }));

      const userProducts = (upRows || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        productId: row.product_id || "",
        action: row.action,
        actionReason: row.action_reason || "",
        frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
        isConfirmedByUser: row.is_confirmed_by_user ?? true,
        product: row.products
          ? {
              id: row.products.id,
              brand: row.products.brand,
              name: row.products.name,
              category: row.products.category,
              keyActives: row.products.key_actives || [],
              fullIngredients: row.products.full_ingredients || [],
              retailPriceApprox: row.products.retail_price_approx ? Number(row.products.retail_price_approx) : undefined,
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
            founderNotes: existingRoutine.founder_notes || undefined,
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

    // 4. Assemble canonical context
    const { data: skinProfile } = await adminClient
      .from("skin_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const payload = submission.payload_snapshot || {};
    const safety = payload.safetyContext || {};
    const isPregnant = skinProfile?.is_pregnant_or_nursing === true || safety.isPregnantOrNursing === true || skinProfile?.pregnancy_status === "yes";

    const context = {
      userId,
      primaryGoal: skinProfile?.primary_goal || payload.primaryGoal || "barrier_health",
      secondaryGoals: skinProfile?.secondary_goals || payload.secondaryGoals || [],
      routineComplexity: skinProfile?.routine_complexity || payload.routineComplexity || "essential",
      middayFeel: skinProfile?.midday_feel || payload.middayFeel || "comfortable",
      postCleanseTightness: skinProfile?.post_cleanse_tightness ?? payload.postCleanseTightness ?? false,
      isPregnantOrNursing: isPregnant,
      pregnancyStatus: skinProfile?.pregnancy_status || safety.pregnancyStatus || (isPregnant ? "yes" : "unanswered"),
      confirmedProducts: (payload.confirmedProducts || []).map((p: any) => ({
        brand: p.brand || p.detectedBrand || "Unknown Brand",
        name: p.name || p.detectedName || p.productName || "Unknown Product",
        category: p.category || "other",
        keyActives: p.keyActives || [],
      })),
      pihTendencyAnswer: payload.pihTendencyAnswer,
    };

    // 5. Intelligence proposal generation
    const proposal = generateContextGroundedProposal(context);

    // 6. Deterministic validation
    const validation = validateProposal(proposal, isPregnant);
    if (!validation.valid) {
      return errorResponse("VALIDATION_FAILED", `Routine validation failed: ${validation.errors.join("; ")}`, 422);
    }

    // 7. Atomic Relational Persistence RPC
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

    const userProductsPayload = proposal.productDecisions.map((d: any) => ({
      detected_brand: d.brand,
      detected_name: d.productName,
      action: d.action,
      action_reason: d.actionReason,
      frequency_nights_per_week: d.frequencyNightsPerWeek,
      is_confirmed_by_user: true,
    }));

    const { data: rpcResult, error: rpcErr } = await adminClient.rpc("commit_routine_proposal", {
      p_user_id: userId,
      p_version: 1,
      p_summary_sentence: proposal.summarySentence,
      p_founder_notes: null,
      p_products: proposal.catalogProducts,
      p_routine_items: routineItemsPayload,
      p_user_products: userProductsPayload,
      p_task_notes: "Initial routine generated (v1). Awaiting founder review.",
    });

    if (rpcErr || !rpcResult) {
      return errorResponse("PERSISTENCE_FAILED", `Failed to persist routine proposal: ${rpcErr?.message || "Empty RPC response"}`, 500);
    }

    const routineId = rpcResult.routine_id;

    // 8. Read back persisted canonical structure
    const { data: routineRow } = await adminClient
      .from("routines")
      .select("*")
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
        scheduleText: formatScheduleText(item.timing, item.days),
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
        scheduleText: formatScheduleText(item.timing, item.days),
      }));

    const userProducts = (upRows || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      productId: row.product_id || "",
      action: row.action,
      actionReason: row.action_reason || "",
      frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
      isConfirmedByUser: row.is_confirmed_by_user ?? true,
      product: row.products
        ? {
            id: row.products.id,
            brand: row.products.brand,
            name: row.products.name,
            category: row.products.category,
            keyActives: row.products.key_actives || [],
            fullIngredients: row.products.full_ingredients || [],
            retailPriceApprox: row.products.retail_price_approx ? Number(row.products.retail_price_approx) : undefined,
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
          founderNotes: routineRow.founder_notes || undefined,
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
    return errorResponse("INTERNAL_ERROR", `propose-routine error: ${err?.message || "Unknown error"} | Stack: ${err?.stack}`, 500);
  }
});
