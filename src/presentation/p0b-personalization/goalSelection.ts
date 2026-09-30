import type { ContextDraft, Goal } from './draft';

/** Selection order is the canonical primary goal followed by secondary goals. */
export function toggleProfileGoal(draft: ContextDraft, goal: Goal): ContextDraft {
  const selected = draft.primaryGoal.state === 'answered' ? [draft.primaryGoal.value, ...draft.secondaryGoals] : [...draft.secondaryGoals];
  const index = selected.indexOf(goal);
  if (index === -1) {
    if (selected.length >= 3) return draft;
    const next = [...selected, goal];
    return { ...draft, primaryGoal: next.length ? { state: 'answered', value: next[0] } : { state: 'unanswered' }, secondaryGoals: next.slice(1) };
  }
  if (index > 0) {
    const next = [...selected];
    next[0] = goal;
    next[index] = selected[0];
    return { ...draft, primaryGoal: { state: 'answered', value: next[0] }, secondaryGoals: next.slice(1) };
  }
  const next = selected.filter(value => value !== goal);
  return { ...draft, primaryGoal: next.length ? { state: 'answered', value: next[0] } : { state: 'unanswered' }, secondaryGoals: next.slice(1) };
}
