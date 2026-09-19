import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.116.0";

export const commerceCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...commerceCorsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

export class CommerceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export interface AuthenticatedCommerceRuntime {
  user: User;
  admin: SupabaseClient;
}

export function commerceJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function commerceErrorResponse(error: unknown): Response {
  if (error instanceof CommerceError) {
    return commerceJson({ code: error.code, error: error.message }, error.status);
  }
  console.error("commerce function failed:", error instanceof Error ? error.name : "unknown");
  return commerceJson(
    { code: "COMMERCE_UNAVAILABLE", error: "Membership billing is temporarily unavailable" },
    500,
  );
}

export function trustedServerValue(name: string): string {
  const value = (Deno.env.get(name) ?? "").trim();
  if (!value) {
    console.error(`commerce server environment is missing ${name}`);
    throw new CommerceError(
      "COMMERCE_NOT_CONFIGURED",
      "Membership billing is not configured",
      503,
    );
  }
  return value;
}

export function trustedRedirectUrl(name: string): string {
  const raw = trustedServerValue(name);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error(`commerce server environment has invalid ${name}`);
    throw new CommerceError("COMMERCE_NOT_CONFIGURED", "Membership billing is not configured", 503);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    console.error(`commerce server environment has insecure ${name}`);
    throw new CommerceError("COMMERCE_NOT_CONFIGURED", "Membership billing is not configured", 503);
  }
  return url.toString();
}

export async function readCommerceBody(req: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 10_000) {
    throw new CommerceError("INVALID_PAYLOAD", "Request is too large", 413);
  }
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new CommerceError("INVALID_PAYLOAD", "A JSON object is required", 400);
  }
}

export function requireRequestId(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new CommerceError("INVALID_PAYLOAD", "requestId must be a UUID", 400);
  }
  return value;
}

export async function authenticateCommerceMember(req: Request): Promise<AuthenticatedCommerceRuntime> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new CommerceError("UNAUTHORIZED", "Sign in is required", 401);
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("commerce server Supabase environment is incomplete");
    throw new CommerceError("COMMERCE_NOT_CONFIGURED", "Membership billing is not configured", 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new CommerceError("UNAUTHORIZED", "Session is invalid or expired", 401);

  return {
    user,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
