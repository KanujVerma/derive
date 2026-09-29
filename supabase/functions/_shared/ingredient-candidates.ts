/** Service-side lookup only; callers still run the existing truth resolver. */
export interface IngredientCandidateRow {
  id: string;
  variant_id: string | null;
  ingredients: string[];
  region_code: string | null;
}
export class IngredientCandidateLookupError extends Error {
  readonly code: 'CATALOG_UNAVAILABLE' | 'CATALOG_TOO_LARGE';
  constructor(code: 'CATALOG_UNAVAILABLE' | 'CATALOG_TOO_LARGE') {
    super(code);
    this.code = code;
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ingredientEvidenceKey = (value: string): string => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
export function exactIngredientEvidence(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => Boolean(ingredientEvidenceKey(value))
    && ingredientEvidenceKey(value) === ingredientEvidenceKey(b[i]));
}
/** Keeps all markets for the resolver's region mismatch decision. */
export async function lookupIngredientCandidates(admin: any, userId: string, freeOnly: boolean,
  ingredients: string[]): Promise<IngredientCandidateRow[]> {
  if (!UUID.test(userId) || typeof freeOnly !== 'boolean' || !Array.isArray(ingredients)
    || ingredients.length < 1 || ingredients.length > 300
    || ingredients.some((value) => typeof value !== 'string' || !ingredientEvidenceKey(value))
    || new TextEncoder().encode(JSON.stringify(ingredients)).byteLength > 180000) {
    throw new IngredientCandidateLookupError('CATALOG_UNAVAILABLE');
  }
  const result = await admin.rpc('lookup_ingredient_candidate_ids', {
    p_ingredients: ingredients, p_free_only: freeOnly, p_user_id: userId,
  });
  if (result.error || !Array.isArray(result.data)
    || result.data.some((id: unknown) => typeof id !== 'string' || !UUID.test(id))
    || new Set(result.data).size !== result.data.length) throw new IngredientCandidateLookupError('CATALOG_UNAVAILABLE');
  if (result.data.length > 100) throw new IngredientCandidateLookupError('CATALOG_TOO_LARGE');
  if (result.data.length === 0) return [];
  const rows = await admin.from('product_formula_versions').select('id,variant_id,ingredients,region_code')
    .in('id', result.data).eq('verification_status', 'verified');
  if (rows.error || !Array.isArray(rows.data) || rows.data.length !== result.data.length
    || rows.data.some((row: any) => !row || typeof row !== 'object' || !result.data.includes(row.id)
      || (row.variant_id !== null && (typeof row.variant_id !== 'string' || !UUID.test(row.variant_id)))
      || (row.region_code !== null && typeof row.region_code !== 'string')
      || !Array.isArray(row.ingredients) || row.ingredients.some((value: unknown) => typeof value !== 'string')
      || !exactIngredientEvidence(ingredients, row.ingredients))
    || new Set(rows.data.map((row: IngredientCandidateRow) => row.id)).size !== result.data.length) {
    throw new IngredientCandidateLookupError('CATALOG_UNAVAILABLE');
  }
  return rows.data;
}
