import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { ProductResolutionResult } from '../../../src/contracts/ProductIdentityResolver.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { handleProductLink } from './handler.ts';

const states = new Set(['verified_product_formula', 'identified_formula_unverified', 'ambiguous_candidates', 'formula_only', 'insufficient_evidence']);

Deno.serve((request: Request) => handleProductLink(request, {
  authenticate, readJsonObject, corsHeaders, errorResponse, respond: jsonResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  // The DailyMed path is deliberately off until hosted migration, quota, and
  // customer-copy review. Barcode URLs use only Derive's internal resolver.
  dailyMedEnabled: Deno.env.get('DERIVE_DAILYMED_LINK_ENABLED') === 'true',
  reserveExternalLookup: async ({ admin, userId }) => {
    const { error } = await admin.rpc('reserve_external_candidate_lookup', { p_user_id: userId });
    if (!error) return;
    if (error.message?.includes('EXTERNAL_CANDIDATE_USER_LIMIT')
        || error.message?.includes('EXTERNAL_CANDIDATE_GLOBAL_LIMIT')) {
      throw new ServiceError('RATE_LIMITED', 'Label lookup is temporarily limited', 429);
    }
    console.error('product link reservation failed:', error.code ?? 'unknown');
    throw new ServiceError('BUDGET_UNAVAILABLE', 'Label lookup is unavailable', 503);
  },
  resolveBarcode: async (_identity, requestId, barcode, originalRequest) => {
    // Forward the caller's JWT; never invoke the owner-bound resolver with a
    // service-role token. The URL is trusted deployment config, not user input.
    const base = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!base || !anonKey) throw new ServiceError('RESOLUTION_UNAVAILABLE', 'Product resolution is unavailable', 503);
    const destination = new URL('/functions/v1/resolve-product-identity', base);
    const response = await fetch(destination, {
      method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', Authorization: originalRequest.headers.get('Authorization') ?? '', apikey: anonKey },
      body: JSON.stringify({ requestId, consumer: 'scan', barcode }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => { throw new ServiceError('RESOLUTION_UNAVAILABLE', 'Product resolution is unavailable', 503); });
    if (response.status === 429) throw new ServiceError('RATE_LIMITED', 'Product lookup is temporarily limited', 429);
    if (!response.ok) {
      console.error('product link resolver failed:', response.status);
      throw new ServiceError('RESOLUTION_UNAVAILABLE', 'Product resolution is unavailable', 503);
    }
    let result: unknown;
    try { result = await response.json(); } catch { throw new ServiceError('RESOLUTION_UNAVAILABLE', 'Product resolution is unavailable', 503); }
    if (!result || typeof result !== 'object' || Array.isArray(result)
        || typeof (result as Record<string, unknown>).caseId !== 'string'
        || !states.has(String((result as Record<string, unknown>).state))) {
      throw new ServiceError('RESOLUTION_UNAVAILABLE', 'Product resolution is unavailable', 503);
    }
    return result as ProductResolutionResult;
  },
}));
