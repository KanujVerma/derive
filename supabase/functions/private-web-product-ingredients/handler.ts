import { parseWebProductIngredientsRequest } from '../_shared/web-product-ingredients.ts';
import type { WebProductIngredientsRequest, WebProductIngredientsResult } from '../../../src/contracts/WebProductIngredients.ts';

interface Dependencies<T extends { userId: string }> {
  enabled: boolean; allowedUserIds: readonly string[];
  authenticate: (req: Request) => Promise<T>;
  lookup: (request: WebProductIngredientsRequest, identity: T) => Promise<WebProductIngredientsResult>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}
export async function handlePrivateWebProductIngredients<T extends { userId: string }>(req: Request, deps: Dependencies<T>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!deps.enabled || !deps.allowedUserIds.length) throw deps.failure('FEATURE_DISABLED', 'Private web ingredient testing is off', 503);
    const identity = await deps.authenticate(req);
    if (!deps.allowedUserIds.includes(identity.userId)) throw deps.failure('FORBIDDEN', 'Private tester access required', 403);
    if (!req.body) throw deps.failure('INVALID_PAYLOAD', 'A product identity is required', 400);
    const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > 4096) { await reader.cancel(); throw deps.failure('INVALID_PAYLOAD', 'Request is too large', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let query: WebProductIngredientsRequest;
    try { query = parseWebProductIngredientsRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
    catch { throw deps.failure('INVALID_PAYLOAD', 'A bounded product identity is required', 400); }
    const result = await deps.lookup(query, identity);
    return deps.respond(result, result.status === 'rate_limited' ? 429
      : ['configuration_required', 'unavailable'].includes(result.status) ? 503 : 200);
  } catch (error) { return deps.errorResponse(error); }
}
