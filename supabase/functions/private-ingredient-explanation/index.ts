import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from '../_shared/runtime.ts';
import { runIngredientExplanation } from '../_shared/ingredient-explanation-runtime.ts';
import { loadPrivateIngredientContext } from '../_shared/private-ingredient-context.ts';
import { handleIngredientExplanation } from './handler.ts';

const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(value => value.trim()).filter(value => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value));
const provider = Deno.env.get('DERIVE_INGREDIENT_MODEL_PROVIDER') === 'jev' ? 'jev' : 'gemini';

Deno.serve((req: Request) => handleIngredientExplanation(req, {
  enabled: Deno.env.get(provider === 'jev' ? 'DERIVE_JEV_INGREDIENT_TEST_ENABLED'
    : 'DERIVE_GEMINI_INGREDIENT_TEST_ENABLED') === 'true', allowedUserIds,
  authenticate, corsHeaders, respond: jsonResponse, errorResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  explain: (query, { admin, userId }) => runIngredientExplanation(query, {
    provider,
    apiKey: Deno.env.get(provider === 'jev' ? 'JEV_API_KEY' : 'GEMINI_API_KEY') ?? '',
    model: Deno.env.get(provider === 'jev' ? 'JEV_MODEL' : 'GEMINI_MODEL') || undefined,
    personalContextApproved: Deno.env.get(provider === 'jev' ? 'DERIVE_JEV_PERSONAL_CONTEXT_APPROVED'
      : 'DERIVE_GEMINI_PERSONAL_CONTEXT_APPROVED') === 'true',
    loadContext: () => loadPrivateIngredientContext(admin, userId),
    // Operational enums only. Never log context, ingredients, owner or keys.
    report: event => console.info('[private-ingredient-explanation]', JSON.stringify(event)),
    reserveRequest: async () => {
      const { error } = await admin.rpc('reserve_private_grounded_search', { p_user_id: userId });
      if (!error) return 'reserved';
      if (error.message?.includes('GROUNDED_SEARCH_LIMIT')) return 'rate_limited';
      throw new ServiceError('OWNER_OR_BUDGET_UNAVAILABLE', 'Ingredient explanation is unavailable', 503);
    },
  }),
}));
