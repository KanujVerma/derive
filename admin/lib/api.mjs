const SESSION_KEY = "derive-founder-session-v1";

export class ApiError extends Error {
  constructor(message, code = "REQUEST_FAILED", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function config() {
  const value = window.DERIVE_ADMIN_CONFIG ?? {};
  const supabaseUrl = String(value.supabaseUrl ?? "").replace(/\/$/, "");
  const supabasePublishableKey = String(value.supabasePublishableKey ?? "").trim();
  if (!/^https?:\/\//.test(supabaseUrl) || !supabasePublishableKey) {
    throw new ApiError("Admin configuration is missing. Copy config.example.js to config.js and add the public Supabase values.", "CONFIG_MISSING");
  }
  if (supabasePublishableKey.startsWith("sb_secret_") || /service.role/i.test(supabasePublishableKey)) {
    throw new ApiError("A server secret was placed in browser configuration. Remove it immediately and rotate the key.", "SECRET_EXPOSED");
  }
  return { supabaseUrl, supabasePublishableKey };
}

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return session?.access_token && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error_description || payload.error || "Request failed", payload.code, response.status);
  }
  return payload;
}

export async function signIn(email, password) {
  const { supabaseUrl, supabasePublishableKey } = config();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const session = await parseResponse(response);
  writeSession(session);
  return session;
}

async function refreshSession(session) {
  const { supabaseUrl, supabasePublishableKey } = config();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const next = await parseResponse(response);
  writeSession(next);
  return next;
}

export function hasSession() {
  return Boolean(readSession());
}

export function signOut() {
  writeSession(null);
}

export function requestId() {
  return crypto.randomUUID();
}

export async function founderRequest(action, input = {}, retry = true) {
  const { supabaseUrl, supabasePublishableKey } = config();
  let session = readSession();
  if (!session) throw new ApiError("Sign in is required.", "UNAUTHORIZED", 401);
  const response = await fetch(`${supabaseUrl}/functions/v1/founder-operations`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...input }),
  });
  if (response.status === 401 && retry) {
    try {
      session = await refreshSession(session);
    } catch {
      writeSession(null);
      throw new ApiError("Your session expired. Sign in again.", "UNAUTHORIZED", 401);
    }
    return founderRequest(action, input, false);
  }
  return parseResponse(response);
}
