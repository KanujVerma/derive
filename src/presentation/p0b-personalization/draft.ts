/** Local collection seam. The composition owner supplies ownership and persistence. */
export type ListAnswer<T> = Answer<T[]> | { state: 'unsure' };
export type Answer<T> = { state: 'unanswered' } | { state: 'withheld' } | { state: 'answered'; value: T };
export const GOALS = [['breakouts', 'Breakouts'], ['dark_spots', 'Dark marks'], ['dryness', 'Dryness & barrier'], ['redness', 'Redness & sensitivity'], ['texture', 'Texture'], ['oiliness', 'Oiliness'], ['fine_lines', 'Fine lines'], ['simplify', 'Simplify my routine'], ['maintain', 'Maintain my skin']] as const;
export type Goal = (typeof GOALS)[number][0];
export type Treatment = 'topical_retinoid' | 'benzoyl_peroxide' | 'exfoliating_acid' | 'other_prescription';
export type Intent = 'add' | 'replace' | 'check_current';
export type SafetyField = 'pregnancy' | 'trying' | 'nursing';
export interface SafetyRelevance { fields: readonly SafetyField[]; evidenceReason: string }
export interface ContextDraft {
  intent: Answer<Intent>; primaryGoal: Answer<Goal> | { state: 'unsure' }; secondaryGoals: Goal[];
  behavior: Answer<'dry_tight' | 'balanced' | 'combination' | 'oily' | 'unsure'>;
  reactivity: Answer<'reacts_easily' | 'generally_tolerates' | 'unsure'>;
  treatments: ListAnswer<Treatment>; sensitivities: ListAnswer<string>;
  pregnancy: Answer<'yes' | 'no' | 'unsure'>; trying: Answer<'yes' | 'no' | 'unsure'>; nursing: Answer<'yes' | 'no' | 'unsure'>;
}
export function createContextDraft(initial?: ContextDraft): ContextDraft {
  if (initial) return { ...initial, intent: { ...initial.intent }, primaryGoal: { ...initial.primaryGoal }, secondaryGoals: [...initial.secondaryGoals], behavior: { ...initial.behavior }, reactivity: { ...initial.reactivity }, treatments: initial.treatments.state === 'answered' ? { state: 'answered', value: [...initial.treatments.value] } : { ...initial.treatments }, sensitivities: initial.sensitivities.state === 'answered' ? { state: 'answered', value: [...initial.sensitivities.value] } : { ...initial.sensitivities }, pregnancy: { ...initial.pregnancy }, trying: { ...initial.trying }, nursing: { ...initial.nursing } };
  return { intent: { state: 'unanswered' }, primaryGoal: { state: 'unanswered' }, secondaryGoals: [], behavior: { state: 'unanswered' }, reactivity: { state: 'unanswered' }, treatments: { state: 'unanswered' }, sensitivities: { state: 'unanswered' }, pregnancy: { state: 'unanswered' }, trying: { state: 'unanswered' }, nursing: { state: 'unanswered' } };
}
export function toggleSecondaryGoal(draft: ContextDraft, goal: Goal): ContextDraft {
  if (draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === goal) return draft;
  const selected = draft.secondaryGoals.includes(goal);
  if (!selected && draft.secondaryGoals.length >= 2) return draft;
  return { ...draft, secondaryGoals: selected ? draft.secondaryGoals.filter(value => value !== goal) : [...draft.secondaryGoals, goal] };
}
export function relevantQuestions(relevance?: SafetyRelevance): SafetyField[] {
  return relevance?.evidenceReason.trim() ? [...new Set(relevance.fields)] : [];
}
export function validateContextDraft(draft: ContextDraft): string | null {
  if (draft.secondaryGoals.length > 2) return 'Choose up to two other goals.';
  if (new Set(draft.secondaryGoals).size !== draft.secondaryGoals.length || (draft.primaryGoal.state === 'answered' && draft.secondaryGoals.includes(draft.primaryGoal.value))) return 'Choose each goal once.';
  return null;
}
export type RoutineFrequency = { kind: 'unknown' } | { kind: 'qualitative'; value: 'daily' | 'most_days' | 'few_times_week' | 'weekly' | 'less_often' | 'as_needed' } | { kind: 'exact'; count: number; unit: 'day' | 'week' | 'month' };
export type RoutineReference = { kind: 'manual'; label: string; verification: 'unverified' } | { kind: 'catalog'; label: string; productId: string; variantId: string | null; formulaVersionId: string | null };
export interface RoutineItemDraft {
  id: string; reference: RoutineReference;
  /** Null is a local pending choice and must never be persisted. */
  status: 'current' | 'paused' | 'stopped' | 'occasional' | null; timing: 'am' | 'pm' | 'both' | 'unknown'; frequency: RoutineFrequency;
  startedOn?: string | null; stoppedOn?: string | null; duration?: { count: number; unit: 'days' | 'weeks' | 'months' | 'years' } | null;
}
export interface RoutineDraft { completeness: 'partial' | 'complete' | 'unknown'; items: RoutineItemDraft[] }
export function createRoutineDraft(initial?: RoutineDraft): RoutineDraft { return initial ? { completeness: initial.completeness, items: initial.items.map(item => ({ ...item, reference: { ...item.reference }, frequency: { ...item.frequency }, duration: item.duration ? { ...item.duration } : item.duration })) } : { completeness: 'unknown', items: [] }; }
export function manualRoutineItem(id: string, label: string): RoutineItemDraft {
  return { id, reference: { kind: 'manual', label: label.trim(), verification: 'unverified' }, status: null, timing: 'unknown', frequency: { kind: 'unknown' }, startedOn: null, stoppedOn: null, duration: null };
}
export function validateRoutineDraft(draft: RoutineDraft): string | null {
  if (draft.items.length > 50) return 'Add up to 50 routine products.';
  if (new Set(draft.items.map(item => item.id)).size !== draft.items.length) return 'Each routine item needs a distinct ID.';
  for (const item of draft.items) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) return 'Each routine item needs a valid UUID.';
    if (!item.reference.label.trim()) return 'Enter a product name.';
    if (item.reference.kind === 'catalog' && item.reference.formulaVersionId && !item.reference.variantId) return 'A formula reference needs its variant reference.';
    if (item.frequency.kind === 'exact' && (!Number.isFinite(item.frequency.count) || item.frequency.count <= 0 || item.frequency.count > 100)) return 'Use an exact count from 1 to 100.';
  }
  if (draft.items.some(item => item.status === null)) return 'Choose a use status for each product.';
  return null;
}
