import type { ContextGoal, PersonalProfileInput } from '../contracts/PersonalContext.ts';

/** Minimum cosmetic projection only. Still private context, not provider consent or safety clearance. */
export interface IngredientCosmeticContext {
  goals: ContextGoal[];
  skinBehavior: PersonalProfileInput['skinBehavior'];
  reactivity: PersonalProfileInput['reactivity'];
}

const GOALS = new Set<ContextGoal>([
  'breakouts', 'dark_spots', 'dryness', 'oiliness', 'texture', 'redness', 'fine_lines', 'simplify', 'maintain',
]);
const BEHAVIORS = new Set<IngredientCosmeticContext['skinBehavior']>([
  'dry_tight', 'comfortable', 'oily_shiny', 'combination', 'unsure', 'unanswered', 'withheld',
]);
const REACTIVITY = new Set<IngredientCosmeticContext['reactivity']>([
  'reacts_easily', 'generally_tolerates', 'unsure', 'unanswered', 'withheld',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function goals(values: unknown): ContextGoal[] {
  if (!Array.isArray(values)) return [];
  // Stored profiles have at most nine supported goals. Never iterate an unbounded external array.
  return [...new Set(values.slice(0, GOALS.size).filter((value): value is ContextGoal =>
    typeof value === 'string' && GOALS.has(value as ContextGoal)))];
}

function project(profile: Record<string, unknown>, selectedGoals: unknown): IngredientCosmeticContext {
  return {
    goals: goals(selectedGoals),
    skinBehavior: typeof profile.skinBehavior === 'string'
      && BEHAVIORS.has(profile.skinBehavior as IngredientCosmeticContext['skinBehavior'])
      ? profile.skinBehavior as IngredientCosmeticContext['skinBehavior'] : 'unanswered',
    reactivity: typeof profile.reactivity === 'string'
      && REACTIVITY.has(profile.reactivity as IngredientCosmeticContext['reactivity'])
      ? profile.reactivity as IngredientCosmeticContext['reactivity'] : 'unanswered',
  };
}

/** Reads an existing S-FREE-2 profile without IDs, timestamps, free text or safety disclosures. */
export function cosmeticContextFromFreeProfile(value: unknown): IngredientCosmeticContext | null {
  const profile = record(value);
  return profile ? project(profile, profile.goals) : null;
}

/** Reads only profile.data, never a context snapshot, routine, history or revision envelope. */
export function cosmeticContextFromPersonalProfile(value: unknown): IngredientCosmeticContext | null {
  const profile = record(value);
  if (!profile) return null;
  const secondary = Array.isArray(profile.secondaryGoals) ? profile.secondaryGoals.slice(0, GOALS.size) : [];
  const selected = typeof profile.primaryGoal === 'string' && GOALS.has(profile.primaryGoal as ContextGoal)
    ? [profile.primaryGoal, ...secondary] : secondary;
  return project(profile, selected);
}
