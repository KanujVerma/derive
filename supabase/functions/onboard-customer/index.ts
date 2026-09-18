// Supabase Edge Function: onboard-customer
// DERIVE I1-B1 Authenticated Remote Onboarding Intake Commit & Private Photo Pipeline

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
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
      return errorResponse("Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Authenticate caller from JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Parse and validate payload
    const rawBody = await req.json();
    const submissionId = rawBody.submissionId;
    const payload = rawBody.payload || rawBody;

    if (!payload.primaryGoal) return errorResponse("Missing required field: primaryGoal");
    if (!payload.routineComplexity) return errorResponse("Missing required field: routineComplexity");
    if (!payload.costPreference) return errorResponse("Missing required field: costPreference");
    if (!payload.middayFeel) return errorResponse("Missing required field: middayFeel");

    // Safety consistency validation
    const pregnancyStatus = payload.safetyContext?.pregnancyStatus ?? "unanswered";
    const isPregnantOrNursing = payload.safetyContext?.isPregnantOrNursing ?? false;

    if (pregnancyStatus === "yes" && !isPregnantOrNursing) {
      return errorResponse("Safety contradiction: isPregnantOrNursing must be true when pregnancyStatus is yes");
    }
    if (pregnancyStatus !== "yes" && isPregnantOrNursing) {
      return errorResponse("Safety contradiction: isPregnantOrNursing cannot be true when pregnancyStatus is not yes");
    }

    const sensitivitiesStatus = payload.safetyContext?.sensitivitiesStatus ?? "unanswered";
    const knownSensitivities = payload.safetyContext?.knownSensitivities ?? [];

    if (sensitivitiesStatus === "reported" && knownSensitivities.length === 0) {
      return errorResponse("Safety contradiction: reported sensitivities requires non-empty knownSensitivities");
    }
    if (sensitivitiesStatus === "none_known" && knownSensitivities.length > 0) {
      return errorResponse("Safety contradiction: none_known sensitivities contradicts provided sensitivities");
    }

    // 3. Find active draft in onboarding_submissions
    let draftQuery = adminClient
      .from("onboarding_submissions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft");

    if (submissionId) {
      draftQuery = draftQuery.eq("id", submissionId);
    }

    const { data: draft, error: draftErr } = await draftQuery.maybeSingle();
    if (draftErr || !draft) {
      return errorResponse("No active draft onboarding submission found for user");
    }

    // 4. Verify storage objects exist in customer-skin-photos
    const verifyObjectExists = async (path: string): Promise<boolean> => {
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

    const [frontExists, leftExists, rightExists] = await Promise.all([
      verifyObjectExists(draft.front_storage_path),
      verifyObjectExists(draft.left_storage_path),
      verifyObjectExists(draft.right_storage_path),
    ]);

    if (!frontExists) return errorResponse("Missing required front photo in storage");
    if (!leftExists) return errorResponse("Missing required left photo in storage");
    if (!rightExists) return errorResponse("Missing required right photo in storage");

    const hasShelfPhoto = draft.shelf_storage_path
      ? await verifyObjectExists(draft.shelf_storage_path)
      : false;

    // 5. Sanitize snapshot (strip local file/ph URIs)
    const sanitizedSnapshot = {
      primaryGoal: payload.primaryGoal,
      secondaryGoals: payload.secondaryGoals || [],
      routineComplexity: payload.routineComplexity,
      costPreference: payload.costPreference,
      middayFeel: payload.middayFeel,
      postCleanseTightness: payload.postCleanseTightness ?? false,
      confirmedProducts: payload.confirmedProducts || [],
      productReactions: payload.productReactions || [],
      formulaSnapshots: payload.formulaSnapshots || [],
      adaptiveFollowUps: payload.adaptiveFollowUps || [],
      pihTendencyAnswer: payload.pihTendencyAnswer ?? null,
      hasBadReactions: payload.hasBadReactions ?? null,
      safetyContext: {
        knownSensitivities,
        sensitivitiesStatus,
        activePrescriptions: payload.safetyContext?.activePrescriptions || [],
        isPregnantOrNursing,
        pregnancyStatus,
        additionalNotes: payload.safetyContext?.additionalNotes || null,
      },
      skinPhotos: {
        frontStoragePath: draft.front_storage_path,
        leftStoragePath: draft.left_storage_path,
        rightStoragePath: draft.right_storage_path,
        shelfStoragePath: hasShelfPhoto ? draft.shelf_storage_path : null,
        contextNote: payload.skinPhotos?.contextNote || null,
      },
    };

    // 6. Commit Step 1: Update onboarding_submissions status to committed
    const { error: commitDraftErr } = await adminClient
      .from("onboarding_submissions")
      .update({
        payload_snapshot: sanitizedSnapshot,
        status: "committed",
        committed_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    if (commitDraftErr) {
      return errorResponse(`Failed committing onboarding submission: ${commitDraftErr.message}`, 500);
    }

    // 7. Commit Step 2: Upsert public.skin_profiles with onboarding_completed = false
    const { data: skinProfileRow, error: skinErr } = await adminClient
      .from("skin_profiles")
      .upsert(
        {
          user_id: userId,
          primary_goal: payload.primaryGoal,
          secondary_goals: payload.secondaryGoals || [],
          routine_complexity: payload.routineComplexity,
          cost_preference: payload.costPreference,
          midday_feel: payload.middayFeel,
          post_cleanse_tightness: payload.postCleanseTightness ?? false,
          known_sensitivities: knownSensitivities,
          sensitivities_status: sensitivitiesStatus,
          active_prescriptions: payload.safetyContext?.activePrescriptions || [],
          is_pregnant_or_nursing: isPregnantOrNursing,
          pregnancy_status: pregnancyStatus,
          additional_notes: payload.safetyContext?.additionalNotes || null,
          onboarding_completed: false,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (skinErr || !skinProfileRow) {
      return errorResponse(`Failed persisting skin profile: ${skinErr?.message}`, 500);
    }

    // 8. Commit Step 3: Insert public.user_photos
    const photosToInsert = [
      { user_id: userId, photo_type: "front", storage_path: draft.front_storage_path },
      { user_id: userId, photo_type: "left", storage_path: draft.left_storage_path },
      { user_id: userId, photo_type: "right", storage_path: draft.right_storage_path },
    ];
    if (hasShelfPhoto && draft.shelf_storage_path) {
      photosToInsert.push({
        user_id: userId,
        photo_type: "shelf",
        storage_path: draft.shelf_storage_path,
      });
    }

    const { error: photosErr } = await adminClient
      .from("user_photos")
      .insert(photosToInsert);

    if (photosErr) {
      return errorResponse(`Failed recording photo metadata: ${photosErr.message}`, 500);
    }

    // 9. Commit Step 4: Create pending initial_routine founder review task (idempotent)
    const { data: existingTask } = await adminClient
      .from("founder_review_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("task_type", "initial_routine")
      .eq("status", "pending")
      .maybeSingle();

    if (!existingTask) {
      const { error: taskErr } = await adminClient
        .from("founder_review_tasks")
        .insert({
          user_id: userId,
          task_type: "initial_routine",
          status: "pending",
          priority: "normal",
          notes: "Intake committed. Initial routine pending review.",
        });

      if (taskErr && taskErr.code !== "23505") {
        return errorResponse(`Failed creating founder review task: ${taskErr.message}`, 500);
      }
    }

    // 10. Commit Step 5: STRICTLY LAST - set onboarding_completed = true
    const { error: completeErr } = await adminClient
      .from("skin_profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    if (completeErr) {
      return errorResponse(`Failed completing skin profile: ${completeErr.message}`, 500);
    }

    // 11. Return canonical OnboardingResult
    const result = {
      userId,
      skinProfile: {
        id: skinProfileRow.id,
        userId,
        primaryGoal: payload.primaryGoal,
        secondaryGoals: payload.secondaryGoals || [],
        routineComplexity: payload.routineComplexity,
        costPreference: payload.costPreference,
        middayFeel: payload.middayFeel,
        postCleanseTightness: payload.postCleanseTightness ?? false,
        knownSensitivities,
        sensitivitiesStatus,
        activePrescriptions: payload.safetyContext?.activePrescriptions || [],
        isPregnantOrNursing,
        pregnancyStatus,
        additionalNotes: payload.safetyContext?.additionalNotes,
        onboardingCompleted: true,
        createdAt: skinProfileRow.created_at,
        updatedAt: new Date().toISOString(),
      },
      proposedRoutine: null,
      userProducts: [],
      initialRoutineState: "pending_generation",
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return errorResponse(err?.message || "Internal server error", 500);
  }
});
