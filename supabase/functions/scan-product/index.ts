import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  SCAN_RESPONSE_SCHEMA,
  enforceScanIdentity,
  enforceScanSafety,
  parseProductScan,
  scanPrompt,
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
  requireMemberEntitlement,
} from "../_shared/runtime.ts";

const optionalShortString = (value: unknown, field: string, max: number): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new ServiceError("INVALID_PAYLOAD", `${field} is invalid`, 400);
  }
  return value.trim();
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    await requireMemberEntitlement(admin, userId);
    const body = await readJsonObject(req);
    const productName = optionalShortString(body.productName, "productName", 180);
    if (!productName) {
      throw new ServiceError("INVALID_PAYLOAD", "A product name is required for evaluation", 400);
    }
    const productInput = {
      productName,
      brand: optionalShortString(body.brand, "brand", 120),
      barcode: optionalShortString(body.barcode, "barcode", 64),
    };
    const loaded = await loadMemberContext(admin, userId);
    await inferAndPersistIngredientSignals(admin, userId, loaded);
    const prompt = scanPrompt(productInput, loaded.context);
    const modelValue = await generateStructuredJson(prompt.system, prompt.prompt, SCAN_RESPONSE_SCHEMA);
    let scan;
    try {
      scan = enforceScanIdentity(parseProductScan(modelValue), productInput);
    } catch (error) {
      console.error("scan model output rejected:", error instanceof Error ? error.message : "unknown");
      throw new ServiceError("MODEL_INVALID_OUTPUT", "The product could not be evaluated safely", 422);
    }
    const guarded = enforceScanSafety(scan, loaded.context);
    return jsonResponse(guarded);
  } catch (error) {
    return errorResponse(error);
  }
});
