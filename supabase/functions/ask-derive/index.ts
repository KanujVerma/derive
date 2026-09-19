import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ASK_RESPONSE_SCHEMA,
  askPrompt,
  parseAskResponse,
  safetyCircuitBreaker,
} from "../_shared/intelligence.ts";
import {
  ServiceError,
  authenticate,
  corsHeaders,
  errorResponse,
  generateStructuredJson,
  inferAndPersistIngredientSignals,
  jsonResponse,
  loadMemberContext,
  readJsonObject,
  recordSafetyEscalation,
  requireMemberEntitlement,
} from "../_shared/runtime.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    const body = await readJsonObject(req);
    if (typeof body.userId !== "string" || body.userId !== userId) {
      throw new ServiceError("IDENTITY_MISMATCH", "Request identity does not match the signed-in member", 403);
    }
    if (typeof body.question !== "string" || body.question.trim().length < 2 || body.question.length > 2_000) {
      throw new ServiceError("INVALID_PAYLOAD", "Question must contain 2-2000 characters", 400);
    }
    const question = body.question.trim();
    const safetyResponse = safetyCircuitBreaker(question);
    if (safetyResponse) {
      await recordSafetyEscalation(admin, userId, safetyResponse.safety.severity as "warning" | "emergency");
      return jsonResponse(safetyResponse);
    }

    await requireMemberEntitlement(admin, userId);

    const loaded = await loadMemberContext(admin, userId);
    await inferAndPersistIngredientSignals(admin, userId, loaded);
    const activeContext = body.activeContext && typeof body.activeContext === "object"
      ? {
        scannedProduct: (body.activeContext as Record<string, unknown>).scannedProduct,
        currentStepId: (body.activeContext as Record<string, unknown>).currentStepId,
      }
      : undefined;
    const prompt = askPrompt(question, activeContext, loaded.context);
    const modelValue = await generateStructuredJson(prompt.system, prompt.prompt, ASK_RESPONSE_SCHEMA);
    let answer;
    try {
      answer = parseAskResponse(modelValue);
    } catch (error) {
      console.error("Ask model output rejected:", error instanceof Error ? error.message : "unknown");
      throw new ServiceError("MODEL_INVALID_OUTPUT", "Derive could not produce a safe answer", 422);
    }
    return jsonResponse(answer);
  } catch (error) {
    return errorResponse(error);
  }
});
