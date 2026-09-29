import type { ContextDraft, Goal } from './draft';

/** Selection order is represented by the canonical main goal followed by Also goals. */
export function toggleProfileGoal(draft: ContextDraft, goal: Goal): ContextDraft {
  const selected = draft.primaryGoal.state === 'answered' ? [draft.primaryGoal.value, ...draft.secondaryGoals] : [...draft.secondaryGoals];
  if (!selected.includes(goal) && selected.length >= 3) return draft;
  const next = selected.includes(goal) ? selected.filter(value => value !== goal) : [...selected, goal];
  return { ...draft, primaryGoal: next.length ? { state: 'answered', value: next[0] } : { state: 'unanswered' }, secondaryGoals: next.slice(1) };
}
