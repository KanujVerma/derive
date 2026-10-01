import { isValidGtin } from '../_shared/product-identity.ts';
import type { UpcItemDbLookup } from '../_shared/upcitemdb-candidate.ts';

interface Dependencies<TAuth extends { userId: string }> {
  enabled: boolean;
  allowedUserIds: readonly string[];
  authenticate: (request: Request) => Promise<TAuth>;
  readJsonObject: (request: Request) => Promise<Record<string, unknown>>;
  lookup: (barcode: string, identity: TAuth) => Promise<UpcItemDbLookup>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}

export async function handlePrivateUpcLookup<TAuth extends { userId: string }>(req: Request, deps: Dependencies<TAuth>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    if (!deps.enabled || deps.allowedUserIds.length === 0) {
      throw deps.failure('FEATURE_DISABLED', 'Private barcode testing is not enabled', 503);
    }
    const identity = await deps.authenticate(req);
    const { userId } = identity;
    if (!deps.allowedUserIds.includes(userId)) throw deps.failure('FORBIDDEN', 'Private tester access required', 403);
    const body = await deps.readJsonObject(req);
    if (Object.keys(body).length !== 1 || typeof body.barcode !== 'string' || !isValidGtin(body.barcode)) {
      throw deps.failure('INVALID_BARCODE', 'Enter a valid product barcode', 400);
    }
    const result = await deps.lookup(body.barcode, identity);
    const status = result.status === 'rate_limited' ? 429
      : ['unavailable', 'configuration_required', 'disabled'].includes(result.status) ? 503 : 200;
    return deps.respond(result, status);
  } catch (error) { return deps.errorResponse(error); }
}
