import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { lookupOpenBeautyFacts } from '../_shared/open-beauty-facts-candidate.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { handleExternalCandidateRequest } from './handler.ts';

const USER_AGENT = 'Derive/0.1 (https://github.com/KanujVerma/derive)';

Deno.serve((req: Request) => handleExternalCandidateRequest(req, {
  enabled: Deno.env.get('DERIVE_OBF_CANDIDATES_ENABLED') === 'true',
  authenticate, readJsonObject,
  lookup: (barcode) => lookupOpenBeautyFacts(barcode, { userAgent: USER_AGENT }),
  failure: (code, message, status) => new ServiceError(code, message, status),
  respond: jsonResponse, errorResponse, corsHeaders,
}));
