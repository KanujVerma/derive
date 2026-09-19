import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authenticate,
  corsHeaders,
  errorResponse,
  inferAndPersistIngredientSignals,
  jsonResponse,
  loadMemberContext,
  readJsonObject,
  requireMemberEntitlement,
} from "../_shared/runtime.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    await requireMemberEntitlement(admin, userId);
    await readJsonObject(req);
    const loaded = await loadMemberContext(admin, userId);
    const signals = await inferAndPersistIngredientSignals(admin, userId, loaded);
    return jsonResponse({ signals });
  } catch (error) {
    return errorResponse(error);
  }
});
