import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import { resolveIdentityKind } from "./access.ts";

export class MembershipEntitlementError extends Error {
  constructor(
    readonly code: "MEMBERSHIP_REQUIRED" | "MEMBERSHIP_UNAVAILABLE" | "PERMANENT_ACCOUNT_REQUIRED",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Resolve the same latest membership projection used by S5 billing. */
export async function requireActiveMembership(admin: SupabaseClient, userId: string): Promise<void> {
  let identityKind;
  try {
    identityKind = await resolveIdentityKind(admin, userId);
  } catch {
    throw new MembershipEntitlementError(
      "MEMBERSHIP_UNAVAILABLE", "Account identity could not be verified", 503,
    );
  }
  if (identityKind !== "permanent") {
    throw new MembershipEntitlementError(
      "PERMANENT_ACCOUNT_REQUIRED", "A permanent account is required for Managed Skincare", 403,
    );
  }
  const { data, error } = await admin.from("memberships")
    .select("status")
    .eq("user_id", userId)
    .order("last_stripe_event_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("membership entitlement lookup failed:", error.code);
    throw new MembershipEntitlementError(
      "MEMBERSHIP_UNAVAILABLE", "Membership could not be verified", 503,
    );
  }
  if (data?.status !== "active") {
    throw new MembershipEntitlementError(
      "MEMBERSHIP_REQUIRED", "An active Derive membership is required", 403,
    );
  }
}
