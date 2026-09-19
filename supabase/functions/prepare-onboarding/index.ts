// Supabase Edge Function: prepare-onboarding
// DERIVE I1-B1.1 Transactional Intake Finalization, Auth Gate & Canonical Post-Commit Routing

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { MembershipEntitlementError, requireActiveMembership } from "../_shared/entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Authenticate caller from JWT (handler-level defense in depth)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return errorResponse("UNAUTHORIZED", "Invalid or expired session token", 401);
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    try {
      await requireActiveMembership(adminClient, userId);
    } catch (error) {
      if (error instanceof MembershipEntitlementError) {
        return errorResponse(error.code, error.message, error.status);
      }
      throw error;
    }

    // 2. Query for existing committed submission first (response-loss and repeat prepare protection)
    const { data: committedSub, error: committedErr } = await adminClient
      .from("onboarding_submissions")
      .select("id, status, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
      .eq("user_id", userId)
      .eq("status", "committed")
      .maybeSingle();

    if (committedErr) {
      console.error("prepare-onboarding committed check failed:", committedErr.code);
      return errorResponse("PREPARE_FAILED", "Failed checking onboarding state", 500);
    }

    const checkFileExists = async (path: string | null | undefined): Promise<boolean> => {
      if (!path) return false;
      try {
        const parts = path.split("/");
        if (parts.length < 3) return false;
        const folder = `${parts[0]}/${parts[1]}`;
        const filename = parts[2];
        const { data, error } = await adminClient.storage
          .from("customer-skin-photos")
          .list(folder, { search: filename });
        if (error || !data) return false;
        return data.some((item) => item.name === filename);
      } catch {
        return false;
      }
    };

    if (committedSub) {
      const [frontUploaded, leftUploaded, rightUploaded, shelfUploaded] = await Promise.all([
        checkFileExists(committedSub.front_storage_path),
        checkFileExists(committedSub.left_storage_path),
        checkFileExists(committedSub.right_storage_path),
        checkFileExists(committedSub.shelf_storage_path),
      ]);

      return new Response(
        JSON.stringify({
          submissionId: committedSub.id,
          submissionStatus: "committed",
          uploadTargets: {
            front: { path: committedSub.front_storage_path, uploaded: frontUploaded },
            left: { path: committedSub.left_storage_path, uploaded: leftUploaded },
            right: { path: committedSub.right_storage_path, uploaded: rightUploaded },
            shelf: committedSub.shelf_storage_path
              ? { path: committedSub.shelf_storage_path, uploaded: shelfUploaded }
              : undefined,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Query for existing draft in onboarding_submissions
    let targetDraft: {
      id: string;
      front_storage_path: string;
      left_storage_path: string;
      right_storage_path: string;
      shelf_storage_path: string | null;
    } | null = null;

    const { data: existingDraft, error: draftErr } = await adminClient
      .from("onboarding_submissions")
      .select("id, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
      .eq("user_id", userId)
      .eq("status", "draft")
      .maybeSingle();

    if (draftErr) {
      console.error("prepare-onboarding draft query failed:", draftErr.code);
      return errorResponse("PREPARE_FAILED", "Failed retrieving draft state", 500);
    }

    if (existingDraft) {
      targetDraft = existingDraft;
      // If shelf path is absent, generate it now
      if (!existingDraft.shelf_storage_path) {
        const shelfPath = `${userId}/shelf/${crypto.randomUUID()}.jpg`;
        await adminClient
          .from("onboarding_submissions")
          .update({ shelf_storage_path: shelfPath })
          .eq("id", existingDraft.id);
        targetDraft.shelf_storage_path = shelfPath;
      }
    } else {
      // 4. Create new draft with verified user-prefixed paths
      const submissionId = crypto.randomUUID();
      const frontPath = `${userId}/front/${crypto.randomUUID()}.jpg`;
      const leftPath = `${userId}/left/${crypto.randomUUID()}.jpg`;
      const rightPath = `${userId}/right/${crypto.randomUUID()}.jpg`;
      const shelfPath = `${userId}/shelf/${crypto.randomUUID()}.jpg`;

      const { error: insertErr } = await adminClient
        .from("onboarding_submissions")
        .insert({
          id: submissionId,
          user_id: userId,
          status: "draft",
          front_storage_path: frontPath,
          left_storage_path: leftPath,
          right_storage_path: rightPath,
          shelf_storage_path: shelfPath,
        });

      if (insertErr) {
        // Concurrency protection: if draft insert loses a uniqueness race (23505), re-query canonical draft
        if (insertErr.code === "23505") {
          const { data: racedDraft } = await adminClient
            .from("onboarding_submissions")
            .select("id, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
            .eq("user_id", userId)
            .eq("status", "draft")
            .maybeSingle();

          if (racedDraft) {
            targetDraft = racedDraft;
          } else {
            // Check if it committed during the race
            const { data: racedCommitted } = await adminClient
              .from("onboarding_submissions")
              .select("id, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
              .eq("user_id", userId)
              .eq("status", "committed")
              .maybeSingle();

            if (racedCommitted) {
              const [frontUp, leftUp, rightUp, shelfUp] = await Promise.all([
                checkFileExists(racedCommitted.front_storage_path),
                checkFileExists(racedCommitted.left_storage_path),
                checkFileExists(racedCommitted.right_storage_path),
                checkFileExists(racedCommitted.shelf_storage_path),
              ]);
              return new Response(
                JSON.stringify({
                  submissionId: racedCommitted.id,
                  submissionStatus: "committed",
                  uploadTargets: {
                    front: { path: racedCommitted.front_storage_path, uploaded: frontUp },
                    left: { path: racedCommitted.left_storage_path, uploaded: leftUp },
                    right: { path: racedCommitted.right_storage_path, uploaded: rightUp },
                    shelf: racedCommitted.shelf_storage_path
                      ? { path: racedCommitted.shelf_storage_path, uploaded: shelfUp }
                      : undefined,
                  },
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            }

            console.error("prepare-onboarding race resolution failed to find draft or committed submission");
            return errorResponse("PREPARE_FAILED", "Failed initializing onboarding draft", 500);
          }
        } else {
          console.error("prepare-onboarding draft insert failed:", insertErr.code);
          return errorResponse("PREPARE_FAILED", "Failed creating onboarding draft", 500);
        }
      } else {
        targetDraft = {
          id: submissionId,
          front_storage_path: frontPath,
          left_storage_path: leftPath,
          right_storage_path: rightPath,
          shelf_storage_path: shelfPath,
        };
      }
    }

    // 5. Check storage upload status for each target (resumption support)
    const [frontUploaded, leftUploaded, rightUploaded, shelfUploaded] = await Promise.all([
      checkFileExists(targetDraft.front_storage_path),
      checkFileExists(targetDraft.left_storage_path),
      checkFileExists(targetDraft.right_storage_path),
      checkFileExists(targetDraft.shelf_storage_path),
    ]);

    return new Response(
      JSON.stringify({
        submissionId: targetDraft.id,
        submissionStatus: "draft",
        uploadTargets: {
          front: { path: targetDraft.front_storage_path, uploaded: frontUploaded },
          left: { path: targetDraft.left_storage_path, uploaded: leftUploaded },
          right: { path: targetDraft.right_storage_path, uploaded: rightUploaded },
          shelf: targetDraft.shelf_storage_path
            ? { path: targetDraft.shelf_storage_path, uploaded: shelfUploaded }
            : undefined,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("prepare-onboarding unhandled error:", err?.message || "unknown");
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
});
