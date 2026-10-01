import type { ProductIngredientQuery, ProductIngredientLookup, PublishedIngredientEvidence, IngredientSourceStatus }
  from '../../../src/contracts/ProductIngredientLookup.ts';
import { isValidGtin } from './product-identity.ts';

const label = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0
  && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const optional = (v: unknown, max: number) => v === null || label(v, max);
export function parseProductIngredientQuery(value: unknown): ProductIngredientQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_INGREDIENT_QUERY');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 4 || typeof v.barcode !== 'string' || !isValidGtin(v.barcode)
    || !optional(v.name, 180) || !optional(v.brand, 100) || !optional(v.size, 80)
    || (v.name === null && (v.brand !== null || v.size !== null))) throw Error('INVALID_INGREDIENT_QUERY');
  return { barcode: v.barcode, name: v.name as string | null, brand: v.brand as string | null, size: v.size as string | null };
}
type SourceResult = { status: IngredientSourceStatus; evidence?: PublishedIngredientEvidence };
type ProviderQuery = { barcode: string; name: string; brand: string | null; size: string | null };

/** Fixed providers in parallel; no profile, model, retry, persistence or canonical promotion. */
export async function lookupProductIngredients(query: ProductIngredientQuery, deps: {
  reserve: () => Promise<'reserved' | 'rate_limited'>;
  obf: (query: ProviderQuery) => Promise<SourceResult>;
  dailyMed: (query: ProviderQuery) => Promise<SourceResult>;
}): Promise<ProductIngredientLookup> {
  const parsed = parseProductIngredientQuery(query);
  const base = { query: parsed, rightsPolicy: 'private_evaluation_only' as const };
  if (await deps.reserve() === 'rate_limited') return { ...base, status: 'rate_limited', evidence: [], sources: [] };
  const providerQuery = { ...parsed, name: parsed.name ?? '' };
  const run = async (fn: () => Promise<SourceResult>): Promise<SourceResult> => {
    try { return await fn(); } catch { return { status: 'unavailable' }; }
  };
  // DailyMed uses drug-label names, not UPC-as-NDC. No name means no DailyMed lookup.
  const [obf, dailyMed] = await Promise.all([
    run(() => deps.obf(providerQuery)),
    parsed.name ? run(() => deps.dailyMed(providerQuery)) : Promise.resolve({ status: 'not_queried' as const }),
  ]);
  const sources = [{ source: 'open_beauty_facts' as const, status: obf.status },
    { source: 'dailymed' as const, status: dailyMed.status }];
  const evidence = [obf, dailyMed].flatMap(result => result.status === 'found' && result.evidence ? [result.evidence] : []);
  // Lists remain separate. Never silently merge different market/formula declarations.
  const status = evidence.length ? 'found' : sources.some(s => s.status === 'ambiguous') ? 'ambiguous'
    : sources.some(s => s.status === 'rate_limited') ? 'rate_limited'
    : sources.some(s => s.status === 'unavailable') ? 'unavailable' : 'not_found';
  return { ...base, status, evidence, sources };
}
