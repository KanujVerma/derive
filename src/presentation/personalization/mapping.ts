import type { FreeSkinProfile, FreeSkinProfileInput } from '../../contracts/FreePersonalFit.ts';
import type { Goal, MiddayFeel } from '../../types/schema.ts';
import type { PersonalizationDraft, SkinBehavior, SkinGoal, Treatment } from './draft.ts';

const goalToCanonical: Record<SkinGoal, Goal> = {
  breakouts: 'breakouts', dark_marks: 'dark_spots', dryness_barrier: 'dryness',
  redness_sensitivity: 'redness', texture: 'texture', oiliness: 'oiliness',
  aging_fine_lines: 'fine_lines', simplify: 'simplify', maintain: 'maintain',
};
const goalFromCanonical: Record<Goal, SkinGoal> = {
  breakouts: 'breakouts', dark_spots: 'dark_marks', dryness: 'dryness_barrier',
  redness: 'redness_sensitivity', texture: 'texture', oiliness: 'oiliness',
  fine_lines: 'aging_fine_lines', simplify: 'simplify', maintain: 'maintain',
};
const behaviorToCanonical: Record<SkinBehavior, MiddayFeel> = {
  dry_tight: 'dry_tight', balanced: 'comfortable', combination: 'combination',
  oily: 'oily_shiny', unsure: 'unsure',
};
const behaviorFromCanonical: Record<MiddayFeel, SkinBehavior> = {
  dry_tight: 'dry_tight', comfortable: 'balanced', combination: 'combination',
  oily_shiny: 'oily', unsure: 'unsure',
};
const treatmentToCanonical: Record<Treatment, FreeSkinProfileInput['currentTreatments'][number]> = {
  retinoids: 'topical_retinoid', benzoyl_peroxide: 'benzoyl_peroxide',
  acids: 'exfoliating_acid', other_prescription: 'other_prescription',
};
const treatmentFromCanonical: Record<FreeSkinProfileInput['currentTreatments'][number], Treatment> = {
  topical_retinoid: 'retinoids', benzoyl_peroxide: 'benzoyl_peroxide',
  exfoliating_acid: 'acids', other_prescription: 'other_prescription',
};

function reportedNames(names: string[]): string[] {
  const normalized = names.map((name) => name.trim());
  if (normalized.length > 10 || normalized.some((name) => name.length < 2 || name.length > 80 || /[\x00-\x1f\x7f]/.test(name))
    || new Set(normalized.map((name) => name.toLowerCase())).size !== normalized.length) {
    throw new Error('Enter up to ten distinct ingredient names, one per line.');
  }
  return normalized;
}

/** Complete replacement snapshot. Empty answers retain the canonical unknown state. */
export function toFreeSkinProfileInput(draft: PersonalizationDraft): FreeSkinProfileInput {
  const knownSensitivities = draft.sensitivityOrAllergy === 'yes' ? reportedNames(draft.knownSensitivities) : [];
  if (draft.sensitivityOrAllergy === 'yes' && !knownSensitivities.length) {
    throw new Error('Add at least one ingredient you know you react to.');
  }
  if (draft.treatmentStatus === 'reported' && !draft.treatments.length) {
    throw new Error('Choose a treatment or select none.');
  }
  return {
    goals: draft.goals.map((goal) => goalToCanonical[goal]),
    skinBehavior: draft.skinBehavior ? behaviorToCanonical[draft.skinBehavior] : 'unsure',
    reactivity: draft.reactivity ?? 'unsure',
    pregnancyStatus: draft.pregnancy ?? 'unanswered',
    sensitivitiesStatus: draft.sensitivityOrAllergy === 'yes' ? 'reported'
      : draft.sensitivityOrAllergy === 'no' ? 'none_known' : 'unanswered',
    knownSensitivities,
    treatmentStatus: draft.treatmentStatus,
    currentTreatments: draft.treatmentStatus === 'reported'
      ? draft.treatments.map((treatment) => treatmentToCanonical[treatment]) : [],
  };
}

export function fromFreeSkinProfile(profile: FreeSkinProfile): PersonalizationDraft {
  return {
    goals: profile.goals.map((goal) => goalFromCanonical[goal]),
    skinBehavior: behaviorFromCanonical[profile.skinBehavior],
    reactivity: profile.reactivity,
    pregnancy: profile.pregnancyStatus === 'unanswered' ? null : profile.pregnancyStatus,
    sensitivityOrAllergy: profile.sensitivitiesStatus === 'reported' ? 'yes'
      : profile.sensitivitiesStatus === 'none_known' ? 'no' : null,
    knownSensitivities: [...profile.knownSensitivities],
    treatmentStatus: profile.treatmentStatus,
    treatments: profile.currentTreatments.map((treatment) => treatmentFromCanonical[treatment]),
  };
}

/** Customer-facing validation before attempting an owner-bound save. */
export function validatePersonalizationDraft(draft: PersonalizationDraft): string | null {
  try { toFreeSkinProfileInput(draft); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Check your answers and try again.'; }
}
