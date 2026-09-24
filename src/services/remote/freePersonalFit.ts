import type { FreeSkinProfile, FreeSkinProfileInput, PersonalFitResult } from '../../contracts/FreePersonalFit.ts';
import { supabase } from '../supabase.ts';

type FunctionClient = { functions: { invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }> } };
const FIT_LABELS = new Set(['COULD_WORK', 'USE_WITH_CAUTION', 'NOT_ENOUGH_INFORMATION']);
const FIT_REASONS = new Set([
  'profile_missing', 'formula_unverified', 'profile_context_missing',
  'reported_ingredient_sensitivity', 'retinoid_pregnancy_context', 'multiple_cautions',
  'active_overlap', 'reactive_active', 'sensitivity_unresolved', 'goal_role_match', 'no_supported_fit_rule',
  'prior_product_reaction',
]);

async function invoke(body: object, client: FunctionClient = supabase as FunctionClient): Promise<Record<string, unknown>> {
  if (!client) throw new Error('Supabase client is not configured');
  const { data, error } = await client.functions.invoke('free-personal-fit', { body });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Personal fit is unavailable');
  return data as Record<string, unknown>;
}

function profileFrom(value: unknown): FreeSkinProfile | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Personal profile is unavailable');
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.goals) || !Array.isArray(row.knownSensitivities)
    || !Array.isArray(row.currentTreatments) || typeof row.updatedAt !== 'string'
    || typeof row.skinBehavior !== 'string' || typeof row.reactivity !== 'string'
    || typeof row.pregnancyStatus !== 'string' || typeof row.sensitivitiesStatus !== 'string'
    || typeof row.treatmentStatus !== 'string') {
    throw new Error('Personal profile is unavailable');
  }
  return row as unknown as FreeSkinProfile;
}

/** Call after the S-FREE-1 verified guest or permanent Auth session exists. */
export async function getFreeSkinProfile(client?: FunctionClient): Promise<FreeSkinProfile | null> {
  return profileFrom((await invoke({ operation: 'get_profile' }, client)).profile);
}

/** A complete snapshot; unknown choices remain explicit and are never defaulted to "no". */
export async function saveFreeSkinProfile(profile: FreeSkinProfileInput, client?: FunctionClient): Promise<FreeSkinProfile> {
  const result = profileFrom((await invoke({ operation: 'save_profile', profile }, client)).profile);
  if (!result) throw new Error('Personal profile is unavailable');
  return result;
}

export async function getPersonalFit(productId: string, variantId?: string, client?: FunctionClient): Promise<PersonalFitResult> {
  const response = await invoke({ operation: 'fit', productId, ...(variantId ? { variantId } : {}) }, client);
  const fit = response.fit;
  if (!fit || typeof fit !== 'object' || Array.isArray(fit)) throw new Error('Personal fit is unavailable');
  const value = fit as Record<string, unknown>;
  if (value.productId !== productId || (variantId && value.variantId !== variantId)
    || !FIT_LABELS.has(String(value.label)) || !FIT_REASONS.has(String(value.reason))
    || typeof value.explanation !== 'string' || !Array.isArray(value.evidenceUsed)
    || !Array.isArray(value.missingEvidence) || !Array.isArray(value.sources)
    || [...value.evidenceUsed, ...value.missingEvidence, ...value.sources].some((item) => typeof item !== 'string')
    || value.sources.some((source: string) => !/^https:\/\//.test(source))) {
    throw new Error('Personal fit is unavailable');
  }
  return fit as PersonalFitResult;
}
