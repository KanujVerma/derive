import type { IngredientExplanationRequest, IngredientExplanationResult } from '../../../src/contracts/IngredientExplanation.ts';
import { cosmeticContextFromFreeProfile } from '../../../src/domain/ingredient-context.ts';
import type { PrivateIngredientContextSnapshot } from './private-ingredient-runtime.ts';
import { explainIngredientContext } from './ingredient-explanation-model.ts';
import { judgeIngredientContextWithJev } from './jev-ingredient-judgment.ts';

/** Client input is product evidence, never an owner ID or a client-authored profile. */
export function parseIngredientExplanationRequest(value: unknown): IngredientExplanationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_EXPLANATION_REQUEST');
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort().join(',');
  if (!['category,contextSharingConsent,ingredientsText,productName',
    'category,contextSharingConsent,ingredientsText,productName,provider'].includes(keys)
    || typeof input.productName !== 'string' || !input.productName.trim() || input.productName.length > 180
    || /[\u0000-\u001f\u007f]/u.test(input.productName)
    || typeof input.ingredientsText !== 'string' || !input.ingredientsText.trim() || input.ingredientsText.length > 24_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.ingredientsText)
    || !['skincare', 'other_personal_care'].includes(input.category as string)
    || input.contextSharingConsent !== true
    || ('provider' in input && !['jev', 'gemini'].includes(input.provider as string))) throw new Error('INVALID_EXPLANATION_REQUEST');
  return { productName: input.productName.trim(), ingredientsText: input.ingredientsText.trim(),
    category: input.category as IngredientExplanationRequest['category'], contextSharingConsent: true,
    ...('provider' in input ? { provider: input.provider as 'jev' | 'gemini' } : {}) };
}

/** Ephemeral cosmetic explanation. No canonical formula, numeric score or persistent AI history. */
export async function runIngredientExplanation(request: IngredientExplanationRequest, deps: {
  apiKey: string;
  /** Use the same operator-selected model as ingredient retrieval. Never client supplied. */
  model?: string;
  provider?: 'gemini' | 'jev';
  /** Paid-project processing and the provider disclosure must be explicitly reviewed. */
  personalContextApproved: boolean;
  loadContext: () => Promise<PrivateIngredientContextSnapshot | null>;
  reserveRequest: () => Promise<'reserved' | 'rate_limited'>;
  fetcher?: typeof fetch;
  report?: (event: { stage: 'eligibility' | 'provider' | 'validation'; status: string }) => void;
}): Promise<IngredientExplanationResult> {
  const parsed = parseIngredientExplanationRequest(request);
  if (!deps.personalContextApproved) return { status: 'personalization_disabled' };
  if (parsed.provider && parsed.provider !== (deps.provider ?? 'gemini')) return { status: 'configuration_required' };
  if (!deps.apiKey.trim()) return { status: 'configuration_required' };
  let snapshot: PrivateIngredientContextSnapshot | null;
  try { snapshot = await deps.loadContext(); }
  catch { return { status: 'context_unavailable' }; }
  if (!snapshot) return { status: 'profile_missing' };
  // Re-project even a trusted snapshot: extra envelope/history properties cannot reach the model.
  const context = cosmeticContextFromFreeProfile(snapshot.context);
  if (!context || typeof snapshot.version !== 'string' || !snapshot.version || snapshot.version.length > 128) {
    return { status: 'context_unavailable' };
  }
  const contextVersion = snapshot.version;
  try {
    if (await deps.reserveRequest() !== 'reserved') return { status: 'rate_limited' };
  } catch { return { status: 'unavailable' }; }
  let result: { status: 'answer'; sentences: string[]; model: string } | {
    status: 'configuration_required' | 'rate_limited' | 'unavailable' | 'no_answer';
  };
  try { result = deps.provider === 'jev'
    ? await judgeIngredientContextWithJev({ ingredientsText: parsed.ingredientsText,
      category: parsed.category, context }, { apiKey: deps.apiKey, model: deps.model ?? 'jev-latest', fetcher: deps.fetcher, report: deps.report })
    : await explainIngredientContext({ productName: parsed.productName,
      ingredientsText: parsed.ingredientsText, category: parsed.category, context },
      { apiKey: deps.apiKey, model: deps.model, fetch: deps.fetcher }); }
  catch { return { status: 'unavailable' }; }
  if (result.status !== 'answer') return result;
  try {
    const current = await deps.loadContext();
    if (!current || current.version !== contextVersion) return { status: 'context_changed' };
  } catch { return { status: 'context_unavailable' }; }
  return { status: 'answer', sentences: result.sentences, model: result.model, retrievedAt: new Date().toISOString(),
    contextVersion, basis: 'ai_guidance', formulaVerified: false };
}
