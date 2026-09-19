// Supabase Edge Function: photo-url
// Issues a 15-minute signed URL for one caller-owned private photo.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const PHOTO_BUCKET = "customer-skin-photos";
const SIGNED_URL_TTL_SECONDS = 900;
const ALLOWED_PHOTO_TYPES = new Set(["front", "left", "right", "shelf", "checkin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
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

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function externallyReachableSignedUrl(rawSignedUrl: string): string {
  const signedUrl = new URL(rawSignedUrl);
  if (signedUrl.hostname !== "kong") return signedUrl.toString();

  const publicSupabaseUrl = Deno.env.get("DERIVE_PUBLIC_SUPABASE_URL")
    ?? "http://127.0.0.1:54321";
  return new URL(`${signedUrl.pathname}${signedUrl.search}`, publicSupabaseUrl).toString();
}

function isOwnedPhotoPath(userId: string, storagePath: string): boolean {
  const parts = storagePath.split("/");
  return parts.length >= 3
    && parts[0] === userId
    && ALLOWED_PHOTO_TYPES.has(parts[1])
    && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ code: "UNAUTHORIZED", error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("photo-url server environment is incomplete");
      return jsonResponse({ code: "INTERNAL_ERROR", error: "Photo access is unavailable" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ code: "UNAUTHORIZED", error: "Invalid or expired session" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ code: "INVALID_PAYLOAD", error: "A photo ID is required" }, 400);
    }

    const unexpectedFields = Object.keys(body).filter((key) => key !== "photoId");
    if (
      unexpectedFields.length > 0
      || typeof body.photoId !== "string"
      || !UUID_PATTERN.test(body.photoId)
    ) {
      return jsonResponse({ code: "INVALID_PAYLOAD", error: "A valid photo ID is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: photo, error: photoError } = await adminClient
      .from("user_photos")
      .select("storage_path")
      .eq("id", body.photoId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (photoError) {
      console.error("photo-url metadata lookup failed:", photoError.code);
      return jsonResponse({ code: "INTERNAL_ERROR", error: "Photo access is unavailable" }, 500);
    }
    if (!photo) {
      return jsonResponse({ code: "PHOTO_NOT_FOUND", error: "Photo not found" }, 404);
    }

    const storagePath = String(photo.storage_path ?? "");
    if (!isOwnedPhotoPath(user.id, storagePath)) {
      console.error("photo-url rejected invalid owner path");
      return jsonResponse({ code: "PHOTO_NOT_FOUND", error: "Photo not found" }, 404);
    }

    const { data: signed, error: signError } = await adminClient.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      console.error("photo-url signing failed:", signError?.message ? "storage_error" : "empty_response");
      return jsonResponse({ code: "SIGNING_FAILED", error: "Photo access is unavailable" }, 500);
    }

    return jsonResponse(
      {
        signedUrl: externallyReachableSignedUrl(signed.signedUrl),
        expiresIn: SIGNED_URL_TTL_SECONDS,
      },
      200,
    );
  } catch (error) {
    console.error("photo-url unexpected failure:", error instanceof Error ? error.name : "unknown");
    return jsonResponse({ code: "INTERNAL_ERROR", error: "Photo access is unavailable" }, 500);
  }
});
