// Canonical Context Assembler & Fail-Closed Validation
// Part of DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure

import type {
  AssembledRoutineContext,
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  ProductCategory,
} from './types.ts';
import { VALID_CATEGORIES } from './validator.ts';

// Exact canonical enums strictly matching src/types/schema.ts
const ALLOWED_PRIMARY_GOALS = new Set<string>([
  'breakouts',
  'dark_spots',
  'dryness',
  'oiliness',
  'texture',
  'redness',
  'fine_lines',
  'simplify',
  'maintain',
]);

const ALLOWED_COMPLEXITY = new Set<string>([
  'simple',
  'balanced',
  'maximize',
]);

const ALLOWED_COST = new Set<string>([
  'value',
  'balanced',
  'premium',
]);

const ALLOWED_MIDDAY_FEEL = new Set<string>([
  'dry_tight',
  'comfortable',
  'oily_shiny',
  'combination',
  'unsure',
]);

const ALLOWED_PREGNANCY_STATUS = new Set<string>([
  'yes',
  'no',
  'prefer_not_to_say',
  'unanswered',
]);

const ALLOWED_SENSITIVITIES_STATUS = new Set<string>([
  'none_known',
  'reported',
  'unanswered',
]);

export interface ContextAssemblyResult {
  valid: boolean;
  code?: 'INTAKE_CONTEXT_INVALID';
  context?: AssembledRoutineContext;
  error?: string;
}

export function assembleCanonicalContext(
  skinProfile: any,
  payloadSnapshot: any,
  photos?: any[]
): ContextAssemblyResult {
  if (!skinProfile && !payloadSnapshot) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: 'No skin profile or onboarding submission snapshot found.',
    };
  }

  // 1. Primary Goal (Required)
  const primaryGoal = skinProfile?.primary_goal || payloadSnapshot?.primaryGoal;
  if (!primaryGoal || !ALLOWED_PRIMARY_GOALS.has(primaryGoal)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing primaryGoal '${primaryGoal}'. Must be one of canonical goals.`,
    };
  }

  // 2. Routine Complexity (Required)
  const routineComplexity = skinProfile?.routine_complexity || payloadSnapshot?.routineComplexity;
  if (!routineComplexity || !ALLOWED_COMPLEXITY.has(routineComplexity)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing routineComplexity '${routineComplexity}'. Must be one of canonical complexity levels.`,
    };
  }

  // 3. Product Cost Preference (Required - Fail closed, no silent default)
  const costPreference = skinProfile?.cost_preference || payloadSnapshot?.costPreference;
  if (!costPreference || !ALLOWED_COST.has(costPreference)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing costPreference '${costPreference}'. Must be one of canonical cost preferences.`,
    };
  }

  // 4. Midday Feel (Required - Fail closed, no silent default)
  const middayFeel = skinProfile?.midday_feel || payloadSnapshot?.middayFeel;
  if (!middayFeel || !ALLOWED_MIDDAY_FEEL.has(middayFeel)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing middayFeel '${middayFeel}'. Must be one of canonical midday feel values.`,
    };
  }

  // 5. Secondary Goals (All must be canonical goals)
  const rawSecondary = Array.isArray(skinProfile?.secondary_goals)
    ? skinProfile.secondary_goals
    : Array.isArray(payloadSnapshot?.secondaryGoals)
    ? payloadSnapshot.secondaryGoals
    : [];

  for (const g of rawSecondary) {
    if (!ALLOWED_PRIMARY_GOALS.has(g)) {
      return {
        valid: false,
        code: 'INTAKE_CONTEXT_INVALID',
        error: `Invalid secondary goal '${g}'. Must be one of canonical goals.`,
      };
    }
  }

  // 6. Safety Context
  const safety = payloadSnapshot?.safetyContext || {};
  const isPregnant =
    skinProfile?.is_pregnant_or_nursing === true ||
    safety.isPregnantOrNursing === true ||
    skinProfile?.pregnancy_status === 'yes';

  const rawPregStatus = skinProfile?.pregnancy_status || safety.pregnancyStatus || (isPregnant ? 'yes' : 'unanswered');
  if (!ALLOWED_PREGNANCY_STATUS.has(rawPregStatus)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid pregnancyStatus '${rawPregStatus}'.`,
    };
  }

  const rawSensStatus = skinProfile?.sensitivities_status || safety.sensitivitiesStatus || 'unanswered';
  if (!ALLOWED_SENSITIVITIES_STATUS.has(rawSensStatus)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid sensitivitiesStatus '${rawSensStatus}'.`,
    };
  }

  // 7. Confirmed Products (Must have valid non-empty identity, zero fake fallback)
  const confirmedRaw = payloadSnapshot?.confirmedProducts || skinProfile?.confirmed_products || skinProfile?.confirmedProducts || [];
  const confirmedProducts: Array<{
    brand: string;
    name: string;
    category?: ProductCategory | string;
    keyActives?: string[];
  }> = [];

  for (const p of confirmedRaw) {
    const brand = (p.brand || p.detectedBrand || '').trim();
    const name = (p.name || p.detectedName || p.productName || '').trim();

    if (!brand || !name) {
      return {
        valid: false,
        code: 'INTAKE_CONTEXT_INVALID',
        error: 'Confirmed shelf product has malformed identity: missing non-empty brand or product name.',
      };
    }

    const rawCat = (p.category || 'other').toLowerCase();
    const category = VALID_CATEGORIES.has(rawCat) ? (rawCat as ProductCategory) : 'other';

    confirmedProducts.push({
      brand,
      name,
      category,
      keyActives: Array.isArray(p.keyActives) ? p.keyActives : [],
    });
  }

  const context: AssembledRoutineContext = {
    userId: skinProfile?.user_id || payloadSnapshot?.userId || '',
    primaryGoal: primaryGoal as Goal,
    secondaryGoals: rawSecondary as Goal[],
    routineComplexity: routineComplexity as RoutineComplexity,
    costPreference: costPreference as ProductCostPreference,
    middayFeel: middayFeel as MiddayFeel,
    postCleanseTightness:
      skinProfile?.post_cleanse_tightness ?? payloadSnapshot?.postCleanseTightness ?? false,
    isPregnantOrNursing: isPregnant,
    pregnancyStatus: rawPregStatus as 'yes' | 'no' | 'prefer_not_to_say' | 'unanswered',
    sensitivitiesStatus: rawSensStatus as 'none_known' | 'reported' | 'unanswered',
    knownSensitivities: Array.isArray(skinProfile?.known_sensitivities)
      ? skinProfile.known_sensitivities
      : Array.isArray(safety.knownSensitivities)
      ? safety.knownSensitivities
      : [],
    activePrescriptions: Array.isArray(skinProfile?.active_prescriptions)
      ? skinProfile.active_prescriptions
      : Array.isArray(payloadSnapshot?.activePrescriptions)
      ? payloadSnapshot.activePrescriptions
      : [],
    confirmedProducts,
    productReactions: Array.isArray(payloadSnapshot?.productReactions) ? payloadSnapshot.productReactions : [],
    formulaSnapshots: Array.isArray(payloadSnapshot?.formulaSnapshots) ? payloadSnapshot.formulaSnapshots : [],
    pihTendencyAnswer: payloadSnapshot?.pihTendencyAnswer || undefined,
    photoMetadata: (photos || []).map((ph: any) => ({
      photoType: ph.photo_type || ph.photoType,
      storagePath: ph.storage_path || ph.storagePath,
    })),
  };

  return { valid: true, context };
}
