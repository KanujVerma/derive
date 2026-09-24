import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from "../_shared/runtime.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(["front_label", "ingredients", "packaging"]);
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);
  try {
    const { userId, admin } = await authenticate(req);
    const body = await readJsonObject(req);
    if (Object.keys(body).some((key) => !["requestId", "role", "mimeType"].includes(key))
      || typeof body.requestId !== "string" || !UUID.test(body.requestId)
      || typeof body.role !== "string" || !ROLES.has(body.role)
      || typeof body.mimeType !== "string" || !MIMES.has(body.mimeType)) {
      throw new ServiceError("INVALID_PAYLOAD", "A request UUID, photo role, and supported image type are required", 400);
    }
    const { data, error } = await admin.rpc("issue_free_product_evidence_grant", {
      p_user_id: userId, p_request_id: body.requestId, p_role: body.role, p_mime_type: body.mimeType,
    });
    if (error || !data || typeof data.storage_path !== "string") {
      if (error?.message?.includes("FREE_EVIDENCE_DAILY_LIMIT")) {
        throw new ServiceError("DAILY_LIMIT", "Try adding more product photos tomorrow", 429);
      }
      if (error?.message?.includes("FREE_EVIDENCE_REQUEST_CONFLICT")) {
        throw new ServiceError("REQUEST_CONFLICT", "This request ID was used for a different photo", 409);
      }
      console.error("free evidence grant failed:", error?.code ?? "empty");
      throw new ServiceError("EVIDENCE_UNAVAILABLE", "Photo upload is temporarily unavailable", 503);
    }
    return jsonResponse({ bucket: "customer-product-evidence", storagePath: data.storage_path,
      role: data.role, mimeType: data.mime_type, maxBytes: 10 * 1024 * 1024 });
  } catch (error) { return errorResponse(error); }
});
