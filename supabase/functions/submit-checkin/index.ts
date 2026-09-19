// Supabase Edge Function: submit-checkin
// DERIVE I1-B4B: authenticated weekly check-in persistence without an LLM provider.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { MembershipEntitlementError, requireActiveMembership } from "../_shared/entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTE_MAX_LENGTH = 4000;
const SKIN_STATES = new Set(["better", "same", "worse"]);
const IRRITATION_LEVELS = new Set(["none", "little", "lot"]);
const ADHERENCE_LEVELS = new Set(["yes", "mostly", "not_really"]);
const CONTEXT_TAGS = [
  "diet",
  "sleep",
  "stress",
  "alcohol",
  "cycle",
  "travel_weather",
  "new_product",
  "medication_supplement",
  "routine_change",
  "other",
] as const;
const CONTEXT_TAG_SET = new Set<string>(CONTEXT_TAGS);
const GOALS = new Set([
  "breakouts",
  "dark_spots",
  "dryness",
  "oiliness",
  "texture",
  "redness",
  "fine_lines",
  "simplify",
  "maintain",
]);

type ContextTag = (typeof CONTEXT_TAGS)[number];

function errorResponse(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function optionalText(value: unknown): string | undefined | "invalid" {
  if (value == null) return undefined;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > NOTE_MAX_LENGTH) return "invalid";
  return trimmed;
}

function normalizeContextTags(value: unknown): ContextTag[] | "invalid" {
  if (value == null) return [];
  if (!Array.isArray(value)) return "invalid";
  const seen = new Set<ContextTag>();
  for (const tag of value) {
    if (typeof tag !== "string" || !CONTEXT_TAG_SET.has(tag)) return "invalid";
    seen.add(tag as ContextTag);
  }
  return CONTEXT_TAGS.filter((tag) => seen.has(tag));
}

function authorAnalysis(input: {
  skinState: string;
  irritation: string;
  hasContext: boolean;
}): { sentence: string; adjustmentProposed: boolean } {
  const adjustmentProposed = input.irritation !== "none";
  let sentence: string;
  if (input.irritation !== "none") {
    sentence =
      "Check-in recorded. You reported some irritation, so Derive will treat this as a tolerance signal.";
  } else if (input.skinState === "worse") {
    sentence =
      "Check-in recorded. Your skin felt worse this week, and Derive will keep watching this trend.";
  } else {
    sentence = "Check-in recorded. Your skin appears stable based on what you reported.";
  }
  if (input.hasContext) {
    sentence += " Additional context recorded for longitudinal comparison.";
  }
  return { sentence, adjustmentProposed };
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
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }

    if (typeof body.userId === "string" && body.userId !== userId) {
      return errorResponse("UNAUTHORIZED", "Check-in could not be recorded.", 403);
    }

    if (typeof body.skinState !== "string" || !SKIN_STATES.has(body.skinState)) {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }
    if (typeof body.irritation !== "string" || !IRRITATION_LEVELS.has(body.irritation)) {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }

    let adherence: string | null = null;
    if (body.adherence != null) {
      if (typeof body.adherence !== "string" || !ADHERENCE_LEVELS.has(body.adherence)) {
        return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
      }
      adherence = body.adherence;
    }

    let primaryGoal: string | null = null;
    if (body.primaryGoal != null) {
      if (typeof body.primaryGoal !== "string" || !GOALS.has(body.primaryGoal)) {
        return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
      }
      primaryGoal = body.primaryGoal;
    }

    const contextTags = normalizeContextTags(body.contextTags);
    if (contextTags === "invalid") {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }

    const contextNote = optionalText(body.contextNote);
    if (contextNote === "invalid") {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }
    const notes = optionalText(body.notes);
    if (notes === "invalid") {
      return errorResponse("INVALID_PAYLOAD", "Check-in could not be recorded.", 400);
    }

    const hasContext = contextTags.length > 0 || Boolean(contextNote);
    const analysis = authorAnalysis({
      skinState: body.skinState,
      irritation: body.irritation,
      hasContext,
    });

    const { data: inserted, error: insertError } = await adminClient
      .from("check_ins")
      .insert({
        user_id: userId,
        skin_state: body.skinState,
        irritation: body.irritation,
        notes: notes ?? null,
        context_tags: contextTags,
        context_note: contextNote ?? null,
        adherence,
        primary_goal: primaryGoal,
        ai_analysis_sentence: analysis.sentence,
      })
      .select(
        "id, user_id, skin_state, irritation, notes, context_tags, context_note, adherence, primary_goal, ai_analysis_sentence, created_at"
      )
      .single();

    if (insertError || !inserted) {
      return errorResponse("PERSISTENCE_FAILED", "Check-in could not be recorded.", 500);
    }

    const checkIn = {
      id: inserted.id,
      userId: inserted.user_id,
      primaryGoal: inserted.primary_goal || undefined,
      skinState: inserted.skin_state,
      irritation: inserted.irritation,
      adherence: inserted.adherence || undefined,
      notes: inserted.notes || undefined,
      contextTags: inserted.context_tags || [],
      contextNote: inserted.context_note || undefined,
      aiAnalysisSentence: inserted.ai_analysis_sentence,
      adjustmentProposed: analysis.adjustmentProposed,
      createdAt: inserted.created_at,
    };

    return new Response(
      JSON.stringify({
        checkIn,
        aiAnalysisSentence: analysis.sentence,
        adjustmentProposed: analysis.adjustmentProposed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch {
    return errorResponse("INTERNAL_ERROR", "Check-in could not be recorded.", 500);
  }
});
