import { parseIngredientRequest } from '../_shared/private-ingredient-search.ts';
import type { PrivateIngredientRequest, PrivateIngredientSearch } from '../../../src/contracts/PrivateIngredientSearch.ts';

interface Dependencies<T extends { userId: string }> {
  enabled: boolean; allowedUserIds: readonly string[];
  authenticate: (req: Request) => Promise<T>;
  search: (query: PrivateIngredientRequest, identity: T) => Promise<PrivateIngredientSearch>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}

export async function handlePrivateIngredientSearch<T extends { userId: string }>(req: Request, deps: Dependencies<T>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!deps.enabled || !deps.allowedUserIds.length) throw deps.failure('FEATURE_DISABLED', 'Private ingredient testing is off', 503);
    const identity = await deps.authenticate(req);
    if (!deps.allowedUserIds.includes(identity.userId)) throw deps.failure('FORBIDDEN', 'Private tester access required', 403);
    if (!req.body) throw deps.failure('INVALID_PAYLOAD', 'A product identity is required', 400);
    const reader = req.body.getReader();
    let text = '', length = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) { await reader.cancel(); throw deps.failure('INVALID_PAYLOAD', 'Request is too large', 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let query: PrivateIngredientRequest;
    try { query = parseIngredientRequest(JSON.parse(text)); }
    catch { throw deps.failure('INVALID_PAYLOAD', 'A bounded product identity is required', 400); }
    const result = await deps.search(query, identity);
    return deps.respond(result, result.status === 'rate_limited' ? 429
      : ['configuration_required', 'unavailable', 'personalization_disabled', 'context_unavailable'].includes(result.status) ? 503 : 200);
  } catch (error) { return deps.errorResponse(error); }
}
