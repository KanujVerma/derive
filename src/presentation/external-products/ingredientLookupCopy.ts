import type { WebProductIngredientLookup } from '../../contracts/WebProductIngredients.ts';

type MissingStatus = Exclude<WebProductIngredientLookup['status'], 'found'>;

/** A failed retrieval is not a verdict about the product or the customer's skin. */
export function ingredientLookupCopy(status: MissingStatus): { title: string; body: string } {
  switch (status) {
    case 'ambiguous': return {
      title: 'We need the exact ingredient list',
      body: 'We found similar products, but could not match a list to this one. Add the ingredients from your package below.',
    };
    case 'rate_limited': return {
      title: 'Ingredient search is temporarily paused',
      body: 'The search limit has been reached. Try again later, or add the ingredients from your package below.',
    };
    case 'configuration_required': return {
      title: 'Ingredient search is not set up yet',
      body: 'Your product match is still here. You can add the ingredients from your package below to get local notes.',
    };
    case 'unavailable': return {
      title: 'Ingredient search could not finish',
      body: 'Your product match is still here. Try again, or add the ingredients from your package below.',
    };
    case 'not_found': return {
      title: 'No matching ingredient list yet',
      body: 'We could not retrieve a published list for this product. Add the ingredients from your package below to get local notes.',
    };
  }
}
