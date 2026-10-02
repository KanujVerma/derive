import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from '../_shared/runtime.ts';
import { lookupWebProductIngredients } from '../_shared/web-product-ingredients.ts';
import { handlePrivateWebProductIngredients } from './handler.ts';
const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(value => value.trim()).filter(value => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value));
Deno.serve((req: Request) => handlePrivateWebProductIngredients(req, {
  enabled: Deno.env.get('DERIVE_UPC_PRIVATE_TEST_ENABLED') === 'true'
    && Deno.env.get('DERIVE_WEB_INGREDIENT_TEST_ENABLED') === 'true', allowedUserIds,
  authenticate, corsHeaders, respond: jsonResponse, errorResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  lookup: (query, { admin, userId }) => lookupWebProductIngredients(query, {
    serpApiKey: Deno.env.get('SERPAPI_API_KEY') ?? '', geminiApiKey: Deno.env.get('GEMINI_API_KEY') ?? '',
    model: Deno.env.get('GEMINI_MODEL'), preferManufacturerSearch: true, reserveRequest: async () => {
      const { error } = await admin.rpc('reserve_private_grounded_search', { p_user_id: userId });
      if (!error) return 'reserved';
      if (error.message?.includes('GROUNDED_SEARCH_LIMIT')) return 'rate_limited';
      throw new ServiceError('OWNER_OR_BUDGET_UNAVAILABLE', 'Web ingredient lookup is unavailable', 503);
    },
    // Operational enums/counts/timing only. No product, profile, owner, URLs or credentials.
    report: event => console.info('[private-ingredient-lookup]', JSON.stringify(event)),
  }),
}));
