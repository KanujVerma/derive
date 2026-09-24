export const GOALS = [
  ['breakouts', 'Breakouts'], ['dark_marks', 'Dark marks'],
  ['dryness_barrier', 'Dryness & barrier'], ['redness_sensitivity', 'Redness & sensitivity'],
  ['texture', 'Texture'], ['oiliness', 'Oiliness'], ['aging_fine_lines', 'Fine lines'],
  ['simplify', 'Simplify my routine'], ['maintain', 'Maintain my skin'],
] as const;
export type SkinGoal = (typeof GOALS)[number][0];
export type SkinBehavior = 'dry_tight' | 'balanced' | 'combination' | 'oily' | 'unsure';
export type Reactivity = 'reacts_easily' | 'generally_tolerates' | 'unsure';
export type Treatment = 'retinoids' | 'benzoyl_peroxide' | 'acids' | 'other_prescription';
export type PersonalizationStep = 'goals' | 'behavior' | 'context' | 'complete';

export interface PersonalizationDraft {
  goals: SkinGoal[];
  skinBehavior: SkinBehavior | null;
  reactivity: Reactivity | null;
  treatments: Treatment[];
  treatmentStatus: 'none' | 'reported' | 'unanswered';
  sensitivityOrAllergy: 'yes' | 'no' | 'unsure' | null;
  knownSensitivities: string[];
  pregnancy: 'yes' | 'no' | 'prefer_not_to_say' | null;
}

export function createPersonalizationDraft(existing?: PersonalizationDraft): PersonalizationDraft {
  return existing ? { ...existing, goals: [...existing.goals], treatments: [...existing.treatments],
    knownSensitivities: [...existing.knownSensitivities] } : {
    goals: [], skinBehavior: null, reactivity: null, treatments: [],
    treatmentStatus: 'unanswered', sensitivityOrAllergy: null, knownSensitivities: [], pregnancy: null,
  };
}

export function toggleGoal(draft: PersonalizationDraft, goal: SkinGoal): PersonalizationDraft {
  if (draft.goals.includes(goal)) return { ...draft, goals: draft.goals.filter((item) => item !== goal) };
  if (draft.goals.length >= 3) return draft;
  return { ...draft, goals: [...draft.goals, goal] };
}

export function toggleTreatment(draft: PersonalizationDraft, treatment: Treatment): PersonalizationDraft {
  const treatments = draft.treatments.includes(treatment)
    ? draft.treatments.filter((item) => item !== treatment)
    : [...draft.treatments, treatment];
  return { ...draft, treatments, treatmentStatus: treatments.length ? 'reported' : 'unanswered' };
}

export function nextPersonalizationStep(step: PersonalizationStep): PersonalizationStep {
  return step === 'goals' ? 'behavior' : step === 'behavior' ? 'context' : 'complete';
}

/** A local, explicit completion payload. Persistence belongs to S-FREE-2. */
export function completePersonalization(draft: PersonalizationDraft): PersonalizationDraft {
  return createPersonalizationDraft(draft);
}
