/** Local collection seam. The composition owner supplies ownership and persistence. */
export type Answer<T> = { state: 'unanswered' } | { state: 'withheld' } | { state: 'answered'; value: T };
export type Goal = 'hydration' | 'blemishes' | 'texture' | 'tone' | 'comfort';
export type Intent = 'add' | 'replace' | 'check_current';
export type SafetyField = 'pregnancy' | 'trying' | 'nursing';
export interface SafetyRelevance { fields: readonly SafetyField[]; evidenceReason: string }
export interface ContextDraft {
  intent: Answer<Intent>; primaryGoal: Answer<Goal>; secondaryGoals: Goal[];
  behavior: Answer<'dry_tight' | 'balanced' | 'combination' | 'oily' | 'unsure'>;
  reactivity: Answer<'reacts_easily' | 'generally_tolerates' | 'unsure'>;
  treatments: Answer<string[]>; sensitivities: Answer<string[]>;
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
export type RoutineFrequency = { kind: 'unknown' } | { kind: 'qualitative'; value: 'daily' | 'few_times_weekly' | 'occasionally' } | { kind: 'exact'; timesPerWeek: number };
export interface RoutineItemDraft {
  id: string; reference: { kind: 'manual'; label: string; verification: 'unverified' };
  status: 'current' | 'paused' | 'stopped' | 'occasional'; timing: 'am' | 'pm' | 'both' | 'unknown'; frequency: RoutineFrequency;
}
export interface RoutineDraft { completeness: 'partial' | 'complete' | 'unknown'; items: RoutineItemDraft[] }
export function createRoutineDraft(initial?: RoutineDraft): RoutineDraft { return initial ? { completeness: initial.completeness, items: initial.items.map(item => ({ ...item, reference: { ...item.reference }, frequency: { ...item.frequency } })) } : { completeness: 'unknown', items: [] }; }
export function manualRoutineItem(id: string, label: string): RoutineItemDraft {
  return { id, reference: { kind: 'manual', label: label.trim(), verification: 'unverified' }, status: 'current', timing: 'unknown', frequency: { kind: 'unknown' } };
}
