import { parseIngredientExplanationRequest } from '../_shared/ingredient-explanation-runtime.ts';
import type { IngredientExplanationRequest, IngredientExplanationResult } from '../../../src/contracts/IngredientExplanation.ts';

interface Dependencies<T extends { userId: string }> {
  enabled: boolean; allowedUserIds: readonly string[];
  authenticate: (req: Request) => Promise<T>;
  explain: (query: IngredientExplanationRequest, identity: T) => Promise<IngredientExplanationResult>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}

export async function handleIngredientExplanation<T extends { userId: string }>(req: Request, deps: Dependencies<T>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!deps.enabled || !deps.allowedUserIds.length) throw deps.failure('FEATURE_DISABLED', 'Private explanation testing is off', 503);
    const identity = await deps.authenticate(req);
    if (!deps.allowedUserIds.includes(identity.userId)) throw deps.failure('FORBIDDEN', 'Private tester access required', 403);
    if (!req.body) throw deps.failure('INVALID_PAYLOAD', 'Product ingredients are required', 400);
    const reader = req.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 32_768) { await reader.cancel(); throw deps.failure('INVALID_PAYLOAD', 'Request is too large', 413); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error instanceof TypeError) throw deps.failure('INVALID_PAYLOAD', 'Invalid request encoding', 400);
      throw error;
    } finally { reader.releaseLock(); }
    let query: IngredientExplanationRequest;
    try { query = parseIngredientExplanationRequest(JSON.parse(text)); }
    catch { throw deps.failure('INVALID_PAYLOAD', 'Bounded ingredients and explicit consent are required', 400); }
    const result = await deps.explain(query, identity);
    return deps.respond(result, result.status === 'rate_limited' ? 429
      : ['configuration_required', 'unavailable', 'personalization_disabled', 'context_unavailable'].includes(result.status) ? 503 : 200);
  } catch (error) { return deps.errorResponse(error); }
}
