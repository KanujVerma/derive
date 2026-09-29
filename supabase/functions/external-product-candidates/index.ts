import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { isValidGtin } from '../_shared/product-identity.ts';
import { lookupOpenBeautyFacts } from '../_shared/open-beauty-facts-candidate.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';

const USER_AGENT = 'Derive/0.1 (https://github.com/KanujVerma/derive)';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    // Never ship an external lookup to production by merely deploying its code.
    // A separate licensing, attribution, rate-control, and rollout review gates activation.
    if (Deno.env.get('DERIVE_OBF_CANDIDATES_ENABLED') !== 'true') {
      throw new ServiceError('FEATURE_DISABLED', 'External product lookup is not enabled', 503);
    }
    await authenticate(req);
    const body = await readJsonObject(req);
    if (Object.keys(body).length !== 1 || typeof body.barcode !== 'string'
      || !isValidGtin(body.barcode)) {
      throw new ServiceError('INVALID_BARCODE', 'A valid GTIN-8, UPC-A, EAN-13, or GTIN-14 is required', 400);
    }
    return jsonResponse(await lookupOpenBeautyFacts(body.barcode, { userAgent: USER_AGENT }));
  } catch (error) { return errorResponse(error); }
});
