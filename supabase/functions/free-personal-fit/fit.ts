import type {
  FreePersonalFitRequest, FreeSkinProfileInput, PersonalFitResult,
} from '../../../src/contracts/FreePersonalFit.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GOALS = new Set(['breakouts', 'dark_spots', 'dryness', 'oiliness', 'texture', 'redness', 'fine_lines', 'simplify', 'maintain']);
const BEHAVIOR = new Set(['dry_tight', 'comfortable', 'oily_shiny', 'combination', 'unsure']);
const REACTIVITY = new Set(['reacts_easily', 'generally_tolerates', 'unsure']);
const PREGNANCY = new Set(['yes', 'no', 'prefer_not_to_say', 'unanswered']);
const SENSITIVITY = new Set(['none_known', 'reported', 'unanswered']);
const TREATMENT_STATUS = new Set(['none', 'reported', 'unanswered']);
const TREATMENTS = new Set(['topical_retinoid', 'benzoyl_peroxide', 'exfoliating_acid', 'other_prescription']);
const RETINOIDS = new Set(['retinol', 'retinal', 'retinaldehyde', 'retinyl palmitate', 'retinyl acetate', 'tretinoin', 'adapalene', 'tazarotene']);
const EXFOLIANTS = new Set(['glycolic acid', 'lactic acid', 'mandelic acid', 'salicylic acid']);
const BENZOYL_PEROXIDE = 'benzoyl peroxide';
const AAD_PREGNANCY = 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care';

export class FitRequestError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FitRequestError('A JSON object is required');
  return value as Record<string, unknown>;
}
function exactFields(row: Record<string, unknown>, fields: string[]): void {
  if (Object.keys(row).some((key) => !fields.includes(key)) || fields.some((key) => !(key in row))) {
    throw new FitRequestError('Profile fields are invalid');
  }
}
function choice(value: unknown, allowed: Set<string>, field: string): string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new FitRequestError(`${field} is invalid`);
  return value;
}
function choiceArray(value: unknown, allowed: Set<string>, field: string, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || !allowed.has(item))) {
    throw new FitRequestError(`${field} is invalid`);
  }
  if (new Set(value).size !== value.length) throw new FitRequestError(`${field} has duplicates`);
  return value;
}

export function parseFreePersonalFitRequest(value: unknown): FreePersonalFitRequest {
  const body = object(value);
  if (body.operation === 'get_profile') {
    exactFields(body, ['operation']);
    return { operation: 'get_profile' };
  }
  if (body.operation === 'fit') {
    if (Object.keys(body).some((key) => !['operation', 'productId', 'variantId'].includes(key))) {
      throw new FitRequestError('Unexpected fit fields');
    }
    if (typeof body.productId !== 'string' || !UUID.test(body.productId)
      || (body.variantId !== undefined && (typeof body.variantId !== 'string' || !UUID.test(body.variantId)))) {
      throw new FitRequestError('Product or variant ID is invalid');
    }
    return { operation: 'fit', productId: body.productId, ...(body.variantId ? { variantId: body.variantId } : {}) };
  }
  if (body.operation !== 'save_profile') throw new FitRequestError('Profile operation is invalid');
  exactFields(body, ['operation', 'profile']);
  const raw = object(body.profile);
  exactFields(raw, ['goals', 'skinBehavior', 'reactivity', 'pregnancyStatus', 'sensitivitiesStatus', 'knownSensitivities', 'treatmentStatus', 'currentTreatments']);
  const goals = choiceArray(raw.goals, GOALS, 'goals', 3);
  const skinBehavior = choice(raw.skinBehavior, BEHAVIOR, 'skinBehavior');
  const reactivity = choice(raw.reactivity, REACTIVITY, 'reactivity');
  const pregnancyStatus = choice(raw.pregnancyStatus, PREGNANCY, 'pregnancyStatus');
  const sensitivitiesStatus = choice(raw.sensitivitiesStatus, SENSITIVITY, 'sensitivitiesStatus');
  const treatmentStatus = choice(raw.treatmentStatus, TREATMENT_STATUS, 'treatmentStatus');
  const currentTreatments = choiceArray(raw.currentTreatments, TREATMENTS, 'currentTreatments', 4);
  if (!Array.isArray(raw.knownSensitivities) || raw.knownSensitivities.length > 10
    || raw.knownSensitivities.some((item) => typeof item !== 'string' || item.trim().length < 2
      || item.trim().length > 80 || /[\x00-\x1f\x7f]/.test(item))) {
    throw new FitRequestError('knownSensitivities is invalid');
  }
  const knownSensitivities = (raw.knownSensitivities as string[]).map((item) => item.trim());
  if (new Set(knownSensitivities.map((item) => item.toLowerCase())).size !== knownSensitivities.length) {
    throw new FitRequestError('knownSensitivities has duplicates');
  }
  if ((sensitivitiesStatus === 'reported') !== (knownSensitivities.length > 0)
    || (treatmentStatus === 'reported') !== (currentTreatments.length > 0)) {
    throw new FitRequestError('Reported status must match supplied context');
  }
  const profile: FreeSkinProfileInput = {
    goals: goals as FreeSkinProfileInput['goals'],
    skinBehavior: skinBehavior as FreeSkinProfileInput['skinBehavior'],
    reactivity: reactivity as FreeSkinProfileInput['reactivity'],
    pregnancyStatus: pregnancyStatus as FreeSkinProfileInput['pregnancyStatus'],
    sensitivitiesStatus: sensitivitiesStatus as FreeSkinProfileInput['sensitivitiesStatus'],
    knownSensitivities, treatmentStatus: treatmentStatus as FreeSkinProfileInput['treatmentStatus'],
    currentTreatments: currentTreatments as FreeSkinProfileInput['currentTreatments'],
  };
  return { operation: 'save_profile', profile };
}

const normalized = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function listsIngredient(entries: Set<string>, term: string): boolean {
  const whole = new RegExp(`(^|[^a-z])${escapeRegex(term)}(?=$|[^a-z])`);
  return [...entries].some((entry) => whole.test(entry));
}

interface VerifiedFormulaContext {
  productId: string;
  variantId: string | null;
  formulaVersionId: string | null;
  category: string | null;
  ingredients: string[] | null;
  sourceReference?: string | null;
}

/** Conservative cosmetic fit only. Never treats an ingredient list as proof of concentration or safety. */
export function determinePersonalFit(profile: FreeSkinProfileInput | null, formula: VerifiedFormulaContext): PersonalFitResult {
  const base = {
    productId: formula.productId, variantId: formula.variantId, formulaVersionId: formula.formulaVersionId,
    sources: formula.sourceReference ? [formula.sourceReference] : [] as string[],
    evidenceUsed: [] as string[], missingEvidence: [] as string[],
  };
  if (!profile) return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'profile_missing',
    explanation: 'Add optional skin context to see whether this product may fit you.', missingEvidence: ['free_skin_profile'] };
  if (!formula.formulaVersionId || !formula.ingredients?.length || !formula.variantId) {
    return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'formula_unverified',
      explanation: 'We cannot assess personal fit until this exact product formula is verified.',
      missingEvidence: ['verified_variant_formula'] };
  }
  const ingredients = new Set(formula.ingredients.map(normalized));
  const ingredientEvidence = `verified_formula:${formula.formulaVersionId}`;
  const reported = profile.knownSensitivities.find((item) => ingredients.has(normalized(item)));
  const hasRetinoid = [...RETINOIDS].some((item) => listsIngredient(ingredients, item));
  const hasExfoliant = [...EXFOLIANTS].some((item) => listsIngredient(ingredients, item));
  const hasBenzoylPeroxide = listsIngredient(ingredients, BENZOYL_PEROXIDE);
  if (hasRetinoid && profile.pregnancyStatus === 'yes') {
    return { ...base, label: 'USE_WITH_CAUTION', reason: reported ? 'multiple_cautions' : 'retinoid_pregnancy_context',
      explanation: `This formula lists a retinoid, and you reported pregnancy or nursing. Ask your clinician before use; Derive cannot assess individual safety.${reported ? ' It also lists an ingredient you reported as a sensitivity.' : ''}`,
      evidenceUsed: [ingredientEvidence, 'reported_pregnancy_or_nursing', ...(reported ? ['user_reported_sensitivity'] : [])],
      missingEvidence: ['clinician_review'], sources: [...base.sources, AAD_PREGNANCY] };
  }
  if (hasRetinoid && profile.pregnancyStatus !== 'no') {
    if (reported) return { ...base, label: 'USE_WITH_CAUTION', reason: 'reported_ingredient_sensitivity',
      explanation: 'This formula lists an ingredient you reported as a sensitivity and a retinoid. Derive also lacks pregnancy or nursing context to assess suitability.',
      evidenceUsed: [ingredientEvidence, 'user_reported_sensitivity'],
      missingEvidence: ['pregnancy_or_nursing_context', 'individual_tolerance'], sources: [...base.sources, AAD_PREGNANCY] };
    return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'profile_context_missing',
      explanation: 'This formula lists a retinoid. Without pregnancy or nursing context, Derive cannot give a personal suitability label.',
      evidenceUsed: [ingredientEvidence], missingEvidence: ['pregnancy_or_nursing_context'], sources: [...base.sources, AAD_PREGNANCY] };
  }
  if (reported) return { ...base, label: 'USE_WITH_CAUTION', reason: 'reported_ingredient_sensitivity',
    explanation: 'This formula lists an ingredient you reported as a sensitivity. Confirm the exact label and seek individual advice if needed; this is not an allergy diagnosis.',
    evidenceUsed: [ingredientEvidence, 'user_reported_sensitivity'], missingEvidence: ['individual_tolerance'] };
  if (profile.sensitivitiesStatus === 'reported') {
    return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'sensitivity_unresolved',
      explanation: 'You reported a sensitivity, but an exact name match was not found. That does not prove this formula avoids your trigger.',
      evidenceUsed: [ingredientEvidence, 'user_reported_sensitivity'],
      missingEvidence: ['ingredient_alias_review', 'individual_tolerance'] };
  }
  if ((hasRetinoid || hasExfoliant || hasBenzoylPeroxide) && profile.treatmentStatus === 'unanswered') {
    return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'profile_context_missing',
      explanation: 'This formula lists an active ingredient, but your current-treatment context is unknown. We cannot assess routine overlap.',
      evidenceUsed: [ingredientEvidence], missingEvidence: ['current_treatments'] };
  }
  const treatments = new Set(profile.currentTreatments);
  if ((hasRetinoid && treatments.has('topical_retinoid'))
    || ((hasRetinoid || hasExfoliant) && treatments.has('exfoliating_acid'))
    || (hasBenzoylPeroxide && treatments.has('benzoyl_peroxide'))) {
    return { ...base, label: 'USE_WITH_CAUTION', reason: 'active_overlap',
      explanation: 'The verified ingredient list overlaps with a treatment you reported. Check your routine with a qualified professional before combining them.',
      evidenceUsed: [ingredientEvidence, 'reported_current_treatment'], missingEvidence: ['application_schedule', 'individual_tolerance'] };
  }
  if (profile.reactivity === 'reacts_easily' && (hasRetinoid || hasExfoliant || hasBenzoylPeroxide)) {
    return { ...base, label: 'USE_WITH_CAUTION', reason: 'reactive_active',
      explanation: 'You reported easily reactive skin, and this formula lists an active ingredient that may need individual tolerance review.',
      evidenceUsed: [ingredientEvidence, 'reported_reactivity'], missingEvidence: ['individual_tolerance'] };
  }
  if (profile.goals.includes('dryness') && profile.skinBehavior === 'dry_tight'
    && formula.category === 'moisturizer'
    && !hasRetinoid && !hasExfoliant && !hasBenzoylPeroxide) {
    return { ...base, label: 'COULD_WORK', reason: 'goal_role_match',
      explanation: 'A moisturizer fits your reported dryness goal and dry/tight skin behavior by product role. The ingredient list alone cannot establish results or tolerance.',
      evidenceUsed: [ingredientEvidence, 'verified_product_category', 'reported_goal', 'reported_skin_behavior'],
      missingEvidence: [
        ...(profile.sensitivitiesStatus === 'unanswered' ? ['sensitivity_context'] : []),
        ...(profile.treatmentStatus === 'unanswered' ? ['current_treatments'] : []),
        ...(profile.currentTreatments.includes('other_prescription') ? ['prescription_details'] : []),
        'individual_tolerance',
      ] };
  }
  return { ...base, label: 'NOT_ENOUGH_INFORMATION', reason: 'no_supported_fit_rule',
    explanation: 'We have verified formula details, but not enough supported context to give this product a personal fit label.',
    evidenceUsed: [ingredientEvidence], missingEvidence: ['supported_fit_rule'] };
}
