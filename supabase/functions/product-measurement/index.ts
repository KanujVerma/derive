import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import {
  MAX_PRODUCT_MEASUREMENT_BYTES,
  parseProductMeasurementJson,
} from '../_shared/product-measurement-ingress.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
};
class ServiceError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });
const errorResponse = (error: unknown): Response => {
  if (error instanceof ServiceError) {
    return jsonResponse({ code: error.code, error: error.message }, error.status);
  }
  console.error('product measurement request failed:', error instanceof Error ? error.name : 'unknown');
  return jsonResponse({ code: 'INGRESS_UNAVAILABLE', error: 'Product measurement is unavailable' }, 503);
};

async function authenticate(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ServiceError('UNAUTHORIZED', 'Authentication required', 401);
  }
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !serviceKey) {
    console.error('product measurement Supabase environment is incomplete');
    throw new ServiceError('INGRESS_UNAVAILABLE', 'Product measurement is unavailable', 503);
  }
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new ServiceError('UNAUTHORIZED', 'Invalid or expired session', 401);
  return {
    userId: user.id,
    admin: createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

async function readBoundedBody(req: Request): Promise<string> {
  const advertisedLength = req.headers.get('content-length');
  if (advertisedLength !== null) {
    const length = Number(advertisedLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PRODUCT_MEASUREMENT_BYTES) {
      throw new ServiceError('PAYLOAD_TOO_LARGE', 'Event is too large', 413);
    }
  }
  if (!req.body) throw new ServiceError('INVALID_PAYLOAD', 'A JSON event is required', 400);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PRODUCT_MEASUREMENT_BYTES) {
        await reader.cancel();
        throw new ServiceError('PAYLOAD_TOO_LARGE', 'Event is too large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new ServiceError('INVALID_PAYLOAD', 'A JSON event is required', 400); }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  // Default OFF until founders approve privacy choice, retention, disclosure,
  // and the release candidate. Installing this function never enables capture.
  if (Deno.env.get('MEASUREMENT_INGRESS_ENABLED') !== 'true') {
    return jsonResponse({ code: 'INGRESS_DISABLED', error: 'Product measurement is unavailable' }, 503);
  }
  try {
    const { admin, userId } = await authenticate(req); // verifies the JWT with Supabase Auth
    if (req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new ServiceError('INVALID_CONTENT_TYPE', 'JSON is required', 415);
    }
    const event = parseProductMeasurementJson(await readBoundedBody(req));
    if (!event) throw new ServiceError('INVALID_PAYLOAD', 'Event is invalid', 400);
    const { error } = await admin.rpc('record_product_measurement', {
      p_user_id: userId, p_event_name: event.event, p_properties: event.properties,
    });
    if (error) {
      if (error.message.includes('PRODUCT_MEASUREMENT_RATE_LIMIT')) {
        throw new ServiceError('RATE_LIMITED', 'Measurement is temporarily limited', 429);
      }
      if (error.message.includes('PRODUCT_MEASUREMENT_OWNER_UNAVAILABLE')) {
        throw new ServiceError('ACCOUNT_UNAVAILABLE', 'Account is unavailable', 409);
      }
      console.error('product measurement write failed:', error.code ?? 'unknown');
      throw new ServiceError('INGRESS_UNAVAILABLE', 'Product measurement is unavailable', 503);
    }
    return jsonResponse({ accepted: true }, 202);
  } catch (error) { return errorResponse(error); }
});
