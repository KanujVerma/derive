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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);

  try {
    const { userId, admin } = await authenticate(req);
    await requireMemberEntitlement(admin, userId);
    const body = await readJsonObject(req);
    const resolutionCaseId = optionalShortString(body.resolutionCaseId, "resolutionCaseId", 40);
    if (resolutionCaseId && !UUID_PATTERN.test(resolutionCaseId)) {
      throw new ServiceError("INVALID_PAYLOAD", "resolutionCaseId must be a UUID", 400);
    }
    let productName = optionalShortString(body.productName, "productName", 180);
    let brand = optionalShortString(body.brand, "brand", 120);
    let barcode = optionalShortString(body.barcode, "barcode", 64);
    if (resolutionCaseId) {
      const { data: resolution, error: resolutionError } = await admin.from("product_resolution_cases")
        .select("resolution_state, product_id")
        .eq("id", resolutionCaseId)
        .eq("user_id", userId)
        .maybeSingle();
      if (resolutionError) {
        console.error("scan resolution lookup failed:", resolutionError.code);
        throw new ServiceError("CONTEXT_UNAVAILABLE", "Verified product identity could not be loaded", 500);
      }
      if (!resolution) throw new ServiceError("PRODUCT_IDENTITY_NOT_FOUND", "Product identity was not found", 404);
      if (resolution.resolution_state !== "verified_product_formula" || !resolution.product_id) {
        throw new ServiceError("PRODUCT_IDENTITY_UNRESOLVED", "Confirm the exact product and formula before evaluation", 409);
      }
      const { data: product, error: productError } = await admin.from("products")
        .select("brand, name").eq("id", resolution.product_id).maybeSingle();
      if (productError || !product) {
        console.error("scan verified product lookup failed:", productError?.code ?? "empty");
        throw new ServiceError("CONTEXT_UNAVAILABLE", "Verified product identity could not be loaded", 500);
      }
      if (
        (productName && productName.toLowerCase() !== product.name.toLowerCase())
        || (brand && brand.toLowerCase() !== product.brand.toLowerCase())
      ) {
        throw new ServiceError("PRODUCT_IDENTITY_MISMATCH", "Product labels do not match the verified identity", 409);
      }
      productName = product.name;
      brand = product.brand;
      barcode = undefined;
    }
    if (!productName) {
      throw new ServiceError("INVALID_PAYLOAD", "A product name is required for evaluation", 400);
    }
    const productInput = {
      productName,
      brand,
      barcode,
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
