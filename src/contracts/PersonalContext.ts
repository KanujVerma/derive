/** P0-B storage context. Reports are not catalog facts or ingredient causation. */
export type ContextGoal = 'breakouts' | 'dark_spots' | 'dryness' | 'oiliness' | 'texture' | 'redness' | 'fine_lines' | 'simplify' | 'maintain';
export type SensitiveAnswer = 'yes' | 'no' | 'unsure' | 'unanswered' | 'withheld';
export interface PersonalProfileInput {
  intent: 'add' | 'replace' | 'check_current' | 'unanswered' | 'withheld';
  primaryGoal: ContextGoal | null;
  secondaryGoals: ContextGoal[];
  skinBehavior: 'dry_tight' | 'comfortable' | 'oily_shiny' | 'combination' | 'unsure' | 'unanswered' | 'withheld';
  reactivity: 'reacts_easily' | 'generally_tolerates' | 'unsure' | 'unanswered' | 'withheld';
  reproductive: { pregnancy: SensitiveAnswer; tryingToConceive: SensitiveAnswer; nursing: SensitiveAnswer };
  sensitivities: { status: 'none_known' | 'reported' | 'unsure' | 'unanswered' | 'withheld'; values: string[] };
  treatments: { status: 'none' | 'reported' | 'unsure' | 'unanswered' | 'withheld'; values: Array<'topical_retinoid' | 'benzoyl_peroxide' | 'exfoliating_acid' | 'other_prescription'> };
}
export type ContextProductReference =
  | { kind: 'catalog'; productId: string; variantId: string | null; formulaVersionId: string | null }
  | { kind: 'manual'; name: string; brand?: string };
export type ReportedFrequency = { kind: 'unknown' }
  | { kind: 'qualitative'; value: 'daily' | 'most_days' | 'few_times_week' | 'weekly' | 'less_often' | 'as_needed' }
  | { kind: 'exact'; count: number; unit: 'day' | 'week' | 'month' };
export interface ReportedUseContext {
  timing: 'am' | 'pm' | 'both' | 'unknown';
  frequency: ReportedFrequency;
  startedOn: string | null;
  stoppedOn: string | null;
  duration: { count: number; unit: 'days' | 'weeks' | 'months' | 'years' } | null;
}
export interface PersonalRoutineItem extends ReportedUseContext {
  id: string;
  reference: ContextProductReference;
  state: 'current' | 'paused' | 'stopped' | 'occasional';
}
export interface PersonalRoutineInput { completeness: 'partial' | 'complete' | 'unknown'; items: PersonalRoutineItem[] }
export interface PersonalExperienceInput {
  /** Stable experience ID. Corrections retain this ID and name the previous revision. */
  id: string;
  reference: ContextProductReference;
  kind: 'reacted' | 'tolerated' | 'no_reaction_reported' | 'liked' | 'finished' | 'ineffective';
  occurred: { start: string | null; end: string | null };
  useContext: ReportedUseContext | null;
  symptoms: string[];
  note: string | null;
}
export type PersonalContextRequest = { operation: 'get_context' }
  | { operation: 'get_revision'; revisionId: string }
  | { operation: 'get_experiences'; atRevision: number; limit?: number; cursor?: string; productId?: string }
  | { operation: 'save_profile'; requestId: string; baseRevision: number; profile: PersonalProfileInput }
  | { operation: 'save_routine'; requestId: string; baseRevision: number; routine: PersonalRoutineInput }
  | { operation: 'append_experience'; requestId: string; baseRevision: number; supersedesRevisionId: string | null; experience: PersonalExperienceInput };
export interface PersonalContextRevision<T> {
  id: string; revision: number; ownerId: string; recordedAt: string; provenance: 'self_report';
  supersedesRevisionId: string | null; data: T;
}
export interface PersonalContextSnapshot {
  version: 'personal-context-v1'; ownerId: string; revision: number;
  profile: PersonalContextRevision<PersonalProfileInput> | null;
  routine: PersonalContextRevision<PersonalRoutineInput> | null;
  experiences: PersonalContextRevision<PersonalExperienceInput>[];
  /** False only when the entire current history fits this bounded snapshot. */
  historyTruncated: boolean;
  historyRevision: string | null;
  /** Preserved as legacy observations, never promoted into schedule/formula or distinct reproductive answers. */
  legacy: { source: 'legacy_free_context'; profile: Record<string, unknown> | null; products: Record<string, unknown>[]; experiences: Record<string, unknown>[]; truncated: boolean };
}
export interface PersonalContextWriteResult { revision: PersonalContextRevision<PersonalProfileInput | PersonalRoutineInput | PersonalExperienceInput>; replayed: boolean }

export interface PersonalExperiencePage { items: PersonalContextRevision<PersonalExperienceInput>[]; nextCursor: string | null; atRevision: number }
