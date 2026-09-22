// Supabase Edge Function: onboard-customer
// DERIVE I1-B1.1 Transactional Intake Finalization, Auth Gate & Canonical Post-Commit Routing

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { diagnosticErrorHeaders, withDiagnosticResponse } from "../_shared/diagnostics.ts";
import { MembershipEntitlementError, requireActiveMembership } from "../_shared/entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-derive-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { ...corsHeaders, ...diagnosticErrorHeaders(code), "Content-Type": "application/json" },
  });
}

function mapSkinProfileRow(row: any, userId: string) {
  return {
    id: row.id,
    userId,
    primaryGoal: row.primary_goal,
    secondaryGoals: row.secondary_goals || [],
    routineComplexity: row.routine_complexity,
    costPreference: row.cost_preference,
    middayFeel: row.midday_feel,
    postCleanseTightness: row.post_cleanse_tightness ?? false,
    knownSensitivities: row.known_sensitivities || [],
    sensitivitiesStatus: row.sensitivities_status || "unanswered",
    activePrescriptions: row.active_prescriptions || [],
    isPregnantOrNursing: row.is_pregnant_or_nursing ?? false,
    pregnancyStatus: row.pregnancy_status || "unanswered",
    additionalNotes: row.additional_notes || null,
    onboardingCompleted: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

Deno.serve((req: Request) => withDiagnosticResponse(req, "onboarding_commit", async () => {
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

    // 2. Parse request body
    const rawBody = await req.json();
    const requestedSubmissionId: string | undefined = rawBody.submissionId;
    const payload = rawBody.payload || rawBody;

    // 3. Response-loss & Idempotent Replay Check:
    // Check if the submission (or user's initial intake) is ALREADY committed
    let committedQuery = adminClient
      .from("onboarding_submissions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "committed");

    if (requestedSubmissionId) {
      committedQuery = committedQuery.eq("id", requestedSubmissionId);
    }

    const { data: alreadyCommitted } = await committedQuery.maybeSingle();

    if (alreadyCommitted) {
      // Replay canonical committed result without repeating relational writes
      const { data: skinProfileRow, error: fetchErr } = await adminClient
        .from("skin_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!fetchErr && skinProfileRow && skinProfileRow.onboarding_completed) {
        return new Response(
          JSON.stringify({
            userId,
            skinProfile: mapSkinProfileRow(skinProfileRow, userId),
            proposedRoutine: null,
            userProducts: [],
            initialRoutineState: "pending_generation",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 4. Validate payload requirements
    if (!payload.primaryGoal) return errorResponse("INVALID_PAYLOAD", "Missing required field: primaryGoal");
    if (!payload.routineComplexity) return errorResponse("INVALID_PAYLOAD", "Missing required field: routineComplexity");
    if (!payload.costPreference) return errorResponse("INVALID_PAYLOAD", "Missing required field: costPreference");
    if (!payload.middayFeel) return errorResponse("INVALID_PAYLOAD", "Missing required field: middayFeel");

    // Safety consistency validation
    const pregnancyStatus = payload.safetyContext?.pregnancyStatus ?? "unanswered";
    const isPregnantOrNursing = payload.safetyContext?.isPregnantOrNursing ?? false;

    if (pregnancyStatus === "yes" && !isPregnantOrNursing) {
      return errorResponse("INVALID_PAYLOAD", "Safety contradiction: isPregnantOrNursing must be true when pregnancyStatus is yes");
    }
    if (pregnancyStatus !== "yes" && isPregnantOrNursing) {
      return errorResponse("INVALID_PAYLOAD", "Safety contradiction: isPregnantOrNursing cannot be true when pregnancyStatus is not yes");
    }

    const sensitivitiesStatus = payload.safetyContext?.sensitivitiesStatus ?? "unanswered";
    const knownSensitivities = payload.safetyContext?.knownSensitivities ?? [];

    if (sensitivitiesStatus === "reported" && knownSensitivities.length === 0) {
      return errorResponse("INVALID_PAYLOAD", "Safety contradiction: reported sensitivities requires non-empty knownSensitivities");
    }
    if (sensitivitiesStatus === "none_known" && knownSensitivities.length > 0) {
      return errorResponse("INVALID_PAYLOAD", "Safety contradiction: none_known sensitivities contradicts provided sensitivities");
    }

    // 5. Query active draft
    let draftQuery = adminClient
      .from("onboarding_submissions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft");

    if (requestedSubmissionId) {
      draftQuery = draftQuery.eq("id", requestedSubmissionId);
    }

    const { data: draft, error: draftErr } = await draftQuery.maybeSingle();
    if (draftErr || !draft) {
      // Check if another concurrent request just committed it
      const { data: racedCommit } = await adminClient
        .from("onboarding_submissions")
        .select("id, status")
        .eq("user_id", userId)
        .eq("status", "committed")
        .maybeSingle();

      if (racedCommit) {
        const { data: skinProfileRow } = await adminClient
          .from("skin_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (skinProfileRow && skinProfileRow.onboarding_completed) {
          return new Response(
            JSON.stringify({
              userId,
              skinProfile: mapSkinProfileRow(skinProfileRow, userId),
              proposedRoutine: null,
              userProducts: [],
              initialRoutineState: "pending_generation",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return errorResponse("NO_ACTIVE_DRAFT", "No active draft onboarding submission found for user", 404);
    }

    // 6. Photo path defense in depth (verify paths belong to caller's userId and expected folders)
    const expectedFrontPrefix = `${userId}/front/`;
    const expectedLeftPrefix = `${userId}/left/`;
    const expectedRightPrefix = `${userId}/right/`;
    const expectedShelfPrefix = `${userId}/shelf/`;

    if (!draft.front_storage_path.startsWith(expectedFrontPrefix)) {
      return errorResponse("INVALID_INTAKE", "Front photo path unauthorized or invalid", 400);
    }
    if (!draft.left_storage_path.startsWith(expectedLeftPrefix)) {
      return errorResponse("INVALID_INTAKE", "Left photo path unauthorized or invalid", 400);
    }
    if (!draft.right_storage_path.startsWith(expectedRightPrefix)) {
      return errorResponse("INVALID_INTAKE", "Right photo path unauthorized or invalid", 400);
    }
    if (draft.shelf_storage_path && !draft.shelf_storage_path.startsWith(expectedShelfPrefix)) {
      return errorResponse("INVALID_INTAKE", "Shelf photo path unauthorized or invalid", 400);
    }

    // 7. Verify storage objects exist in private customer-skin-photos bucket
    const verifyObjectExists = async (path: string | null | undefined): Promise<boolean> => {
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

    const [frontExists, leftExists, rightExists] = await Promise.all([
      verifyObjectExists(draft.front_storage_path),
      verifyObjectExists(draft.left_storage_path),
      verifyObjectExists(draft.right_storage_path),
    ]);

    if (!frontExists) return errorResponse("PHOTO_VERIFICATION_FAILED", "Missing required front photo in storage");
    if (!leftExists) return errorResponse("PHOTO_VERIFICATION_FAILED", "Missing required left photo in storage");
    if (!rightExists) return errorResponse("PHOTO_VERIFICATION_FAILED", "Missing required right photo in storage");

    const hasShelfPhoto = draft.shelf_storage_path
      ? await verifyObjectExists(draft.shelf_storage_path)
      : false;

    // 8. Sanitize snapshot (strictly strip local file/ph/content URIs)
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

    // 9. Prepare atomic relational parameters
    const photosToInsert = [
      { photo_type: "front", storage_path: draft.front_storage_path },
      { photo_type: "left", storage_path: draft.left_storage_path },
      { photo_type: "right", storage_path: draft.right_storage_path },
    ];
    if (hasShelfPhoto && draft.shelf_storage_path) {
      photosToInsert.push({
        photo_type: "shelf",
        storage_path: draft.shelf_storage_path,
      });
    }

    const skinProfileInput = {
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
    };

    // 10. Execute atomic transactional finalization RPC in PostgreSQL
    const { data: finalizedSkinProfile, error: rpcErr } = await adminClient.rpc(
      "commit_onboarding_intake",
      {
        p_submission_id: draft.id,
        p_user_id: userId,
        p_payload_snapshot: sanitizedSnapshot,
        p_skin_profile: skinProfileInput,
        p_photos: photosToInsert,
        p_task_notes: "Intake committed. Initial routine pending review.",
      }
    );

    if (rpcErr || !finalizedSkinProfile) {
      console.error("onboard-customer RPC execution failed:", rpcErr?.code ?? "unknown");
      return errorResponse("ONBOARDING_COMMIT_FAILED", "Failed to finalize onboarding intake", 500);
    }

    // 11. Return canonical OnboardingResult
    const result = {
      userId,
      skinProfile: mapSkinProfileRow(finalizedSkinProfile, userId),
      proposedRoutine: null,
      userProducts: [],
      initialRoutineState: "pending_generation",
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("onboard-customer unhandled error:", err instanceof Error ? err.name : "unknown");
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}));
