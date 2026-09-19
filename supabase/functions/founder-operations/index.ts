import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  validateRoutineProposal,
  validateSensitivities,
  type TrustedProductInfo,
} from "../propose-routine/validator.ts";
import type {
  AssembledRoutineContext,
  RoutineIntelligenceProposal,
  RoutineProposalStep,
} from "../propose-routine/types.ts";

const MAX_BODY_BYTES = 250_000;
const MAX_QUEUE_ROWS = 100;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

class FounderError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function responseHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Vary: "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return headers;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(req) });
}

function errorResponse(req: Request, error: unknown): Response {
  if (error instanceof FounderError) {
    return json(req, { code: error.code, error: error.message }, error.status);
  }
  console.error("founder operations failed:", error instanceof Error ? error.name : "unknown");
  return json(req, { code: "INTERNAL_ERROR", error: "Founder operations are temporarily unavailable" }, 500);
}

function requireString(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new FounderError("INVALID_PAYLOAD", `${field} is required`, 400);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, max = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, max);
}

function requireUuid(value: unknown, field: string): string {
  const text = requireString(value, field, 40);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new FounderError("INVALID_PAYLOAD", `${field} must be a UUID`, 400);
  }
  return text;
}

function stringArray(value: unknown, field: string, maxItems = 150): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new FounderError("INVALID_PAYLOAD", `${field} must be an array`, 400);
  }
  return value.map((item, index) => requireString(item, `${field}[${index}]`, 300));
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new FounderError("INVALID_PAYLOAD", "Request is too large", 413);
  }
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new FounderError("INVALID_PAYLOAD", "A JSON object is required", 400);
  }
}

interface FounderRuntime {
  founderId: string;
  founderRole: "founder" | "operator";
  admin: SupabaseClient;
}

async function authenticateFounder(req: Request): Promise<FounderRuntime> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new FounderError("UNAUTHORIZED", "Sign in is required", 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("founder operations server environment is incomplete");
    throw new FounderError("OPERATIONS_UNAVAILABLE", "Founder operations are not configured", 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new FounderError("UNAUTHORIZED", "Session is invalid or expired", 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: founder, error: founderError } = await admin.from("founder_accounts")
    .select("user_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (founderError) {
    console.error("founder authorization lookup failed:", founderError.code);
    throw new FounderError("OPERATIONS_UNAVAILABLE", "Founder access could not be verified", 503);
  }
  if (!founder || (founder.role !== "founder" && founder.role !== "operator")) {
    throw new FounderError("FORBIDDEN", "This account is not authorized for founder operations", 403);
  }
  return { founderId: user.id, founderRole: founder.role, admin };
}

function queryFailure(label: string, error: { code?: string } | null): never {
  console.error(`${label} failed:`, error?.code ?? "unknown");
  throw new FounderError("OPERATIONS_UNAVAILABLE", "Founder data could not be loaded", 500);
}

async function profileMap(admin: SupabaseClient, ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await admin.from("profiles")
    .select("id, email, full_name, phone")
    .in("id", uniqueIds);
  if (error) queryFailure("profile lookup", error);
  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function dashboard(admin: SupabaseClient): Promise<Record<string, unknown>> {
  const [tasks, routines, refills, formulas] = await Promise.all([
    admin.from("founder_review_tasks")
      .select("id, user_id, task_type, status, priority, notes, created_at")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(MAX_QUEUE_ROWS),
    admin.from("routines")
      .select("id, user_id, version, status, summary_sentence, created_at, updated_at")
      .eq("status", "awaiting_review")
      .order("created_at", { ascending: true })
      .limit(MAX_QUEUE_ROWS),
    admin.from("refill_requests")
      .select("id, user_id, product_id, product_name, brand, status, requested_at, shipped_at, delivered_at, estimated_delivery, carrier, tracking_number, tracking_url, request_note")
      .in("status", ["requested", "ordered", "shipped"])
      .order("requested_at", { ascending: true })
      .limit(MAX_QUEUE_ROWS),
    admin.from("products")
      .select("id, brand, name, category, key_actives, full_ingredients, is_catalog_standard, created_at, updated_at")
      .eq("is_catalog_standard", false)
      .order("created_at", { ascending: true })
      .limit(MAX_QUEUE_ROWS),
  ]);
  for (const [label, result] of [["task queue", tasks], ["routine queue", routines], ["refill queue", refills], ["formula queue", formulas]] as const) {
    if (result.error) queryFailure(label, result.error);
  }
  const ids = [
    ...(tasks.data ?? []).map((row) => row.user_id),
    ...(routines.data ?? []).map((row) => row.user_id),
    ...(refills.data ?? []).map((row) => row.user_id),
  ];
  const profiles = await profileMap(admin, ids);
  const member = (userId: string) => profiles.get(userId) ?? { id: userId, full_name: null, email: "" };
  const pendingTasks = tasks.data ?? [];
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      urgentSafety: pendingTasks.filter((row) => row.task_type === "safety_flag" && row.priority === "urgent").length,
      routineReview: (routines.data ?? []).length,
      activeRefills: (refills.data ?? []).length,
      formulaAudit: (formulas.data ?? []).length,
    },
    safetyQueue: pendingTasks
      .filter((row) => row.task_type === "safety_flag")
      .map((row) => ({ ...row, member: member(row.user_id) })),
    routineQueue: (routines.data ?? []).map((row) => ({ ...row, member: member(row.user_id) })),
    refillQueue: (refills.data ?? []).map((row) => ({ ...row, member: member(row.user_id) })),
    formulaQueue: formulas.data ?? [],
  };
}

async function routineDetail(admin: SupabaseClient, routineId: string): Promise<Record<string, unknown>> {
  const { data: routine, error } = await admin.from("routines")
    .select("id, user_id, version, status, summary_sentence, founder_notes, created_at, updated_at, published_at")
    .eq("id", routineId)
    .maybeSingle();
  if (error) queryFailure("routine detail", error);
  if (!routine) throw new FounderError("NOT_FOUND", "Routine proposal was not found", 404);

  const [items, profile, skin, notes, reactions, signals, checkIns] = await Promise.all([
    admin.from("routine_items")
      .select("id, routine_id, product_id, order_index, timing, product_name, brand, category, amount, area, days, purpose, why_chosen, watch_for")
      .eq("routine_id", routine.id)
      .order("timing", { ascending: true })
      .order("order_index", { ascending: true }),
    admin.from("profiles").select("id, email, full_name, phone").eq("id", routine.user_id).maybeSingle(),
    admin.from("skin_profiles")
      .select("primary_goal, secondary_goals, routine_complexity, cost_preference, midday_feel, post_cleanse_tightness, known_sensitivities, sensitivities_status, active_prescriptions, pregnancy_status, additional_notes")
      .eq("user_id", routine.user_id).maybeSingle(),
    admin.from("founder_member_notes")
      .select("id, author_user_id, note_type, body, created_at")
      .eq("user_id", routine.user_id).order("created_at", { ascending: false }).limit(30),
    admin.from("product_reactions")
      .select("id, product_name_snapshot, brand_snapshot, symptoms, body_area, severity, approximate_date, notes, created_at")
      .eq("user_id", routine.user_id).order("created_at", { ascending: false }).limit(30),
    admin.from("ingredient_signals")
      .select("ingredient_name, version, confidence, evidence_count, allergy_source, notes, observed_at")
      .eq("user_id", routine.user_id).order("observed_at", { ascending: false }).limit(50),
    admin.from("check_ins")
      .select("skin_state, irritation, goal_outcome, adherence, irritation_symptoms, notes, created_at")
      .eq("user_id", routine.user_id).order("created_at", { ascending: false }).limit(12),
  ]);
  for (const [label, result] of [["routine items", items], ["member profile", profile], ["skin profile", skin], ["founder notes", notes], ["reaction history", reactions], ["ingredient signals", signals], ["check-ins", checkIns]] as const) {
    if (result.error) queryFailure(label, result.error);
  }
  return {
    routine,
    items: items.data ?? [],
    member: profile.data,
    skinProfile: skin.data,
    founderNotes: notes.data ?? [],
    reactions: reactions.data ?? [],
    ingredientSignals: signals.data ?? [],
    recentCheckIns: checkIns.data ?? [],
  };
}

interface SubmittedRoutineItem {
  product_id: string;
  order_index: number;
  timing: "am" | "pm";
  product_name: string;
  brand: string;
  category: string;
  amount: string;
  area: string;
  days: string[];
  purpose: string;
  why_chosen: string;
  watch_for: string | null;
}

function parseRoutineItems(value: unknown): SubmittedRoutineItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) {
    throw new FounderError("INVALID_PAYLOAD", "Routine must contain 1–24 steps", 400);
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new FounderError("INVALID_PAYLOAD", `items[${index}] is invalid`, 400);
    }
    const row = raw as Record<string, unknown>;
    const timing = requireString(row.timing, `items[${index}].timing`, 2);
    if (timing !== "am" && timing !== "pm") throw new FounderError("INVALID_PAYLOAD", "Timing must be am or pm", 400);
    const order = Number(row.order_index);
    if (!Number.isInteger(order) || order < 1 || order > 20) {
      throw new FounderError("INVALID_PAYLOAD", `items[${index}].order_index is invalid`, 400);
    }
    return {
      product_id: requireUuid(row.product_id, `items[${index}].product_id`),
      order_index: order,
      timing,
      product_name: requireString(row.product_name, `items[${index}].product_name`, 180),
      brand: requireString(row.brand, `items[${index}].brand`, 120),
      category: requireString(row.category, `items[${index}].category`, 40),
      amount: requireString(row.amount, `items[${index}].amount`, 160),
      area: requireString(row.area, `items[${index}].area`, 200),
      days: stringArray(row.days ?? [], `items[${index}].days`, 7),
      purpose: requireString(row.purpose, `items[${index}].purpose`, 300),
      why_chosen: requireString(row.why_chosen, `items[${index}].why_chosen`, 600),
      watch_for: optionalString(row.watch_for, `items[${index}].watch_for`, 300),
    };
  });
}

async function validateFounderRoutine(
  admin: SupabaseClient,
  userId: string,
  summary: string,
  items: SubmittedRoutineItem[],
): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const [productsResult, skinResult] = await Promise.all([
    admin.from("products")
      .select("id, brand, name, category, key_actives, full_ingredients, is_catalog_standard")
      .in("id", productIds),
    admin.from("skin_profiles")
      .select("pregnancy_status, is_pregnant_or_nursing, sensitivities_status, known_sensitivities, active_prescriptions")
      .eq("user_id", userId).maybeSingle(),
  ]);
  if (productsResult.error) queryFailure("routine product validation", productsResult.error);
  if (skinResult.error) queryFailure("routine safety validation", skinResult.error);
  if (!skinResult.data) throw new FounderError("VALIDATION_FAILED", "Member safety context is unavailable", 409);
  const productById = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
  if (productById.size !== productIds.length) {
    throw new FounderError("VALIDATION_FAILED", "Every routine step must reference a known catalog product", 409);
  }

  const steps: RoutineProposalStep[] = items.map((item) => ({
    order: item.order_index,
    timing: item.timing,
    productName: item.product_name,
    brand: item.brand,
    category: item.category as RoutineProposalStep["category"],
    amount: item.amount,
    area: item.area,
    days: item.days as RoutineProposalStep["days"],
    purpose: item.purpose,
    whyChosen: item.why_chosen,
    watchFor: item.watch_for ?? undefined,
  }));
  const catalogProducts = [...productById.values()].map((product) => ({
    brand: product.brand,
    name: product.name,
    category: product.category,
    keyActives: product.key_actives ?? [],
    fullIngredients: product.full_ingredients ?? [],
    isCatalogStandard: product.is_catalog_standard === true,
  }));
  const proposal: RoutineIntelligenceProposal = {
    summarySentence: summary,
    amSteps: steps.filter((step) => step.timing === "am"),
    pmSteps: steps.filter((step) => step.timing === "pm"),
    catalogProducts,
    productDecisions: catalogProducts.map((product) => ({
      productName: product.name,
      brand: product.brand,
      category: product.category,
      action: "ADD",
      actionReason: "Founder-reviewed published routine step.",
    })),
  } as RoutineIntelligenceProposal;
  const context: Partial<AssembledRoutineContext> = {
    userId,
    pregnancyStatus: skinResult.data.pregnancy_status,
    isPregnantOrNursing: skinResult.data.is_pregnant_or_nursing === true,
    sensitivitiesStatus: skinResult.data.sensitivities_status,
    knownSensitivities: skinResult.data.known_sensitivities ?? [],
    activePrescriptions: skinResult.data.active_prescriptions ?? [],
  };
  const structural = validateRoutineProposal(proposal, context);
  const trustedMap = new Map<string, TrustedProductInfo>(catalogProducts.map((product) => [
    `${product.brand.trim().toLowerCase()}::${product.name.trim().toLowerCase()}`,
    {
      brand: product.brand,
      name: product.name,
      isCatalogStandard: product.isCatalogStandard,
      fullIngredients: product.fullIngredients,
      keyActives: product.keyActives,
    },
  ]));
  const sensitivity = validateSensitivities(proposal, context, trustedMap);
  const errors = [...structural.errors, ...sensitivity.errors];
  if (errors.length > 0) {
    throw new FounderError("VALIDATION_FAILED", errors.slice(0, 8).join(" "), 409);
  }
}

async function rpcOrThrow(admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    const known = [
      "NOT_FOUND", "NOT_AWAITING_REVIEW", "INVALID_", "REQUIRED", "TOO_LONG",
      "ALREADY_RESOLVED", "FOUNDER_ACCESS_REQUIRED",
    ].some((token) => error.message?.includes(token));
    console.error(`${name} failed:`, error.code);
    throw new FounderError(known ? "CONFLICT" : "OPERATIONS_UNAVAILABLE", known ? error.message : "Operation could not be completed", known ? 409 : 500);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && !allowedOrigins().has(origin)) return json(req, { error: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: responseHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { code: "METHOD_NOT_ALLOWED", error: "POST is required" }, 405);

  try {
    const { founderId, founderRole, admin } = await authenticateFounder(req);
    const body = await readBody(req);
    const action = requireString(body.action, "action", 60);

    if (action === "dashboard") {
      return json(req, { founder: { id: founderId, role: founderRole }, ...(await dashboard(admin)) });
    }
    if (action === "routine_detail") {
      return json(req, await routineDetail(admin, requireUuid(body.routineId, "routineId")));
    }
    if (action === "publish_routine") {
      const routineId = requireUuid(body.routineId, "routineId");
      const requestId = requireUuid(body.requestId, "requestId");
      const summary = requireString(body.summarySentence, "summarySentence", 600);
      const items = parseRoutineItems(body.items);
      const detail = await routineDetail(admin, routineId);
      const routine = detail.routine as Record<string, unknown>;
      if (routine.status !== "awaiting_review") throw new FounderError("CONFLICT", "Routine is no longer awaiting review", 409);
      await validateFounderRoutine(admin, String(routine.user_id), summary, items);
      const data = await rpcOrThrow(admin, "founder_publish_routine", {
        p_actor_user_id: founderId,
        p_source_routine_id: routineId,
        p_summary_sentence: summary,
        p_items: items,
        p_founder_notes: optionalString(body.founderNotes, "founderNotes", 4000),
        p_request_id: requestId,
      });
      return json(req, { result: data });
    }
    if (action === "transition_refill") {
      const nextStatus = requireString(body.nextStatus, "nextStatus", 20);
      const data = await rpcOrThrow(admin, "founder_transition_refill", {
        p_actor_user_id: founderId,
        p_refill_id: requireUuid(body.refillId, "refillId"),
        p_next_status: nextStatus,
        p_carrier: optionalString(body.carrier, "carrier", 80),
        p_tracking_number: optionalString(body.trackingNumber, "trackingNumber", 160),
        p_tracking_url: optionalString(body.trackingUrl, "trackingUrl", 500),
        p_estimated_delivery: optionalString(body.estimatedDelivery, "estimatedDelivery", 80),
        p_request_id: requireUuid(body.requestId, "requestId"),
      });
      return json(req, { result: data });
    }
    if (action === "review_formula") {
      const decision = requireString(body.decision, "decision", 20);
      const data = await rpcOrThrow(admin, "founder_review_formula", {
        p_actor_user_id: founderId,
        p_product_id: requireUuid(body.productId, "productId"),
        p_decision: decision,
        p_ingredients: stringArray(body.ingredients ?? [], "ingredients"),
        p_key_actives: stringArray(body.keyActives ?? [], "keyActives", 30),
        p_source_reference: requireString(body.sourceReference, "sourceReference", 500),
        p_review_notes: optionalString(body.reviewNotes, "reviewNotes", 2000),
        p_request_id: requireUuid(body.requestId, "requestId"),
      });
      return json(req, { result: data });
    }
    if (action === "add_note") {
      const data = await rpcOrThrow(admin, "founder_add_member_note", {
        p_actor_user_id: founderId,
        p_user_id: requireUuid(body.userId, "userId"),
        p_note_type: requireString(body.noteType, "noteType", 40),
        p_body: requireString(body.note, "note", 4000),
        p_request_id: requireUuid(body.requestId, "requestId"),
      });
      return json(req, { result: data });
    }
    if (action === "resolve_task") {
      const data = await rpcOrThrow(admin, "founder_resolve_task", {
        p_actor_user_id: founderId,
        p_task_id: requireUuid(body.taskId, "taskId"),
        p_resolution: requireString(body.resolution, "resolution", 20),
        p_request_id: requireUuid(body.requestId, "requestId"),
      });
      return json(req, { result: data });
    }
    throw new FounderError("INVALID_ACTION", "Unknown founder operation", 400);
  } catch (error) {
    return errorResponse(req, error);
  }
});
