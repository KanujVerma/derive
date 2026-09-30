import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from '../_shared/runtime.ts';
import { searchPublishedIngredients } from '../_shared/private-ingredient-search.ts';
import { handlePrivateIngredientSearch } from './handler.ts';

const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(v => v.trim()).filter(v => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v));

Deno.serve((req: Request) => handlePrivateIngredientSearch(req, {
  enabled: Deno.env.get('DERIVE_GEMINI_INGREDIENT_TEST_ENABLED') === 'true', allowedUserIds,
  authenticate, corsHeaders, respond: jsonResponse, errorResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  search: (query, { admin, userId }) => searchPublishedIngredients(query, {
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
    reserveRequest: async () => {
      const { error } = await admin.rpc('reserve_private_grounded_search', { p_user_id: userId });
      if (!error) return 'reserved';
      if (error.message?.includes('GROUNDED_SEARCH_LIMIT')) return 'rate_limited';
      throw new ServiceError('OWNER_OR_BUDGET_UNAVAILABLE', 'Ingredient lookup is unavailable', 503);
    },
  }),
}));
