import type { PrivateIngredientRequest, PrivateIngredientSearch } from '../../../src/contracts/PrivateIngredientSearch.ts';
import type { IngredientCosmeticContext } from '../../../src/domain/ingredient-context.ts';
import { parseIngredientRequest, searchPublishedIngredients } from './private-ingredient-search.ts';

export interface PrivateIngredientContextSnapshot { context: IngredientCosmeticContext; version: string }

/** One ephemeral answer, not an extracted ingredient dataset or authoritative personal decision. */
export async function runPrivateIngredientSearch(request: PrivateIngredientRequest, deps: {
  apiKey: string;
  /** Explicit operator assertion of paid-project processing + reviewed privacy disclosure. Default false. */
  personalContextApproved: boolean;
  loadContext: () => Promise<PrivateIngredientContextSnapshot | null>;
  reserveRequest: () => Promise<'reserved' | 'rate_limited'>;
  fetcher?: typeof fetch;
}): Promise<PrivateIngredientSearch> {
  const parsed = parseIngredientRequest(request);
  const { personalization, contextSharingConsent: _consent, ...query } = parsed;
  let snapshot: PrivateIngredientContextSnapshot | null = null;
  if (personalization) {
    if (!deps.personalContextApproved) return { status: 'personalization_disabled' };
    if (!deps.apiKey.trim()) return { status: 'configuration_required' };
    try { snapshot = await deps.loadContext(); }
    catch { return { status: 'context_unavailable' }; }
    if (!snapshot) return { status: 'profile_missing' };
  }
  const result = await searchPublishedIngredients(query, {
    apiKey: deps.apiKey, reserveRequest: deps.reserveRequest, fetcher: deps.fetcher,
    ...(snapshot ? { cosmeticContext: snapshot.context } : {}),
  });
  if (result.status !== 'grounded_answer') return result;
  if (!snapshot) return { ...result, answerKind: 'published_ingredients' };
  // Context changes during retrieval cannot publish an answer for the previous saved profile.
  try {
    const current = await deps.loadContext();
    if (!current || current.version !== snapshot.version) return { status: 'context_changed' };
  } catch { return { status: 'context_unavailable' }; }
  return { ...result, answerKind: 'contextual_web_guidance', contextVersion: snapshot.version };
}
