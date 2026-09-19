// Canonical Context Assembler & Fail-Closed Validation
// Part of DERIVE I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure

import type {
  AssembledRoutineContext,
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  ProductCategory,
} from './types.ts';
import { VALID_CATEGORIES } from './validator.ts';

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
  'aging', // Database enum includes 'aging'
]);

const ALLOWED_COMPLEXITY = new Set<string>([
  'simple',
  'balanced',
  'maximize',
  'moderate',   // Database enum includes 'moderate'
  'multi_step', // Database enum includes 'multi_step'
]);

const ALLOWED_COST = new Set<string>([
  'essential',
  'balanced',
  'premium',
  'value',
]);

const ALLOWED_MIDDAY_FEEL = new Set<string>([
  'dry_tight',
  'comfortable',
  'oily_shiny',
  'combination',
  'unsure',
  'dry',      // Database enum includes 'dry'
  'balanced', // Database enum includes 'balanced'
  'oily',     // Database enum includes 'oily'
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

  const primaryGoal = skinProfile?.primary_goal || payloadSnapshot?.primaryGoal;
  if (!primaryGoal || !ALLOWED_PRIMARY_GOALS.has(primaryGoal)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing primaryGoal '${primaryGoal}'. Must be one of canonical goals.`,
    };
  }

  const routineComplexity = skinProfile?.routine_complexity || payloadSnapshot?.routineComplexity;
  if (!routineComplexity || !ALLOWED_COMPLEXITY.has(routineComplexity)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid or missing routineComplexity '${routineComplexity}'. Must be one of canonical complexity levels.`,
    };
  }

  const costPreference = skinProfile?.cost_preference || payloadSnapshot?.costPreference || 'balanced';
  if (!ALLOWED_COST.has(costPreference)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid costPreference '${costPreference}'.`,
    };
  }

  const middayFeel = skinProfile?.midday_feel || payloadSnapshot?.middayFeel || 'comfortable';
  if (!ALLOWED_MIDDAY_FEEL.has(middayFeel)) {
    return {
      valid: false,
      code: 'INTAKE_CONTEXT_INVALID',
      error: `Invalid middayFeel '${middayFeel}'.`,
    };
  }

  const safety = payloadSnapshot?.safetyContext || {};
  const isPregnant =
    skinProfile?.is_pregnant_or_nursing === true ||
    safety.isPregnantOrNursing === true ||
    skinProfile?.pregnancy_status === 'yes';

  const confirmedProducts = (payloadSnapshot?.confirmedProducts || []).map((p: any) => {
    const rawCat = (p.category || 'other').toLowerCase();
    const category = VALID_CATEGORIES.has(rawCat) ? (rawCat as ProductCategory) : 'other';
    return {
      brand: p.brand || p.detectedBrand || 'Unknown Brand',
      name: p.name || p.detectedName || p.productName || 'Unknown Product',
      category,
      keyActives: Array.isArray(p.keyActives) ? p.keyActives : [],
    };
  });

  const context: AssembledRoutineContext = {
    userId: skinProfile?.user_id || payloadSnapshot?.userId || '',
    primaryGoal: primaryGoal as Goal,
    secondaryGoals: Array.isArray(skinProfile?.secondary_goals)
      ? skinProfile.secondary_goals
      : Array.isArray(payloadSnapshot?.secondaryGoals)
      ? payloadSnapshot.secondaryGoals
      : [],
    routineComplexity: routineComplexity as RoutineComplexity,
    costPreference: costPreference as ProductCostPreference,
    middayFeel: middayFeel as MiddayFeel,
    postCleanseTightness:
      skinProfile?.post_cleanse_tightness ?? payloadSnapshot?.postCleanseTightness ?? false,
    isPregnantOrNursing: isPregnant,
    pregnancyStatus: (skinProfile?.pregnancy_status || safety.pregnancyStatus || (isPregnant ? 'yes' : 'unanswered')) as any,
    sensitivitiesStatus: (skinProfile?.sensitivities_status || safety.sensitivitiesStatus || 'unanswered') as any,
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
