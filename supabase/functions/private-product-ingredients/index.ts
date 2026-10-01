import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from '../_shared/runtime.ts';
import { lookupProductIngredients } from '../_shared/product-ingredient-lookup.ts';
import { lookupObfIngredients } from '../_shared/obf-ingredient-source.ts';
import { lookupDailyMedIngredients } from '../_shared/dailymed-ingredient-source.ts';
import { handleProductIngredients } from './handler.ts';

const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(v => v.trim()).filter(v => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v));
Deno.serve((req: Request) => handleProductIngredients(req, {
  // Reuse the existing private phone test boundary. No new public activation.
  enabled: Deno.env.get('DERIVE_UPC_PRIVATE_TEST_ENABLED') === 'true', allowedUserIds,
  authenticate, corsHeaders, respond: jsonResponse, errorResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  lookup: (query, { admin, userId }) => lookupProductIngredients(query, {
    obf: lookupObfIngredients, dailyMed: lookupDailyMedIngredients,
    reserve: async () => {
      const { error } = await admin.rpc('reserve_external_candidate_lookup', { p_user_id: userId });
      if (!error) return 'reserved';
      if (error.message?.includes('EXTERNAL_CANDIDATE_GLOBAL_LIMIT') || error.message?.includes('EXTERNAL_CANDIDATE_USER_LIMIT')) return 'rate_limited';
      throw new ServiceError('BUDGET_UNAVAILABLE', 'Ingredient lookup is unavailable', 503);
    },
  }),
}));
