import { parseProductIngredientQuery } from '../_shared/product-ingredient-lookup.ts';
import type { ProductIngredientQuery, ProductIngredientLookup } from '../../../src/contracts/ProductIngredientLookup.ts';

interface Dependencies<T extends { userId: string }> {
  enabled: boolean; allowedUserIds: readonly string[];
  authenticate: (req: Request) => Promise<T>;
  lookup: (query: ProductIngredientQuery, identity: T) => Promise<ProductIngredientLookup>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (value: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}
export async function handleProductIngredients<T extends { userId: string }>(req: Request, deps: Dependencies<T>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!deps.enabled || !deps.allowedUserIds.length) throw deps.failure('FEATURE_DISABLED', 'Private ingredient lookup is off', 503);
    const identity = await deps.authenticate(req);
    if (!deps.allowedUserIds.includes(identity.userId)) throw deps.failure('FORBIDDEN', 'Private tester access required', 403);
    if (!req.body) throw deps.failure('INVALID_PAYLOAD', 'Product identity required', 400);
    const reader = req.body.getReader();
    const decoder = new TextDecoder(); let text = '', length = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw deps.failure('INVALID_PAYLOAD', 'Request too large', 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let query: ProductIngredientQuery;
    try { query = parseProductIngredientQuery(JSON.parse(text)); }
    catch { throw deps.failure('INVALID_PAYLOAD', 'A valid barcode and bounded identity are required', 400); }
    const result = await deps.lookup(query, identity);
    return deps.respond(result, result.status === 'rate_limited' ? 429 : result.status === 'unavailable' ? 503 : 200);
  } catch (error) { return deps.errorResponse(error); }
}
