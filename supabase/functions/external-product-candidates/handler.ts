import { isValidGtin } from '../_shared/product-identity.ts';
import type { OpenBeautyFactsLookup } from '../_shared/open-beauty-facts-candidate.ts';

interface CandidateHandlerDependencies {
  enabled: boolean;
  authenticate: (request: Request) => Promise<unknown>;
  readJsonObject: (request: Request) => Promise<Record<string, unknown>>;
  lookup: (barcode: string) => Promise<OpenBeautyFactsLookup>;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}

/** HTTP boundary is injectable so OFF/auth/input/provider behavior is testable without hosted access. */
export async function handleExternalCandidateRequest(req: Request, deps: CandidateHandlerDependencies): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (req.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    // Never ship an external lookup to production by merely deploying its code.
    if (!deps.enabled) throw deps.failure('FEATURE_DISABLED', 'External product lookup is not enabled', 503);
    await deps.authenticate(req);
    const body = await deps.readJsonObject(req);
    if (Object.keys(body).length !== 1 || typeof body.barcode !== 'string' || !isValidGtin(body.barcode)) {
      throw deps.failure('INVALID_BARCODE', 'A valid GTIN-8, UPC-A, EAN-13, or GTIN-14 is required', 400);
    }
    const result = await deps.lookup(body.barcode);
    // Upstream throttling must be visible to future callers. Do not retry here.
    return deps.respond(result, result.status === 'rate_limited' ? 429 : 200);
  } catch (error) { return deps.errorResponse(error); }
}
