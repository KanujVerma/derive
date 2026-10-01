import type { IngredientExplanationRequest, IngredientExplanationResult } from '../../contracts/IngredientExplanation.ts';
import type { PrivateLookupClient } from './privateLookup.ts';

const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown, max: number): v is string => typeof v === 'string' && Boolean(v.trim()) && v.length <= max
  && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const statuses = new Set(['configuration_required', 'personalization_disabled', 'profile_missing', 'context_unavailable',
  'context_changed', 'rate_limited', 'unavailable', 'no_answer']);
export const ingredientExplanationKey = (request: IngredientExplanationRequest) => JSON.stringify([
  request.productName, request.ingredientsText, request.category,
]);

export function parseIngredientExplanation(value: unknown): IngredientExplanationResult {
  if (!record(value)) throw Error('INVALID_EXPLANATION');
  if (statuses.has(String(value.status))) return { status: value.status as Exclude<IngredientExplanationResult, { status: 'answer' }>['status'] };
  if (value.status !== 'answer' || value.basis !== 'ai_guidance' || value.formulaVerified !== false
    || !Array.isArray(value.sentences) || value.sentences.length < 1 || value.sentences.length > 4
    || !value.sentences.every(s => text(s, 500)) || !text(value.model, 100)
    || !text(value.retrievedAt, 40) || !Number.isFinite(Date.parse(value.retrievedAt))
    || !text(value.contextVersion, 64) || !/^[a-f\d]{64}$/.test(value.contextVersion)) throw Error('INVALID_EXPLANATION');
  return { status: 'answer', sentences: value.sentences as string[], model: value.model, retrievedAt: value.retrievedAt,
    contextVersion: value.contextVersion, basis: 'ai_guidance', formulaVerified: false };
}

export async function requestIngredientExplanation(request: IngredientExplanationRequest, scope: string,
  currentScope: () => string, client: PrivateLookupClient): Promise<IngredientExplanationResult> {
  if (request.contextSharingConsent !== true || !scope || currentScope() !== scope
    || !text(request.productName, 180) || !text(request.ingredientsText, 24000)
    || !['skincare', 'other_personal_care'].includes(request.category)) throw Error('INVALID_EXPLANATION_REQUEST');
  // Saved context is loaded on the authenticated server; the phone sends no profile/history/owner.
  const { data, error } = await client.functions.invoke('private-ingredient-explanation', { body: {
    productName: request.productName, ingredientsText: request.ingredientsText, category: request.category,
    contextSharingConsent: true,
  } });
  if (currentScope() !== scope) throw Error('EXPLANATION_SCOPE_CHANGED');
  let payload: unknown = data;
  if (error) {
    const context = record(error) && record(error.context) ? error.context : null;
    if (!(context?.status === 429 || context?.status === 503)) throw Error('EXPLANATION_UNAVAILABLE');
    if (!payload && typeof context.clone === 'function') {
      try { payload = await (context.clone() as Response).json(); } catch { throw Error('EXPLANATION_UNAVAILABLE'); }
    }
    if (currentScope() !== scope) throw Error('EXPLANATION_SCOPE_CHANGED');
  }
  return parseIngredientExplanation(payload);
}
