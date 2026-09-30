import type { PrivateGroundedAnswer, PrivateIngredientQuery, PrivateIngredientSearch } from '../../contracts/PrivateIngredientSearch.ts';
import { validPrivateBarcode, type PrivateLookupClient } from './privateLookup.ts';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const label = (value: unknown, limit: number): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
const optionalLabel = (value: unknown, limit: number) => value === null || label(value, limit);
const emptyStatuses = new Set(['configuration_required', 'rate_limited', 'unavailable', 'no_grounded_answer',
  'personalization_disabled', 'profile_missing', 'context_unavailable', 'context_changed']);

export function validIngredientQuery(value: unknown): value is PrivateIngredientQuery {
  return object(value) && typeof value.barcode === 'string' && validPrivateBarcode(value.barcode)
    && label(value.name, 180) && optionalLabel(value.brand, 100) && optionalLabel(value.size, 80);
}

export function ingredientQueryKey(query: PrivateIngredientQuery): string {
  return JSON.stringify([query.barcode, query.name, query.brand, query.size]);
}

/** Links are opened outside the embedded answer; private/local origins are never navigable. */
export function safeIngredientSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
      && host.includes('.') && !host.includes(':') && !/^\d+(?:\.\d+){3}$/.test(host)
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid|example|lan|home|corp|onion)$/.test(host) && !host.endsWith('.');
  } catch { return false; }
}

/** Do not rewrite Google's supplied markup. Reject active/remote-resource markup as a whole. */
export function safeIngredientSuggestionsHtml(html: unknown): html is string {
  if (typeof html !== 'string' || !html.trim() || html.length > 65536 || /\x00/.test(html)) return false;
  if (/<\s*\/?\s*(?:script|iframe|object|embed|form|meta|base|link|frame|frameset|input|button|textarea|select|foreignObject|animate|set)\b/i.test(html)
    || /\bon[a-z]+\s*=/i.test(html) || /\bsrcset\s*=/i.test(html)
    || /@import\b|expression\s*\(/i.test(html)) return false;
  const cssUrls = [...html.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
  if (cssUrls.length !== [...html.matchAll(/url\s*\(/gi)].length
    || cssUrls.some(match => !/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test((match[1] ?? match[2] ?? match[3]).trim()))) return false;
  // HTTPS href is a navigable link only on <a>. SVG resource references must stay document-local.
  for (const tag of html.matchAll(/<\s*([a-z][\w:-]*)\b([^>]*)>/gi)) {
    if (tag[1].toLowerCase() === 'a') continue;
    for (const reference of tag[2].matchAll(/\b(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const href = reference[1] ?? reference[2] ?? reference[3];
      if (!/^#[a-z0-9_.:-]+$/i.test(href)) return false;
    }
  }
  let publicLinks = 0;
  for (const match of html.matchAll(/\b(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const href = match[1] ?? match[2] ?? match[3];
    if (!href.startsWith('#') && !safeIngredientSourceUrl(href)) return false;
    if (!href.startsWith('#')) publicLinks++;
  }
  for (const match of html.matchAll(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const src = match[1] ?? match[2] ?? match[3];
    if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return false;
  }
  return publicLinks > 0;
}

export function parsePrivateIngredientSearch(value: unknown, query: PrivateIngredientQuery): PrivateIngredientSearch {
  if (!validIngredientQuery(query) || !object(value)) throw new Error('INVALID_INGREDIENT_RESPONSE');
  if (typeof value.status === 'string' && emptyStatuses.has(value.status)) {
    return { status: value.status } as PrivateIngredientSearch;
  }
  if (value.status !== 'grounded_answer' || !validIngredientQuery(value.query)
    || ingredientQueryKey(value.query) !== ingredientQueryKey(query)
    || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 20000 || /\x00/.test(value.text)
    || !safeIngredientSuggestionsHtml(value.searchSuggestionsHtml)
    || !Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 32
    || !value.sources.every(source => object(source) && label(source.title, 500) && safeIngredientSourceUrl(source.url))
    || typeof value.retrievedAt !== 'string' || value.retrievedAt.length > 40 || !Number.isFinite(Date.parse(value.retrievedAt))
    || value.formulaVerified !== false || value.canonicalProductId !== null
    || (value.answerKind !== undefined && !['published_ingredients', 'contextual_web_guidance'].includes(String(value.answerKind)))
    || (value.answerKind === 'contextual_web_guidance' && (typeof value.contextVersion !== 'string' || !/^[a-f\d]{64}$/.test(value.contextVersion)))
    || (value.answerKind !== 'contextual_web_guidance' && value.contextVersion !== undefined)) throw new Error('INVALID_INGREDIENT_RESPONSE');
  return { status: 'grounded_answer', query: { barcode: query.barcode, name: query.name, brand: query.brand, size: query.size },
    text: value.text, searchSuggestionsHtml: value.searchSuggestionsHtml,
    sources: value.sources.map(source => ({ title: source.title as string, url: source.url as string })),
    retrievedAt: value.retrievedAt, formulaVerified: false, canonicalProductId: null,
    ...(value.answerKind === undefined ? {} : { answerKind: value.answerKind as PrivateGroundedAnswer['answerKind'] }),
    ...(value.answerKind === 'contextual_web_guidance' ? { contextVersion: value.contextVersion as string } : {}) };
}

export async function requestPrivateIngredientSearch(query: PrivateIngredientQuery, ownerId: string,
  getOwner: () => string | null, getQueryKey: () => string, client: PrivateLookupClient,
  personalized = false): Promise<PrivateIngredientSearch> {
  if (!validIngredientQuery(query)) throw new Error('INVALID_INGREDIENT_QUERY');
  const key = ingredientQueryKey(query);
  const current = () => Boolean(ownerId) && getOwner() === ownerId && getQueryKey() === key;
  if (!current()) throw new Error('INGREDIENT_SCOPE_CHANGED');
  const body = { barcode: query.barcode, name: query.name, brand: query.brand, size: query.size,
    ...(personalized ? { personalization: 'basic_skin_context' as const, contextSharingConsent: true as const } : {}) };
  const { data, error } = await client.functions.invoke('private-ingredient-search', { body });
  if (!current()) throw new Error('INGREDIENT_SCOPE_CHANGED');
  if (error) {
    const context = object(error) && object(error.context) ? error.context : null;
    const status = context?.status;
    if (status === 429) return { status: 'rate_limited' };
    if (status === 503) {
      let details: unknown = data;
      if (!details && context && typeof context.clone === 'function') {
        try { details = await (context.clone() as Response).json(); } catch { /* No unsafe fallback from unreadable errors. */ }
      }
      if (!current()) throw new Error('INGREDIENT_SCOPE_CHANGED');
      if (object(details) && ['configuration_required', 'personalization_disabled', 'context_unavailable'].includes(String(details.status))) {
        return { status: details.status } as PrivateIngredientSearch;
      }
      return { status: 'unavailable' };
    }
    throw new Error(status === 403 ? 'PRIVATE_TESTER_REQUIRED' : status === 401 ? 'SIGN_IN_REQUIRED' : 'INGREDIENT_UNAVAILABLE');
  }
  const result = parsePrivateIngredientSearch(data, query);
  if (result.status === 'grounded_answer'
    && (personalized ? result.answerKind !== 'contextual_web_guidance' : result.answerKind === 'contextual_web_guidance')) {
    throw new Error('INVALID_INGREDIENT_RESPONSE');
  }
  return result;
}

export type PrivateIngredientState = { ownerId: string; queryKey: string } & (
  { kind: 'loading' } | { kind: 'result'; result: PrivateIngredientSearch } | { kind: 'error'; code: string });

/** Manual action only. Disposing a view invalidates publication but never retries the provider. */
export function createPrivateIngredientController(input: {
  ownerId: string; queryKey: string; currentScope: () => string;
  request: () => Promise<PrivateIngredientSearch>; publish: (state: PrivateIngredientState) => void;
}) {
  let pending = false, disposed = false;
  const scope = input.ownerId + ':' + input.queryKey;
  return {
    run: async () => {
      if (pending || disposed || !input.ownerId || input.currentScope() !== scope) return;
      pending = true;
      const identity = { ownerId: input.ownerId, queryKey: input.queryKey };
      input.publish({ kind: 'loading', ...identity });
      try {
        const result = await input.request();
        if (!disposed && input.currentScope() === scope) input.publish({ kind: 'result', result, ...identity });
      } catch (error) {
        if (!disposed && input.currentScope() === scope) input.publish({ kind: 'error',
          code: error instanceof Error ? error.message : 'INGREDIENT_UNAVAILABLE', ...identity });
      } finally { pending = false; }
    },
    dispose: () => { disposed = true; },
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** Whole original answer + links + unmodified Google suggestions, isolated from app execution. */
export function privateIngredientAnswerDocument(answer: PrivateGroundedAnswer): string {
  const checked = parsePrivateIngredientSearch(answer, answer.query);
  if (checked.status !== 'grounded_answer') throw new Error('INVALID_INGREDIENT_RESPONSE');
  const sources = checked.sources.map(source => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></li>`).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; connect-src \'none\'; img-src data:; style-src \'unsafe-inline\'; font-src \'none\'; media-src \'none\'; frame-src \'none\'; base-uri \'none\'; form-action \'none\'">'
    + '<style>body{margin:20px;background:#fffefb;color:#171a18;font:16px -apple-system,system-ui,sans-serif}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.5}a{color:#345447}li{margin:12px 0}</style></head><body>'
    + '<h1>Published ingredient search</h1><pre>' + escapeHtml(checked.text) + '</pre><h2>Sources</h2><ul>' + sources
    + '</ul>' + checked.searchSuggestionsHtml + '</body></html>';
}
