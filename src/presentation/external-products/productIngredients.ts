import type { ProductIngredientQuery, ProductIngredientLookup, PublishedIngredientEvidence } from '../../contracts/ProductIngredientLookup.ts';
import { validPrivateBarcode, type PrivateLookupClient } from './privateLookup.ts';

const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown, n: number): v is string => typeof v === 'string' && Boolean(v.trim()) && v.length <= n && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const optional = (v: unknown, n: number) => v === null || text(v, n);
const timestamp = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v));
export const productIngredientKey = (q: ProductIngredientQuery): string => JSON.stringify([q.barcode, q.name, q.brand, q.size]);
function validQuery(q: unknown): q is ProductIngredientQuery {
  return record(q) && typeof q.barcode === 'string' && validPrivateBarcode(q.barcode)
    && optional(q.name, 180) && optional(q.brand, 100) && optional(q.size, 80)
    && (q.name !== null || (q.brand === null && q.size === null));
}
export function publishedIngredientUrl(source: PublishedIngredientEvidence['source'], value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024 || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return source === 'open_beauty_facts' ? url.hostname === 'world.openbeautyfacts.org' && /^\/product\/\d{8,14}(?:\/[^?#]*)?$/.test(url.pathname)
      : source === 'dailymed' && url.hostname === 'dailymed.nlm.nih.gov' && url.pathname === '/dailymed/drugInfo.cfm'
        && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(url.searchParams.get('setid') ?? '');
  } catch { return false; }
}
const sameBarcode = (a: string, b: string) => a === b || (a.length === 12 && b === '0' + a) || (a.length === 13 && a.startsWith('0') && a.slice(1) === b);
const sourceStatuses = new Set(['found', 'not_found', 'incomplete', 'unavailable', 'rate_limited', 'ambiguous', 'not_queried']);
export function parseProductIngredientLookup(value: unknown, query: ProductIngredientQuery): ProductIngredientLookup {
  if (!validQuery(query) || !record(value) || !validQuery(value.query)
    || productIngredientKey(query) !== productIngredientKey(value.query) || value.rightsPolicy !== 'private_evaluation_only'
    || !['found', 'not_found', 'unavailable', 'rate_limited', 'ambiguous'].includes(String(value.status))
    || !Array.isArray(value.evidence) || value.evidence.length > 2 || !Array.isArray(value.sources) || value.sources.length > 2) throw Error('INVALID_INGREDIENT_RESPONSE');
  const evidence: PublishedIngredientEvidence[] = [];
  for (const item of value.evidence) {
    if (!record(item) || !['open_beauty_facts', 'dailymed'].includes(String(item.source))) throw Error('INVALID_INGREDIENT_RESPONSE');
    const source = item.source as PublishedIngredientEvidence['source'];
    if (!publishedIngredientUrl(source, item.sourceUrl) || !timestamp(item.retrievedAt)
      || !(item.sourceModifiedAt === null || timestamp(item.sourceModifiedAt)) || !text(item.productName, 500)
      || !optional(item.brand, 180) || !optional(item.quantity, 180) || !text(item.ingredientsText, 24000)
      || item.formulaVerified !== false || item.canonicalProductId !== null
      || (source === 'open_beauty_facts' ? item.sourceLicense !== 'ODbL-1.0' || item.matchBasis !== 'barcode'
        || typeof item.barcode !== 'string' || !validPrivateBarcode(item.barcode) || !sameBarcode(query.barcode, item.barcode)
        : item.sourceLicense !== 'DailyMed-public-label' || item.matchBasis !== 'name_variant' || item.barcode !== null)
      || evidence.some(v => v.source === source)) throw Error('INVALID_INGREDIENT_RESPONSE');
    evidence.push({ source, sourceUrl: item.sourceUrl, sourceLicense: item.sourceLicense as PublishedIngredientEvidence['sourceLicense'],
      retrievedAt: item.retrievedAt, sourceModifiedAt: item.sourceModifiedAt as string | null, barcode: item.barcode as string | null,
      productName: item.productName, brand: item.brand as string | null, quantity: item.quantity as string | null,
      ingredientsText: item.ingredientsText, matchBasis: item.matchBasis as PublishedIngredientEvidence['matchBasis'],
      formulaVerified: false, canonicalProductId: null });
  }
  if ((value.status === 'found') !== (evidence.length > 0)) throw Error('INVALID_INGREDIENT_RESPONSE');
  const sources: ProductIngredientLookup['sources'] = [];
  for (const item of value.sources) {
    if (!record(item) || !['open_beauty_facts', 'dailymed'].includes(String(item.source))
      || !sourceStatuses.has(String(item.status)) || sources.some(s => s.source === item.source)) throw Error('INVALID_INGREDIENT_RESPONSE');
    sources.push({ source: item.source as PublishedIngredientEvidence['source'], status: item.status as ProductIngredientLookup['sources'][number]['status'] });
  }
  if (evidence.some(e => !sources.some(s => s.source === e.source && s.status === 'found'))
    || sources.some(s => s.status === 'found' && !evidence.some(e => e.source === s.source))) throw Error('INVALID_INGREDIENT_RESPONSE');
  return { status: value.status as ProductIngredientLookup['status'], query: { ...query }, evidence, sources, rightsPolicy: 'private_evaluation_only' };
}

/** Only product identity leaves the phone; saved profile/history never enter these APIs. */
export async function requestProductIngredients(query: ProductIngredientQuery, ownerId: string,
  current: () => string, client: PrivateLookupClient): Promise<ProductIngredientLookup> {
  const scope = ownerId + ':' + productIngredientKey(query);
  if (!ownerId || !validQuery(query) || current() !== scope) throw Error('INGREDIENT_SCOPE_CHANGED');
  const { data, error } = await client.functions.invoke('private-product-ingredients', { body: { ...query } });
  if (current() !== scope) throw Error('INGREDIENT_SCOPE_CHANGED');
  let payload: unknown = data;
  if (error) {
    const context = record(error) && record(error.context) ? error.context : null;
    if (!payload && context && typeof context.clone === 'function') {
      try { payload = await (context.clone() as Response).json(); } catch { /* fail closed */ }
    }
    if (current() !== scope) throw Error('INGREDIENT_SCOPE_CHANGED');
    if (!(context?.status === 429 || context?.status === 503) || !record(payload) || !('status' in payload)) {
      throw Error(context?.status === 403 ? 'PRIVATE_TESTER_REQUIRED' : context?.status === 401 ? 'SIGN_IN_REQUIRED' : 'INGREDIENT_UNAVAILABLE');
    }
  }
  return parseProductIngredientLookup(payload, query);
}
