import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { lookupOpenBeautyFacts } from '../_shared/open-beauty-facts-candidate.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { handleExternalCandidateRequest } from './handler.ts';

const USER_AGENT = 'Derive/0.1 (https://github.com/KanujVerma/derive)';

Deno.serve((req: Request) => handleExternalCandidateRequest(req, {
  enabled: Deno.env.get('DERIVE_OBF_CANDIDATES_ENABLED') === 'true',
  authenticate, readJsonObject,
  reserve: async ({ admin, userId }) => {
    const { error } = await admin.rpc('reserve_external_candidate_lookup', { p_user_id: userId });
    if (!error) return;
    if (error.message?.includes('EXTERNAL_CANDIDATE_USER_LIMIT')
      || error.message?.includes('EXTERNAL_CANDIDATE_GLOBAL_LIMIT')) {
      throw new ServiceError('RATE_LIMITED', 'External product lookup is temporarily limited', 429);
    }
    console.error('external candidate reservation failed:', error.code ?? 'unknown');
    throw new ServiceError('BUDGET_UNAVAILABLE', 'External product lookup is unavailable', 503);
  },
  lookup: (barcode) => lookupOpenBeautyFacts(barcode, { userAgent: USER_AGENT }),
  failure: (code, message, status) => new ServiceError(code, message, status),
  respond: jsonResponse, errorResponse, corsHeaders,
}));
