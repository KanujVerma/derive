// Supabase Edge Function: delete-customer-account
// Deletes private Storage objects first, then removes the caller's Auth user.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const PHOTO_BUCKET = "customer-skin-photos";
const DELETE_CONFIRMATION = "DELETE_MY_DERIVE_ACCOUNT";
const PAGE_SIZE = 100;
const MAX_NAMESPACE_ENTRIES = 10_000;

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

function isOwnedStoragePath(userId: string, storagePath: string): boolean {
  const parts = storagePath.split("/");
  return parts.length >= 2
    && parts[0] === userId
    && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

async function listNamespaceObjects(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ paths: string[]; error: string | null }> {
  const pendingPrefixes = [userId];
  const seenPrefixes = new Set<string>();
  const paths: string[] = [];
  let encountered = 0;

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift()!;
    if (seenPrefixes.has(prefix)) continue;
    seenPrefixes.add(prefix);

    let offset = 0;
    while (true) {
      const { data, error } = await adminClient.storage.from(PHOTO_BUCKET).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) return { paths: [], error: "storage_list_failed" };

      for (const entry of data ?? []) {
        encountered += 1;
        if (encountered > MAX_NAMESPACE_ENTRIES) {
          return { paths: [], error: "namespace_limit_exceeded" };
        }

        const entryPath = `${prefix}/${entry.name}`;
        if (entry.id === null || entry.id === undefined) {
          pendingPrefixes.push(entryPath);
        } else {
          paths.push(entryPath);
        }
      }

      if (!data || data.length < PAGE_SIZE) break;
      offset += data.length;
    }
  }

  return { paths, error: null };
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
      console.error("delete-customer-account server environment is incomplete");
      return jsonResponse({ code: "INTERNAL_ERROR", error: "Account deletion is unavailable" }, 500);
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
      return jsonResponse({ code: "INVALID_CONFIRMATION", error: "Deletion confirmation required" }, 400);
    }

    const unexpectedFields = Object.keys(body).filter((key) => key !== "confirmation");
    if (unexpectedFields.length > 0 || body.confirmation !== DELETE_CONFIRMATION) {
      return jsonResponse({ code: "INVALID_CONFIRMATION", error: "Deletion confirmation required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [photoRows, submissionRows, namespaceListing] = await Promise.all([
      adminClient.from("user_photos").select("storage_path").eq("user_id", user.id),
      adminClient
        .from("onboarding_submissions")
        .select("front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
        .eq("user_id", user.id),
      listNamespaceObjects(adminClient, user.id),
    ]);

    if (photoRows.error || submissionRows.error || namespaceListing.error) {
      console.error("delete-customer-account inventory failed:",
        photoRows.error?.code ?? submissionRows.error?.code ?? namespaceListing.error);
      return jsonResponse({ code: "DELETION_FAILED", error: "Account deletion could not be completed" }, 500);
    }

    const allPaths = new Set<string>(namespaceListing.paths);
    for (const row of photoRows.data ?? []) {
      if (row.storage_path) allPaths.add(String(row.storage_path));
    }
    for (const row of submissionRows.data ?? []) {
      for (const value of [
        row.front_storage_path,
        row.left_storage_path,
        row.right_storage_path,
        row.shelf_storage_path,
      ]) {
        if (value) allPaths.add(String(value));
      }
    }

    if ([...allPaths].some((path) => !isOwnedStoragePath(user.id, path))) {
      console.error("delete-customer-account rejected cross-owner metadata path");
      return jsonResponse({ code: "DELETION_FAILED", error: "Account deletion could not be completed" }, 500);
    }

    const paths = [...allPaths];
    for (let index = 0; index < paths.length; index += PAGE_SIZE) {
      const { error } = await adminClient.storage
        .from(PHOTO_BUCKET)
        .remove(paths.slice(index, index + PAGE_SIZE));
      if (error) {
        console.error("delete-customer-account storage removal failed");
        return jsonResponse({ code: "DELETION_FAILED", error: "Account deletion could not be completed" }, 500);
      }
    }

    const verification = await listNamespaceObjects(adminClient, user.id);
    if (verification.error || verification.paths.length > 0) {
      console.error("delete-customer-account storage verification failed");
      return jsonResponse({ code: "DELETION_FAILED", error: "Account deletion could not be completed" }, 500);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error("delete-customer-account auth deletion failed:", deleteUserError.name);
      return jsonResponse({ code: "DELETION_FAILED", error: "Account deletion could not be completed" }, 500);
    }

    return jsonResponse({ deleted: true }, 200);
  } catch (error) {
    console.error(
      "delete-customer-account unexpected failure:",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonResponse({ code: "INTERNAL_ERROR", error: "Account deletion is unavailable" }, 500);
  }
});
