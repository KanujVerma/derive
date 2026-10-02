import type { ProductIngredientQuery } from '../../contracts/ProductIngredientLookup.ts';
import type { WebProductIngredientLookup, WebIngredientEvidence } from '../../contracts/WebProductIngredients.ts';
import { distinctiveNamedIngredientIdentity, researchableNamedIngredientIdentity } from '../../contracts/WebProductIngredients.ts';
import { validPrivateBarcode, type PrivateLookupClient } from './privateLookup.ts';

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && Boolean(value.trim())
  && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const label = (value: unknown, max: number): value is string => text(value, max) && !/[\r\n\t]/.test(value);
const optional = (value: unknown, max: number) => value === null || label(value, max);
const failureStatuses = new Set(['not_found', 'ambiguous', 'rate_limited', 'configuration_required', 'unavailable']);

export const webProductIngredientKey = (query: ProductIngredientQuery): string => JSON.stringify([query.barcode, query.name, query.brand, query.size]);

export function validWebIngredientQuery(value: unknown): value is ProductIngredientQuery & { name: string } {
  return record(value) && typeof value.barcode === 'string'
    && label(value.name, 180) && optional(value.brand, 100) && optional(value.size, 80)
    && (validPrivateBarcode(value.barcode) || (value.barcode === ''
      && researchableNamedIngredientIdentity(value.name, value.brand as string | null)));
}

/** A displayable citation cannot carry credentials, local addresses or secret query parameters. */
export function safeWebIngredientSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
      || !host.includes('.') || host.endsWith('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return false;
    for (const key of url.searchParams.keys()) {
      if (/(?:key|token|secret|password|passwd|credential|authorization|signature|session|jwt|auth|code)/i.test(key)) return false;
    }
    return true;
  } catch { return false; }
}

function timestamp(value: unknown): value is string {
  return label(value, 40) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}

/** Project only published evidence. Extra upstream properties never become a verdict or formula. */
export function parseWebProductIngredientLookup(value: unknown): WebProductIngredientLookup {
  if (!record(value)) throw Error('INVALID_WEB_INGREDIENT_RESPONSE');
  if (typeof value.status === 'string' && failureStatuses.has(value.status)) {
    if ('evidence' in value) throw Error('INVALID_WEB_INGREDIENT_RESPONSE');
    if (value.status === 'ambiguous' && 'candidates' in value) {
      if (!Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 5)
        throw Error('INVALID_WEB_INGREDIENT_RESPONSE');
      const candidates = value.candidates.map(candidate => {
        if (!record(candidate) || !label(candidate.name, 180) || !label(candidate.brand, 100)
          || !distinctiveNamedIngredientIdentity(candidate.name, candidate.brand)) throw Error('INVALID_WEB_INGREDIENT_RESPONSE');
        return { name: candidate.name, brand: candidate.brand };
      });
      return { status: 'ambiguous', candidates };
    }
    return { status: value.status } as WebProductIngredientLookup;
  }
  const item = value.evidence;
  if (value.status !== 'found' || !record(item) || !label(item.productName, 240) || !text(item.ingredientsText, 16000)
    || !safeWebIngredientSourceUrl(item.sourceUrl) || !label(item.sourceName, 180) || !timestamp(item.retrievedAt)
    || item.basis !== 'published_web' || item.formulaVerified !== false) throw Error('INVALID_WEB_INGREDIENT_RESPONSE');
  const evidence: WebIngredientEvidence = { productName: item.productName, ingredientsText: item.ingredientsText,
    sourceUrl: item.sourceUrl, sourceName: item.sourceName, retrievedAt: item.retrievedAt,
    basis: 'published_web', formulaVerified: false };
  return { status: 'found', evidence };
}

/** Only bounded product identity leaves this client. The caller fences session, owner and product. */
export async function requestWebProductIngredients(query: ProductIngredientQuery, ownerId: string,
  currentScope: () => string, client: PrivateLookupClient): Promise<WebProductIngredientLookup> {
  const scope = ownerId + ':' + webProductIngredientKey(query);
  if (!validWebIngredientQuery(query)) throw Error('INVALID_WEB_INGREDIENT_REQUEST');
  if (!ownerId || currentScope() !== scope) throw Error('WEB_INGREDIENT_SCOPE_CHANGED');
  const { data, error } = await client.functions.invoke('private-web-product-ingredients', {
    body: { barcode: query.barcode, name: query.name, brand: query.brand, size: query.size },
  });
  if (currentScope() !== scope) throw Error('WEB_INGREDIENT_SCOPE_CHANGED');
  let payload: unknown = data;
  if (error) {
    const context = record(error) && record(error.context) ? error.context : null;
    if (!payload && context && typeof context.clone === 'function') {
      try { payload = await (context.clone() as Response).json(); } catch { /* Reject unreadable bodies. */ }
    }
    if (currentScope() !== scope) throw Error('WEB_INGREDIENT_SCOPE_CHANGED');
    if (!(context?.status === 429 || context?.status === 503) || !record(payload)
      || (context.status === 429 ? payload.status !== 'rate_limited'
        : !['configuration_required', 'unavailable'].includes(String(payload.status)))) {
      throw Error(context?.status === 403 ? 'PRIVATE_TESTER_REQUIRED'
        : context?.status === 401 ? 'SIGN_IN_REQUIRED' : 'WEB_INGREDIENT_UNAVAILABLE');
    }
  }
  return parseWebProductIngredientLookup(payload);
}
