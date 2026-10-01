import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate, corsHeaders, errorResponse, jsonResponse, ServiceError } from '../_shared/runtime.ts';
import { extractPrivateProductPhoto } from '../_shared/private-product-photo.ts';
import { handlePrivateProductPhoto } from './handler.ts';

const allowedUserIds = (Deno.env.get('DERIVE_UPC_PRIVATE_TESTER_IDS') ?? '').split(',')
  .map(value => value.trim()).filter(value => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value));

Deno.serve((req: Request) => handlePrivateProductPhoto(req, {
  enabled: Deno.env.get('DERIVE_UPC_PRIVATE_TEST_ENABLED') === 'true'
    && Deno.env.get('DERIVE_GEMINI_PRODUCT_PHOTO_TEST_ENABLED') === 'true', allowedUserIds,
  authenticate, corsHeaders, respond: jsonResponse, errorResponse,
  failure: (code, message, status) => new ServiceError(code, message, status),
  extract: (request, { admin, userId }) => extractPrivateProductPhoto(request, {
    apiKey: Deno.env.get('GEMINI_API_KEY') ?? '', model: Deno.env.get('GEMINI_MODEL'),
    reserveRequest: async () => {
      const { error } = await admin.rpc('reserve_private_grounded_search', { p_user_id: userId });
      if (!error) return 'reserved';
      if (error.message?.includes('GROUNDED_SEARCH_LIMIT')) return 'rate_limited';
      throw new ServiceError('OWNER_OR_BUDGET_UNAVAILABLE', 'Product-photo reading is unavailable', 503);
    },
  }),
}));
