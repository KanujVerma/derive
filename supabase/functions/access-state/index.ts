import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { FreeAccessState, ManagedMembershipStatus } from "../../../src/contracts/FreeAccess.ts";
import { identityKindFromVerifiedUser } from "../_shared/access.ts";
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from "../_shared/runtime.ts";

const STATUSES = new Set<ManagedMembershipStatus>(["active", "paused", "cancelled"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "POST required" }, 405);
  try {
    const { userId, user, admin } = await authenticate(req);
    let identityKind;
    try { identityKind = identityKindFromVerifiedUser(user); }
    catch { throw new ServiceError("IDENTITY_UNAVAILABLE", "Account identity could not be verified", 503); }

    let managedMembershipStatus: ManagedMembershipStatus = "none";
    if (identityKind === "permanent") {
      const { data, error } = await admin.from("memberships")
        .select("status")
        .eq("user_id", userId)
        .order("last_stripe_event_created_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (error || (data && !STATUSES.has(data.status))) {
        throw new ServiceError("ACCESS_UNAVAILABLE", "Account access could not be verified", 503);
      }
      managedMembershipStatus = (data?.status as ManagedMembershipStatus | undefined) ?? "none";
    }
    const state: FreeAccessState = {
      userId,
      identityKind,
      freeProductAccess: true,
      managedMembershipStatus,
      managedAccess: identityKind === "permanent" && managedMembershipStatus === "active",
    };
    return jsonResponse(state);
  } catch (error) { return errorResponse(error); }
});
