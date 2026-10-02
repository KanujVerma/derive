/** Product facts only; never skin context or client-selected fetch URLs. */
export interface WebProductIngredientsRequest {
  /** A real validated GTIN, or explicitly '' for a distinctive named comparison. Never invent a UPC. */
  barcode: string;
  name: string;
  brand: string | null;
  size: string | null;
}

/** A complete named identity includes product role plus named line/variant.
 * Partial names enter discovery instead of direct formula matching.
 * Neither path establishes verified identity or formula.
 */
export function distinctiveNamedIngredientIdentity(name: string, brand: string | null): boolean {
  if (!brand?.trim()) return false;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\d]+/g, ' ').trim();
  const normalized = normalize(name);
  if (!/\b(?:deodorant|antiperspirant|body wash|shampoo|conditioner|cleanser|face wash|lotion|cream|moisturizer|sunscreen|serum|toner|exfoliant|face mask|facial mask|face oil|body oil)\b/.test(normalized)) return false;
  const brandTokens = new Set(normalize(brand).split(' '));
  if (![...brandTokens].some(token => /[a-z]/.test(token))) return false;
  const generic = new Set(['for', 'and', 'with', 'the', 'a', 'of', 'by', 'men', 'women', 'scent',
    'deodorant', 'antiperspirant', 'body', 'wash', 'shampoo', 'conditioner', 'cleanser', 'face', 'facial',
    'lotion', 'cream', 'moisturizer', 'sunscreen', 'serum', 'toner', 'exfoliant', 'mask', 'oil',
    'oz', 'ounce', 'ounces', 'fl', 'fluid', 'ml', 'milliliter', 'milliliters', 'g', 'gram', 'grams',
    'pack', 'count', 'ct', 'stick', 'bottle']);
  return normalized.split(' ').some(token => /[a-z]/.test(token) && !brandTokens.has(token) && !generic.has(token));
}

/** Eligibility to discover a product, not permission to assign it a formula.
 * A partial branded name may be researched; published candidates supply the missing role.
 */
export function researchableNamedIngredientIdentity(name: string, brand: string | null): boolean {
  if (distinctiveNamedIngredientIdentity(name, brand)) return true;
  if (!brand?.trim()) return false;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\d]+/g, ' ').trim();
  const brandTokens = new Set(normalize(brand).split(' '));
  const generic = new Set(['for', 'and', 'with', 'the', 'a', 'of', 'by', 'men', 'women', 'scent',
    'deodorant', 'antiperspirant', 'body', 'wash', 'shampoo', 'conditioner', 'cleanser', 'face', 'facial',
    'lotion', 'cream', 'moisturizer', 'sunscreen', 'serum', 'toner', 'exfoliant', 'mask', 'oil',
    'oz', 'ounce', 'ounces', 'fl', 'fluid', 'ml', 'g', 'pack', 'count', 'stick', 'bottle']);
  return [...brandTokens].some(token => /[a-z]/.test(token))
    && normalize(name).split(' ').some(token => /[a-z]/.test(token) && !brandTokens.has(token) && !generic.has(token));
}

export interface IngredientProductCandidate { name: string; brand: string }

/** Extract a declared, exact known brand prefix only. No product form or variant inference. */
export function namedIngredientBrand(name: string): string | null {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const brand of ['Old Spice', 'Aveeno', 'CeraVe', 'Cetaphil', 'Neutrogena', 'Dove',
    'Eucerin', 'Aquaphor', 'Vaseline', 'La Roche Posay', 'La Roche-Posay', 'Sun Bum', 'Coppertone']) {
    if (normalized.startsWith(brand.toLowerCase() + ' ')) return brand;
  }
  return null;
}

export interface WebIngredientEvidence {
  productName: string;
  ingredientsText: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  basis: 'published_web';
  formulaVerified: false;
}
export type WebProductIngredientsResult = {
  status: 'found';
  evidence: WebIngredientEvidence;
} | { status: 'ambiguous'; candidates?: IngredientProductCandidate[] }
  | { status: 'not_found' | 'rate_limited' | 'configuration_required' | 'unavailable' };
export type WebProductIngredientLookup = WebProductIngredientsResult;
