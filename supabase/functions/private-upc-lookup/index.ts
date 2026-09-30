import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { lookupUpcItemDb } from '../_shared/upcitemdb-candidate.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, readJsonObject, ServiceError } from '../_shared/runtime.ts';
import { handlePrivateUpcLookup } from './handler.ts';

const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(value => value.trim()).filter(value => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value));

Deno.serve((req: Request) => handlePrivateUpcLookup(req, {
  enabled: Deno.env.get('DERIVE_UPC_PRIVATE_TEST_ENABLED') === 'true',
  allowedUserIds, authenticate, readJsonObject,
  lookup: async (barcode, { admin, userId }) => {
    return lookupUpcItemDb(barcode, {
      enabled: true, plan: 'trial',
      reserveRequest: async () => {
        const { error } = await admin.rpc('reserve_private_upc_trial', { p_user_id: userId });
        if (!error) return 'reserved';
        if (error.message?.includes('UPC_TRIAL_LIMIT')) return 'rate_limited';
        throw new Error('UPC_BUDGET_UNAVAILABLE');
      },
    });
  },
  failure: (code, message, status) => new ServiceError(code, message, status),
  respond: jsonResponse, errorResponse, corsHeaders,
}));
