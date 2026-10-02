import type { PersonalContextSnapshot } from '../../contracts/PersonalContext.ts';
import type { ProductIngredientQuery } from '../../contracts/ProductIngredientLookup.ts';
import type { WebIngredientEvidence, IngredientProductCandidate } from '../../contracts/WebProductIngredients.ts';
import { namedIngredientBrand } from '../../contracts/WebProductIngredients.ts';
import { reactionIngredientFlags } from '../../domain/reactionIngredientFlags.ts';

export interface ReactionProduct { key: string; name: string; brand: string | null }
export interface ReactionIngredientRecord { product: ReactionProduct;
  status: 'loading' | 'found' | 'ambiguous' | 'not_found' | 'unavailable' | 'rate_limited';
  evidence?: WebIngredientEvidence; candidates?: IngredientProductCandidate[] }
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Names are lookup facts only. Symptoms, dates, notes and owner identifiers never enter a provider query. */
export function reactionProducts(context: PersonalContextSnapshot | null, query: ProductIngredientQuery, limit = 2): ReactionProduct[] {
  if (!context) return [];
  const superseded = new Set(context.experiences.map(e => e.supersedesRevisionId).filter(Boolean));
  const modern = context.experiences.filter(e => e.ownerId === context.ownerId && !superseded.has(e.id)
    && e.data.kind === 'reacted' && e.data.reference.kind === 'manual').slice(0, 100)
    .flatMap(e => e.data.reference.kind === 'manual' ? [{ name: e.data.reference.name, brand: e.data.reference.brand ?? null }] : []);
  const legacy = context.legacy.experiences.slice(0, 100).flatMap(e => {
    const name = typeof e.productName === 'string' ? e.productName : e.product_name;
    return e.kind === 'reacted' && typeof name === 'string'
      ? [{ name, brand: typeof e.brand === 'string' ? e.brand : null }] : [];
  });
  const seen = new Set<string>();
  const products = [...modern, ...legacy].flatMap(p => {
    const name = p.name.trim(), key = normalize(name);
    if (!key || name.length > 180 || /[\x00-\x1f\x7f]/.test(name) || seen.has(key)) return [];
    seen.add(key);
    return [{ key, name, brand: p.brand?.trim() || namedIngredientBrand(name) }];
  });
  const brand = normalize(query.brand ?? '');
  return products.sort((a, b) => Number(Boolean(brand && normalize(b.name).startsWith(brand + ' ')))
    - Number(Boolean(brand && normalize(a.name).startsWith(brand + ' ')))).slice(0, Math.max(0, Math.min(limit, 20)));
}

/** Only small, explicit aliases. Fragrance is an undisclosed mixture, not identical fragrance chemistry. */
export function ingredientEntries(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of text.slice(0, 24000).split(/[,;\n]/).slice(0, 160)) {
    const label = entry.trim(); if (!label || label.length > 180 || /[<>]/.test(label)) continue;
    const key = normalize(label);
    const alias = ['water', 'aqua', 'water aqua', 'aqua water'].includes(key) ? 'water'
      : ['fragrance', 'parfum', 'fragrance parfum', 'parfum fragrance', 'perfume'].includes(key) ? 'fragrance'
        : ['glycerin', 'glycerol'].includes(key) ? 'glycerin' : key;
    if (alias) result.set(alias, label);
  }
  return result;
}
export function compareReactionIngredients(current: string, previous: string) {
  const currentEntries = ingredientEntries(current), previousEntries = ingredientEntries(previous);
  const shared = [...currentEntries].filter(([key]) => previousEntries.has(key)).map(([, label]) => label);
  const previousFlags = new Set(reactionIngredientFlags(previous).map(flag => flag.id));
  const flags = reactionIngredientFlags(current).filter(flag => previousFlags.has(flag.id));
  return { shared, flagged: flags.map(flag => flag.matchedLabel), flags };
}
