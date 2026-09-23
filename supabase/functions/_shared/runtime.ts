import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.39.8";
import type {
  ContextProduct,
  ContextRoutineStep,
  MemberIntelligenceContext,
} from "./intelligence.ts";
import { inferIngredientSignals } from "../../../src/services/ai-workflows/ingredient-intelligence.ts";
import { MembershipEntitlementError, requireActiveMembership } from "./entitlement.ts";
import type {
  FormulaSnapshot,
  IngredientSignal,
  Product,
  ProductReaction,
} from "../../../src/types/schema.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ServiceError) {
    return jsonResponse({ code: error.code, error: error.message }, error.status);
  }
  console.error("intelligence function failed:", error instanceof Error ? error.name : "unknown");
  return jsonResponse({ code: "INTERNAL_ERROR", error: "Derive intelligence is temporarily unavailable" }, 500);
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 200_000) {
    throw new ServiceError("INVALID_PAYLOAD", "Request is too large", 413);
  }
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ServiceError("INVALID_PAYLOAD", "A JSON object is required", 400);
  }
}

export interface AuthenticatedRuntime {
  userId: string;
  user: User;
  admin: SupabaseClient;
}

export async function authenticate(req: Request): Promise<AuthenticatedRuntime> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new ServiceError("UNAUTHORIZED", "Authentication required", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("intelligence server environment is incomplete");
    throw new ServiceError("INTELLIGENCE_UNAVAILABLE", "Derive intelligence is temporarily unavailable", 503);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new ServiceError("UNAUTHORIZED", "Invalid or expired session", 401);

  return {
    userId: user.id,
    user,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function requireMemberEntitlement(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    await requireActiveMembership(admin, userId);
  } catch (error) {
    if (error instanceof MembershipEntitlementError) {
      throw new ServiceError(error.code, error.message, error.status);
    }
    throw error;
  }
}

export async function generateStructuredJson(
  systemInstruction: string,
  prompt: string,
  responseJsonSchema: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  if (!apiKey) {
    throw new ServiceError("INTELLIGENCE_UNAVAILABLE", "Derive intelligence is not configured", 503);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    console.error("invalid GEMINI_MODEL server configuration");
    throw new ServiceError("INTELLIGENCE_UNAVAILABLE", "Derive intelligence is not configured", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.2,
            candidateCount: 1,
            maxOutputTokens: 8_192,
          },
        }),
      },
    );
  } catch (error) {
    console.error("Gemini request failed:", error instanceof Error ? error.name : "unknown");
    throw new ServiceError("MODEL_UNAVAILABLE", "Derive intelligence did not respond", 503);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error("Gemini returned non-success status:", response.status);
    throw new ServiceError("MODEL_UNAVAILABLE", "Derive intelligence did not respond", 503);
  }

  const payload = await response.json() as Record<string, unknown>;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidate = candidates[0] as Record<string, unknown> | undefined;
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = (parts[0] as Record<string, unknown> | undefined)?.text;
  if (typeof text !== "string" || text.length === 0) {
    console.error("Gemini returned no structured candidate");
    throw new ServiceError("MODEL_INVALID_OUTPUT", "Derive could not produce a safe answer", 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error("Gemini structured candidate was not valid JSON");
    throw new ServiceError("MODEL_INVALID_OUTPUT", "Derive could not produce a safe answer", 502);
  }
}

interface LoadedMemberContext {
  context: MemberIntelligenceContext;
  formulaSnapshots: FormulaSnapshot[];
  productReactions: ProductReaction[];
  toleratedProducts: Product[];
}

const safeArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

async function normalizeOnboardingReactionEvidence(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: submission, error } = await admin.from("onboarding_submissions")
    .select("id, payload_snapshot")
    .eq("user_id", userId)
    .eq("status", "committed")
    .maybeSingle();
  if (error) {
    console.error("onboarding reaction context query failed:", error.code);
    throw new ServiceError("CONTEXT_UNAVAILABLE", "Member context could not be loaded", 500);
  }
  if (!submission?.payload_snapshot) return;

  const snapshot = submission.payload_snapshot as Record<string, unknown>;
  const reactions = safeArray<Record<string, unknown>>(snapshot.productReactions);
  const formulas = safeArray<Record<string, unknown>>(snapshot.formulaSnapshots);
  const products = safeArray<Record<string, unknown>>(snapshot.confirmedProducts);
  const productByClientId = new Map(
    products.filter((product) => typeof product.id === "string").map((product) => [String(product.id), product]),
  );
  const formulaByClientId = new Map(
    formulas.filter((formula) => typeof formula.id === "string").map((formula) => [String(formula.id), formula]),
  );

  for (const reaction of reactions) {
    if (
      typeof reaction.id !== "string"
      || typeof reaction.productNameSnapshot !== "string"
      || !Array.isArray(reaction.symptoms)
      || typeof reaction.bodyArea !== "string"
      || typeof reaction.severity !== "string"
    ) {
      console.error("onboarding reaction context contains an invalid record");
      throw new ServiceError("CONTEXT_UNAVAILABLE", "Reaction history needs review before intelligence can run", 409);
    }
    const product = typeof reaction.productId === "string"
      ? productByClientId.get(reaction.productId)
      : products.find((candidate) =>
        typeof candidate.name === "string"
        && candidate.name.toLowerCase() === reaction.productNameSnapshot.toLowerCase()
      );
    const formula = typeof reaction.formulaSnapshotId === "string"
      ? formulaByClientId.get(reaction.formulaSnapshotId)
      : formulas.find((candidate) =>
        typeof candidate.productName === "string"
        && candidate.productName.toLowerCase() === reaction.productNameSnapshot.toLowerCase()
      );
    const brand = typeof reaction.brandSnapshot === "string"
      ? reaction.brandSnapshot
      : typeof formula?.brand === "string"
      ? formula.brand
      : typeof product?.brand === "string"
      ? product.brand
      : "Unknown brand";
    const category = typeof product?.category === "string" ? product.category : "other";
    const ingredients = safeArray<string>(formula?.ingredients);
    const { data: canonicalProduct, error: productError } = await admin.rpc("resolve_catalog_product", {
      p_brand: brand,
      p_name: reaction.productNameSnapshot,
      p_category: category,
    });
    if (productError || !canonicalProduct?.id) {
      console.error("onboarding reaction product normalization failed:", productError?.code ?? "empty");
      throw new ServiceError("CONTEXT_UNAVAILABLE", "Reaction history could not be normalized", 500);
    }
    const { error: reactionError } = await admin.rpc("record_product_reaction_once", {
      p_user_id: userId,
      p_source_key: `onboarding:${submission.id}:${reaction.id}`,
      p_product_id: canonicalProduct.id,
      p_product_name: reaction.productNameSnapshot,
      p_brand: brand,
      p_ingredients: ingredients,
      p_symptoms: reaction.symptoms,
      p_body_area: reaction.bodyArea,
      p_severity: reaction.severity,
      p_approximate_date: typeof reaction.approximateDate === "string" ? reaction.approximateDate : null,
      p_notes: typeof reaction.notes === "string" ? reaction.notes : null,
      p_formula_captured_at: typeof formula?.capturedAt === "string" ? formula.capturedAt : new Date().toISOString(),
    });
    if (reactionError) {
      console.error("onboarding reaction normalization failed:", reactionError.code);
      throw new ServiceError("CONTEXT_UNAVAILABLE", "Reaction history could not be normalized", 500);
    }
  }
}

export async function loadMemberContext(
  admin: SupabaseClient,
  userId: string,
): Promise<LoadedMemberContext> {
  await normalizeOnboardingReactionEvidence(admin, userId);
  const [profileResult, intakeResult, routineResult, shelfResult, reactionResult, formulaResult, signalResult, checkInResult, photoResult] = await Promise.all([
    admin.from("skin_profiles").select(
      "primary_goal, secondary_goals, routine_complexity, cost_preference, midday_feel, post_cleanse_tightness, known_sensitivities, sensitivities_status, active_prescriptions, pregnancy_status, additional_notes, onboarding_completed",
    ).eq("user_id", userId).maybeSingle(),
    admin.from("onboarding_submissions").select("payload_snapshot").eq("user_id", userId).eq("status", "committed").maybeSingle(),
    admin.from("routines").select("id, version, status, summary_sentence").eq("user_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("user_products").select(
      "id, product_id, detected_brand, detected_name, action, action_reason, frequency_nights_per_week, is_confirmed_by_user",
    ).eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("product_reactions").select(
      "id, user_id, product_id, formula_snapshot_id, product_name_snapshot, brand_snapshot, symptoms, body_area, severity, approximate_date, notes",
    ).eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("formula_snapshots").select(
      "id, product_id, product_name, brand, ingredients, captured_at",
    ).eq("user_id", userId).order("captured_at", { ascending: true }),
    admin.from("ingredient_signals").select(
      "ingredient_name, ingredient_key, version, confidence, evidence_count, contradictory_tolerance_evidence",
    ).eq("user_id", userId).order("ingredient_key", { ascending: true }).order("version", { ascending: false }),
    admin.from("check_ins").select("skin_state, irritation, adherence, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
    admin.from("user_photos").select(
      "capture_type, angle, capture_quality_passed, member_approved, captured_at",
    ).eq("user_id", userId).order("captured_at", { ascending: false }).limit(12),
  ]);

  const queryError = [profileResult, intakeResult, routineResult, shelfResult, reactionResult, formulaResult, signalResult, checkInResult, photoResult]
    .find((result) => result.error)?.error;
  if (queryError) {
    console.error("member intelligence context query failed:", queryError.code);
    throw new ServiceError("CONTEXT_UNAVAILABLE", "Member context could not be loaded", 500);
  }
  const profile = profileResult.data as Record<string, unknown> | null;
  if (!profile || profile.onboarding_completed !== true) {
    throw new ServiceError("PROFILE_NOT_READY", "Complete onboarding before using Derive intelligence", 409);
  }

  const routine = routineResult.data as Record<string, unknown> | null;
  let routineSteps: ContextRoutineStep[] = [];
  if (routine) {
    const { data, error } = await admin.from("routine_items").select(
      "id, product_id, brand, product_name, category, timing, days, order_index",
    ).eq("routine_id", routine.id).order("timing", { ascending: true }).order("order_index", { ascending: true });
    if (error) {
      console.error("member routine context query failed:", error.code);
      throw new ServiceError("CONTEXT_UNAVAILABLE", "Member context could not be loaded", 500);
    }
    routineSteps = (data ?? []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      brand: row.brand,
      productName: row.product_name,
      category: row.category,
      timing: row.timing,
      days: safeArray(row.days),
    }));
  }

  const shelfRows = shelfResult.data ?? [];
  const productIds = [...new Set(shelfRows.map((row: any) => row.product_id).filter(Boolean))];
  let productRows: any[] = [];
  if (productIds.length > 0) {
    const { data, error } = await admin.from("products").select(
      "id, brand, name, category, key_actives, full_ingredients",
    ).in("id", productIds);
    if (error) {
      console.error("member product context query failed:", error.code);
      throw new ServiceError("CONTEXT_UNAVAILABLE", "Member context could not be loaded", 500);
    }
    productRows = data ?? [];
  }
  const productById = new Map(productRows.map((row) => [row.id, row]));
  const shelfProducts: ContextProduct[] = shelfRows.flatMap((row: any) => {
    const product = productById.get(row.product_id);
    if (!product) return [];
    return [{
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      keyActives: safeArray(product.key_actives),
      fullIngredients: safeArray(product.full_ingredients),
      action: row.action,
      actionReason: row.action_reason ?? undefined,
      frequencyNightsPerWeek: row.frequency_nights_per_week ?? undefined,
      isConfirmedByUser: row.is_confirmed_by_user,
    }];
  });

  // Before the first proposal, confirmed shelf products still live in the sealed
  // onboarding snapshot. Include them without mutating the B1 contract.
  const snapshot = (intakeResult.data?.payload_snapshot ?? {}) as Record<string, unknown>;
  const snapshotProducts = safeArray<Record<string, unknown>>(snapshot.confirmedProducts);
  for (const item of snapshotProducts) {
    if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.brand !== "string") continue;
    if (shelfProducts.some((product) => product.id === item.id)) continue;
    shelfProducts.push({
      id: item.id,
      brand: item.brand,
      name: item.name,
      category: typeof item.category === "string" ? item.category as any : "other",
      keyActives: safeArray(item.keyActives),
      fullIngredients: safeArray(item.fullIngredients),
      isConfirmedByUser: true,
    });
  }

  const formulaSnapshots: FormulaSnapshot[] = (formulaResult.data ?? []).map((row: any) => ({
    id: row.id,
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    brand: row.brand ?? undefined,
    ingredients: safeArray(row.ingredients),
    capturedAt: row.captured_at,
  }));
  const productReactions: ProductReaction[] = (reactionResult.data ?? []).map((row: any) => ({
    id: row.id,
    userId,
    productId: row.product_id ?? undefined,
    formulaSnapshotId: row.formula_snapshot_id,
    productNameSnapshot: row.product_name_snapshot,
    brandSnapshot: row.brand_snapshot ?? undefined,
    symptoms: safeArray(row.symptoms),
    bodyArea: row.body_area,
    severity: row.severity,
    approximateDate: row.approximate_date ?? undefined,
    notes: row.notes ?? undefined,
  }));
  const formulaById = new Map(formulaSnapshots.map((formula) => [formula.id, formula]));
  const latestSignals = new Map<string, any>();
  for (const row of signalResult.data ?? []) {
    if (!latestSignals.has(row.ingredient_key)) latestSignals.set(row.ingredient_key, row);
  }

  const context: MemberIntelligenceContext = {
    profile: {
      primaryGoal: String(profile.primary_goal),
      secondaryGoals: safeArray(profile.secondary_goals),
      routineComplexity: String(profile.routine_complexity),
      costPreference: String(profile.cost_preference),
      middayFeel: String(profile.midday_feel),
      postCleanseTightness: profile.post_cleanse_tightness === true,
      knownSensitivities: safeArray(profile.known_sensitivities),
      sensitivitiesStatus: profile.sensitivities_status as any,
      activePrescriptions: safeArray(profile.active_prescriptions),
      pregnancyStatus: profile.pregnancy_status as any,
      additionalNotes: typeof profile.additional_notes === "string" ? profile.additional_notes : undefined,
      pihTendencyAnswer: typeof snapshot.pihTendencyAnswer === "string" ? snapshot.pihTendencyAnswer : null,
    },
    shelfProducts,
    activeRoutine: routine ? {
      version: Number(routine.version),
      status: String(routine.status),
      summarySentence: String(routine.summary_sentence),
      steps: routineSteps,
    } : null,
    reactions: productReactions.map((reaction) => ({
      id: reaction.id,
      productName: reaction.productNameSnapshot,
      severity: reaction.severity,
      symptoms: reaction.symptoms,
      ingredients: formulaById.get(reaction.formulaSnapshotId ?? "")?.ingredients ?? [],
    })),
    ingredientSignals: [...latestSignals.values()].map((row) => ({
      ingredientName: row.ingredient_name,
      confidence: row.confidence,
      evidenceCount: row.evidence_count,
      contradictoryToleranceEvidence: safeArray(row.contradictory_tolerance_evidence),
    })),
    recentCheckIns: (checkInResult.data ?? []).map((row: any) => ({
      skinState: row.skin_state,
      irritation: row.irritation,
      adherence: row.adherence,
      createdAt: row.created_at,
    })),
    photoContext: (photoResult.data ?? []).map((row: any) => ({
      captureType: row.capture_type,
      angle: row.angle,
      captureQualityPassed: row.capture_quality_passed === true,
      memberApproved: row.member_approved === true,
      capturedAt: row.captured_at,
    })),
  };

  const toleratedProducts: Product[] = shelfProducts
    .filter((product) => product.isConfirmedByUser && (!product.action || product.action === "KEEP"))
    .map((product) => ({
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      keyActives: product.keyActives,
      fullIngredients: product.fullIngredients,
    }));

  return { context, formulaSnapshots, productReactions, toleratedProducts };
}

export async function inferAndPersistIngredientSignals(
  admin: SupabaseClient,
  userId: string,
  loaded: LoadedMemberContext,
): Promise<IngredientSignal[]> {
  const signals = inferIngredientSignals({
    reactions: loaded.productReactions,
    formulaSnapshots: loaded.formulaSnapshots,
    toleratedProducts: loaded.toleratedProducts,
  });
  if (signals.length === 0) return [];
  const { error } = await admin.rpc("append_ingredient_signal_versions", {
    p_user_id: userId,
    p_signals: signals.map((signal) => ({
      ingredient_name: signal.ingredientName,
      confidence: signal.confidence,
      evidence_count: signal.evidenceCount,
      supporting_reaction_ids: signal.supportingReactionIds,
      contradictory_tolerance_evidence: signal.contradictoryToleranceEvidence,
      allergy_source: signal.allergySource ?? null,
      notes: signal.notes ?? null,
    })),
  });
  if (error) {
    console.error("ingredient signal persistence failed:", error.code);
    throw new ServiceError("SIGNAL_PERSIST_FAILED", "Ingredient evidence could not be updated", 500);
  }
  const mergedSignals = new Map(
    loaded.context.ingredientSignals.map((signal) => [signal.ingredientName.toLowerCase(), signal]),
  );
  for (const signal of signals) {
    const key = signal.ingredientName.toLowerCase();
    const existing = mergedSignals.get(key);
    if (existing?.confidence === "confirmed_allergy") continue;
    mergedSignals.set(key, {
      ingredientName: signal.ingredientName,
      confidence: signal.confidence,
      evidenceCount: signal.evidenceCount,
      contradictoryToleranceEvidence: signal.contradictoryToleranceEvidence,
    });
  }
  loaded.context.ingredientSignals = [...mergedSignals.values()];
  return signals;
}

export async function recordSafetyEscalation(
  admin: SupabaseClient,
  userId: string,
  severity: "warning" | "emergency",
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("founder_review_tasks").select("id")
    .eq("user_id", userId).eq("task_type", "safety_flag").eq("status", "pending")
    .gte("created_at", since).limit(1);
  if (error) {
    console.error("safety task lookup failed:", error.code);
    return;
  }
  if ((data ?? []).length > 0) return;
  const { error: insertError } = await admin.from("founder_review_tasks").insert({
    user_id: userId,
    task_type: "safety_flag",
    status: "pending",
    priority: severity === "emergency" ? "urgent" : "high",
    notes: "Automated safety circuit breaker escalated a member question; review required. No transcript stored in this task.",
  });
  if (insertError) console.error("safety task insert failed:", insertError.code);
}
