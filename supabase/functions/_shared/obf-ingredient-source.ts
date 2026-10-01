import { isValidGtin } from './product-identity.ts';

const ORIGIN = 'https://world.openbeautyfacts.org';
const MAX_RESPONSE_BYTES = 65_536;
const TIMEOUT_MS = 3_000;
const USER_AGENT = 'Derive/0.1 (https://github.com/KanujVerma/derive)';

export interface ObfIngredientEvidence {
  source: 'open_beauty_facts';
  sourceUrl: string;
  sourceLicense: 'ODbL-1.0';
  retrievedAt: string;
  sourceModifiedAt: string | null;
  barcode: string | null;
  productName: string;
  brand: string | null;
  quantity: string | null;
  ingredientsText: string;
  matchBasis: 'barcode';
  formulaVerified: false;
  canonicalProductId: null;
}

export type ObfIngredientLookup =
  | { status: 'found'; evidence: ObfIngredientEvidence }
  | { status: 'not_found' | 'incomplete' | 'unavailable' | 'rate_limited'; evidence?: never };

function equivalent(observed: string, returned: unknown): returned is string {
  return typeof returned === 'string' && isValidGtin(returned)
    && (observed === returned
      || (observed.length === 12 && returned === `0${observed}`)
      || (observed.length === 13 && observed.startsWith('0') && returned === observed.slice(1)));
}

function label(value: unknown, maxLength = 300): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null;
  const result = value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return result || null;
}

/** Preserve source ingredient spelling/order; do not synthesize a parsed formula. */
function ingredientText(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 24_000
    || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return null;
  return value;
}

function modifiedAt(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 4_102_444_800
    ? new Date(value * 1_000).toISOString() : null;
}

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function compatibleBrand(expected: string, returned: string | null): boolean {
  if (!returned) return false;
  const wanted = normalized(expected);
  if (!wanted) return false;
  return returned.split(/[,;|]/).some((part) => {
    const actual = normalized(part);
    return actual === wanted || actual.replace(/ /g, '') === wanted.replace(/ /g, '');
  });
}

const TITLE_STOP_WORDS = new Set(['the', 'for', 'and', 'with', 'of', 'a', 'an', 'in', 'to', 'oz', 'ounce', 'ounces',
  'fl', 'fluid', 'ml', 'g', 'gram', 'grams', 'pack', 'count', 'ct', 'size', 'skin', 'skincare', 'care', 'men', 'women']);
const PRODUCT_FORMS = new Set(['cream', 'lotion', 'cleanser', 'serum', 'sunscreen', 'deodorant', 'antiperspirant',
  'shampoo', 'conditioner', 'soap', 'gel', 'balm', 'ointment', 'toner']);

function compatibleName(expected: string, actual: string, brand: string | null): boolean {
  // A shared barcode cannot override an explicit conflicting SPF/strength.
  const spf = (name: string) => /\bspf\s*[-:]?\s*(\d+)\b/i.exec(name)?.[1];
  if (spf(expected) && spf(expected) !== spf(actual)) return false;
  const strength = (name: string) => [...name.matchAll(/\b(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
  const expectedStrengths = strength(expected);
  const actualStrengths = strength(actual);
  if (expectedStrengths.some(n => !actualStrengths.includes(n))) return false;
  const brandTokens = new Set(normalized(brand ?? '').split(' '));
  const meaningful = (name: string) => [...new Set(normalized(name).split(' ').filter((token) => token
    && !/^\d+$/.test(token) && !TITLE_STOP_WORDS.has(token) && !brandTokens.has(token)))];
  const wanted = meaningful(expected);
  const received = new Set(meaningful(actual));
  if (!wanted.length) return false;
  // Product-form contradictions are not rescued by a shared brand or adjective.
  if (wanted.some((token) => PRODUCT_FORMS.has(token) && !received.has(token))) return false;
  const overlap = wanted.filter((token) => received.has(token)).length;
  return overlap >= Math.min(2, wanted.length) && overlap >= Math.ceil(wanted.length / 2);
}

/** Bounded rejection/eligibility guard, not an ingredient-quality or medical classifier. */
function beautyRecord(product: Record<string, unknown>, name: string): 'beauty' | 'non_beauty' | 'unknown' {
  const productType = normalized(typeof product.product_type === 'string' ? product.product_type : '');
  if (['food', 'petfood', 'pet food', 'product', 'other'].includes(productType)) return 'non_beauty';
  const tags = Array.isArray(product.categories_tags)
    ? product.categories_tags.filter((tag): tag is string => typeof tag === 'string' && tag.length <= 180).slice(0, 40).join(' ')
    : '';
  const categories = typeof product.categories === 'string' ? product.categories.slice(0, 2_000) : '';
  const categoryText = normalized(`${categories} ${tags}`);
  const title = normalized(name);
  const descriptor = `${categoryText} ${title}`;
  // Ingredient/flavour words alone do not make a tea-tree cleanser or coffee
  // body scrub a food record. Use declared categories or clear food forms.
  if (/\b(food|foods|beverage|beverages|soda|sodas|drink|drinks|cereal|cereals|snack|snacks|juice|juices|pet food)\b/.test(categoryText)
    || /\b(soda|sodas|energy drink|prebiotic drink|sparkling water|breakfast cereal|protein bar)\b/.test(title)) {
    return 'non_beauty';
  }
  if (['beauty', 'beauty product', 'cosmetic', 'cosmetics'].includes(productType)
    || /\b(cosmetic|cosmetics|skincare|skin care|body care|personal care|cream|creams|lotion|lotions|moisturizer|moisturizers|moisturiser|moisturisers|cleanser|cleansers|serum|serums|sunscreen|sunscreens|sun protection|deodorant|deodorants|antiperspirant|antiperspirants|shampoo|shampoos|conditioner|conditioners|soap|soaps|shower gel|shower gels|balm|balms|ointment|ointments|toner|toners|acne treatment|acne treatments)\b/.test(descriptor)) {
    return 'beauty';
  }
  return 'unknown';
}

async function readJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

/**
 * Private, allowlisted evaluation only. ODbL evidence stays separate from canonical
 * products, with attribution; this helper has no persistence or formula approval.
 * Official API: https://support.openfoodfacts.org/help/en-gb/11-open-beauty-facts/101
 */
export async function lookupObfIngredients(
  query: { barcode: string; name: string; brand: string | null; size: string | null },
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<ObfIngredientLookup> {
  if (!isValidGtin(query.barcode) || typeof query.name !== 'string' || query.name.length > 300
    || (query.brand !== null && (typeof query.brand !== 'string' || query.brand.length > 300))
    || (query.size !== null && (typeof query.size !== 'string' || query.size.length > 100))) {
    throw new Error('INVALID_QUERY');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = async (): Promise<ObfIngredientLookup> => {
    const fields = 'code,product_name,product_name_en,brands,quantity,lang,product_type,categories,categories_tags,ingredients_text,ingredients_text_en,last_modified_t';
    const response = await (options.fetch ?? fetch)(`${ORIGIN}/api/v2/product/${query.barcode}.json?fields=${fields}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      redirect: 'error', signal: controller.signal,
    });
    if (response.status === 404) return { status: 'not_found' };
    if (response.status === 429) return { status: 'rate_limited' };
    if (!response.ok) return { status: 'unavailable' };
    const payload = await readJson(response);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 'unavailable' };
    const body = payload as Record<string, unknown>;
    if (body.status === 0) return { status: 'not_found' };
    if (body.status !== 1 || !body.product || typeof body.product !== 'object' || Array.isArray(body.product)) {
      return { status: 'unavailable' };
    }
    const product = body.product as Record<string, unknown>;
    if (!equivalent(query.barcode, body.code) || !equivalent(query.barcode, product.code)) return { status: 'unavailable' };
    const name = label(product.product_name_en) ?? label(product.product_name);
    // Prefer explicitly English text. Generic text remains valid source evidence,
    // not translated English and not a guaranteed current U.S. package formula.
    const ingredients = ingredientText(product.ingredients_text_en) ?? ingredientText(product.ingredients_text);
    if (!name || !ingredients) return { status: 'incomplete' };
    const category = beautyRecord(product, name);
    if (category === 'non_beauty') return { status: 'incomplete' };
    const brand = label(product.brands, 180);
    if (query.brand?.trim() && !compatibleBrand(query.brand, brand)) return { status: 'incomplete' };
    if (query.name.trim() && !compatibleName(query.name, name, query.brand)) return { status: 'incomplete' };
    if (!query.name.trim() && category !== 'beauty') return { status: 'incomplete' };
    return { status: 'found', evidence: {
      source: 'open_beauty_facts', sourceUrl: `${ORIGIN}/product/${product.code}`, sourceLicense: 'ODbL-1.0',
      retrievedAt: (options.now ?? (() => new Date()))().toISOString(), sourceModifiedAt: modifiedAt(product.last_modified_t),
      barcode: product.code, productName: name, brand, quantity: label(product.quantity, 180),
      ingredientsText: ingredients, matchBasis: 'barcode', formulaVerified: false, canonicalProductId: null,
    } };
  };
  try {
    return await Promise.race([
      work(),
      new Promise<ObfIngredientLookup>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve({ status: 'unavailable' }); }, TIMEOUT_MS);
      }),
    ]);
  } catch { return { status: 'unavailable' }; }
  finally { if (timer) clearTimeout(timer); }
}
