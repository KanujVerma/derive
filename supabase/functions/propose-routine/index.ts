import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ROUTINE_RESPONSE_SCHEMA,
  enforceRoutineSafety,
  parseRoutineProposal,
  routinePrompt,
} from "../_shared/intelligence.ts";
import {
  ServiceError,
  authenticate,
  corsHeaders,
  errorResponse,
  generateStructuredJson,
  inferAndPersistIngredientSignals,
  jsonResponse,
  loadExistingInitialRoutineId,
  loadMemberContext,
  loadRoutineProposalResult,
  persistRoutineProposal,
  readJsonObject,
} from "../_shared/runtime.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    const body = await readJsonObject(req);
    if (Object.hasOwn(body, "userId")) {
      throw new ServiceError("INVALID_PAYLOAD", "Caller identity must not be supplied", 400);
    }

    const loaded = await loadMemberContext(admin, userId);
    const existingRoutineId = await loadExistingInitialRoutineId(admin, userId);
    if (existingRoutineId) {
      return jsonResponse(
        await loadRoutineProposalResult(admin, userId, existingRoutineId, []),
      );
    }
    await inferAndPersistIngredientSignals(admin, userId, loaded);

    const prompt = routinePrompt(loaded.context);
    const modelValue = await generateStructuredJson(prompt.system, prompt.prompt, ROUTINE_RESPONSE_SCHEMA);
    let proposal;
    try {
      proposal = parseRoutineProposal(modelValue);
      enforceRoutineSafety(proposal, loaded.context);
    } catch (error) {
      console.error("routine model output rejected:", error instanceof Error ? error.message : "unknown");
      throw new ServiceError("MODEL_UNSAFE", "The generated routine did not pass Derive safety checks", 422);
    }

    const routineId = await persistRoutineProposal(admin, userId, proposal);
    const result = await loadRoutineProposalResult(
      admin,
      userId,
      routineId,
      proposal.clarificationQuestions,
    );
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
