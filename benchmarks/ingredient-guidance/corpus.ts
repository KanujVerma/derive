import { createHash } from 'node:crypto';
import type { IngredientCosmeticContext } from '../../src/domain/ingredient-context.ts';

export interface GuidanceCase {
  id: string;
  input: { productName: string; ingredientsText: string; category: 'skincare' | 'other_personal_care'; context: IngredientCosmeticContext };
  expected: { moisture: boolean; fragranceCaution: boolean; dryingAlcoholCaution: boolean };
  expectedStatus: 'ready' | 'profile_missing';
}
const dry: IngredientCosmeticContext = { goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates' };
const comfortable: IngredientCosmeticContext = { goals: ['maintain'], skinBehavior: 'comfortable', reactivity: 'generally_tolerates' };
const reactive: IngredientCosmeticContext = { goals: ['maintain'], skinBehavior: 'comfortable', reactivity: 'reacts_easily' };
const unknown: IngredientCosmeticContext = { goals: [], skinBehavior: 'unanswered', reactivity: 'unanswered' };
function example(id: string, ingredientsText: string, context: IngredientCosmeticContext,
  expected: GuidanceCase['expected'], category: GuidanceCase['input']['category'] = 'skincare',
  expectedStatus: GuidanceCase['expectedStatus'] = 'ready'): GuidanceCase {
  return { id, input: { productName: 'Synthetic cosmetic test product', ingredientsText, context, category }, expected, expectedStatus };
}
const none = { moisture: false, fragranceCaution: false, dryingAlcoholCaution: false };
/** Synthetic rule-regression scenarios, NOT real product formulas or independent clinical gold.
 * Expectations cover existing AAD-grounded moisture/fragrance/alcohol notes only.
 * A founder-blinded utility review is still needed before selecting a model.
 */
export const CASES: readonly GuidanceCase[] = [
  example('dry-humectant', 'Water, Glycerin, Petrolatum', dry, { ...none, moisture: true }),
  example('comfortable-humectant', 'Water, Glycerin, Petrolatum', comfortable, none),
  example('reactive-fragrance', 'Water, Glycerin, Parfum', reactive, { ...none, fragranceCaution: true }),
  example('tolerant-fragrance', 'Water, Glycerin, Parfum', comfortable, none),
  example('dry-denatured-alcohol', 'Water, Alcohol Denat., Glycerin', dry, { ...none, moisture: true, dryingAlcoholCaution: true }),
  example('dry-fatty-alcohol', 'Water, Cetyl Alcohol, Stearyl Alcohol', dry, none),
  example('dry-multiple-moisturizers', 'Water, Dimethicone, Sodium Hyaluronate, Petrolatum', dry, { ...none, moisture: true }),
  example('unknown-profile', 'Water, Glycerin, Parfum', unknown, none, 'skincare', 'profile_missing'),
  example('reactive-deodorant', 'Dipropylene Glycol, Water, Propylene Glycol, Sodium Stearate, Fragrance', reactive,
    { ...none, fragranceCaution: true }, 'other_personal_care'),
  example('dry-facial-context-deodorant', 'Water, Glycerin, Fragrance', dry, none, 'other_personal_care'),
  example('dry-facial-context-shampoo', 'Water, Glycerin, Cetyl Alcohol', dry, none, 'other_personal_care'),
  example('unrelated-goal', 'Water, Glycerin, Dimethicone', { goals: ['dark_spots'], skinBehavior: 'comfortable', reactivity: 'generally_tolerates' }, none),
];
export const CORPUS_VERSION = 'synthetic-ingredient-guidance/2';
export function corpusSha256(): string { return createHash('sha256').update(JSON.stringify(CASES)).digest('hex'); }
/** Project only supported inputs; no id, expected labels, clinical gold or owner reaches models. */
export function projectCase(c: GuidanceCase): GuidanceCase['input'] {
  return { productName: c.input.productName, ingredientsText: c.input.ingredientsText, category: c.input.category,
    context: { goals: c.input.category === 'skincare' ? [...c.input.context.goals] : [],
      skinBehavior: c.input.category === 'skincare' ? c.input.context.skinBehavior : 'unanswered', reactivity: c.input.context.reactivity } };
}
