import type { IngredientCosmeticContext } from './ingredient-context.ts';

/** Mirrors the bounded Jev cue policy. No benefit is inferred for an unsupported goal. */
export function hasSupportedExplanationCue(ingredientsText: string, category: 'skincare' | 'other_personal_care',
  context: IngredientCosmeticContext | null): boolean {
  if (!context) return false;
  const entries = new Set(ingredientsText.split(/[,;\n]/).map(s => s.normalize('NFKC').toLowerCase().replace(/[.\u200b]/g, '').replace(/\s+/g, ' ').trim()));
  const has = (...names: string[]) => names.some(name => entries.has(name));
  return Boolean(context.reactivity === 'reacts_easily' && has('fragrance', 'parfum', 'perfume')
    || category === 'skincare' && (
      (context.skinBehavior === 'dry_tight' || context.goals.includes('dryness')) && has('glycerin', 'glycerol', 'petrolatum', 'white petrolatum')
      || context.goals.some(g => ['dark_spots', 'oiliness'].includes(g)) && has('niacinamide')
      || context.goals.includes('breakouts') && has('salicylic acid')));
}
