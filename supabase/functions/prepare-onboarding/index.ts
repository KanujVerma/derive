// Supabase Edge Function: prepare-onboarding
// DERIVE I1-B1 Authenticated Remote Onboarding Intake Commit & Private Photo Pipeline

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Authenticate user from caller's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Query for existing draft in onboarding_submissions
    const { data: existingDraft, error: draftErr } = await adminClient
      .from("onboarding_submissions")
      .select("id, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path")
      .eq("user_id", userId)
      .eq("status", "draft")
      .maybeSingle();

    if (draftErr) {
      return new Response(JSON.stringify({ error: draftErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let submissionId: string;
    let frontPath: string;
    let leftPath: string;
    let rightPath: string;
    let shelfPath: string;

    if (existingDraft) {
      submissionId = existingDraft.id;
      frontPath = existingDraft.front_storage_path;
      leftPath = existingDraft.left_storage_path;
      rightPath = existingDraft.right_storage_path;
      shelfPath = existingDraft.shelf_storage_path || `${userId}/shelf/${crypto.randomUUID()}.jpg`;

      if (!existingDraft.shelf_storage_path) {
        await adminClient
          .from("onboarding_submissions")
          .update({ shelf_storage_path: shelfPath })
          .eq("id", submissionId);
      }
    } else {
      submissionId = crypto.randomUUID();
      frontPath = `${userId}/front/${crypto.randomUUID()}.jpg`;
      leftPath = `${userId}/left/${crypto.randomUUID()}.jpg`;
      rightPath = `${userId}/right/${crypto.randomUUID()}.jpg`;
      shelfPath = `${userId}/shelf/${crypto.randomUUID()}.jpg`;

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
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Check storage upload status for each target (resumption support)
    const checkFileExists = async (path: string): Promise<boolean> => {
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

    const [frontUploaded, leftUploaded, rightUploaded, shelfUploaded] = await Promise.all([
      checkFileExists(frontPath),
      checkFileExists(leftPath),
      checkFileExists(rightPath),
      checkFileExists(shelfPath),
    ]);

    return new Response(
      JSON.stringify({
        submissionId,
        uploadTargets: {
          front: { path: frontPath, uploaded: frontUploaded },
          left: { path: leftPath, uploaded: leftUploaded },
          right: { path: rightPath, uploaded: rightUploaded },
          shelf: { path: shelfPath, uploaded: shelfUploaded },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
