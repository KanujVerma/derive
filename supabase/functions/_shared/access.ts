import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.39.8";

export type IdentityKind = "anonymous" | "permanent";

/** Use only a user returned by Supabase Auth, never caller-supplied metadata. */
export function identityKindFromVerifiedUser(user: Pick<User, "is_anonymous">): IdentityKind {
  if (user.is_anonymous === true) return "anonymous";
  if (user.is_anonymous === false) return "permanent";
  throw new Error("IDENTITY_UNAVAILABLE");
}

export async function resolveIdentityKind(admin: SupabaseClient, userId: string): Promise<IdentityKind> {
  const { data: { user }, error } = await admin.auth.admin.getUserById(userId);
  if (error || !user) throw new Error("IDENTITY_UNAVAILABLE");
  return identityKindFromVerifiedUser(user);
}
