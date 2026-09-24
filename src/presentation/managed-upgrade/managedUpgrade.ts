/** Presentation input only. The caller supplies verified identity and persisted lifecycle. */
export type ManagedIdentity = 'anonymous' | 'permanent';
export type BaselineAngle = 'front' | 'left' | 'right';
export const baselineAngles: readonly BaselineAngle[] = ['front', 'left', 'right'];

export type ManagedContextField = 'goals' | 'skinBehavior' | 'sensitivities' | 'treatmentSafety' | 'routinePreference';
export type ManagedContext = Partial<Record<ManagedContextField, string | readonly string[] | null>>;

export interface ManagedUpgradeInput {
  identity: ManagedIdentity;
  knownContext: ManagedContext;
  managedAnswers?: ManagedContext;
  /** True only after the customer has reviewed current treatment and safety answers. */
  safetyReviewed: boolean;
  /** Roles with accepted private baseline captures. No URI or storage path belongs here. */
  acceptedBaselineAngles: readonly BaselineAngle[];
  lifecycle: 'draft' | 'submitted' | 'active';
}

export type ManagedUpgradeStage =
  | 'identity_required'
  | 'missing_information'
  | 'safety_review'
  | 'baseline_photos'
  | 'ready_to_submit'
  | 'submitted_preparing'
  | 'active_managed';

export interface ManagedUpgradeView {
  stage: ManagedUpgradeStage;
  reusedFields: readonly ManagedContextField[];
  missingFields: readonly ManagedContextField[];
  missingBaselineAngles: readonly BaselineAngle[];
  canSubmit: boolean;
}

export const managedFieldLabels: Record<ManagedContextField, string> = {
  goals: 'Skincare goals',
  skinBehavior: 'Skin behavior',
  sensitivities: 'Sensitivities and allergies',
  treatmentSafety: 'Treatments and prescription safety',
  routinePreference: 'Routine preferences',
};

const contextFields: readonly ManagedContextField[] = [
  'goals', 'skinBehavior', 'sensitivities', 'treatmentSafety', 'routinePreference',
];

function hasAnsweredValue(value: ManagedContext[ManagedContextField]): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((answer) => answer.trim().length > 0);
  return false;
}

export function showsDraftManagedIntake(stage: ManagedUpgradeStage): boolean {
  return stage === 'missing_information' || stage === 'safety_review'
    || stage === 'baseline_photos' || stage === 'ready_to_submit';
}

export function deriveManagedUpgradeView(input: ManagedUpgradeInput): ManagedUpgradeView {
  const reusedFields = contextFields.filter((field) => hasAnsweredValue(input.knownContext[field]));
  const missingFields = contextFields.filter(
    (field) => !hasAnsweredValue(input.knownContext[field]) && !hasAnsweredValue(input.managedAnswers?.[field]),
  );
  const missingBaselineAngles = baselineAngles.filter((angle) => !input.acceptedBaselineAngles.includes(angle));
  const stage: ManagedUpgradeStage = input.identity === 'anonymous' ? 'identity_required'
    : input.lifecycle === 'active' ? 'active_managed'
    : input.lifecycle === 'submitted' ? 'submitted_preparing'
    : missingFields.length ? 'missing_information'
    : !input.safetyReviewed ? 'safety_review'
    : missingBaselineAngles.length ? 'baseline_photos'
    : 'ready_to_submit';
  return { stage, reusedFields, missingFields, missingBaselineAngles, canSubmit: stage === 'ready_to_submit' };
}
