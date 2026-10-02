import { z } from 'zod';
import { LookupReplySchema, PartOneIdSchema, VariantSchema } from '../../../src/contracts/PartOne.ts';
import type { LookupReply, SourceObservation, SourcePolicy, Variant } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { policyAllows } from '../../../src/domain/part-one/evidence.ts';

export const PROVIDER_ADAPTER_VERSION = 'part-one-fixture-1';
export const ProviderLookupRequestSchema = z.strictObject({ canonicalCode: z.string(), originalCode: z.string(), symbology: z.string().nullable(), nativeCode: z.string(), requestedMarket: z.string().nullable(), categoryHint: z.string().nullable(), requestedFields: z.array(z.enum(['identity', 'ingredients'])), jobId: PartOneIdSchema, stageId: PartOneIdSchema, deadlineAt: z.iso.datetime(), reservationId: PartOneIdSchema });
export type ProviderLookupRequest = z.infer<typeof ProviderLookupRequestSchema>;
export type BoundedProviderFixture = { status: number; contentType: string; body: string; retryAfter: string | null; providerRequestId: string | null; elapsedMs: number; decompressedBytes: number };
const emptyVariant = (): Variant => ({ brand: null, line: null, form: null, scent: null, shade: null, spf: null, strength: null, size: null, unit: null, packCount: null, packagingLevel: null });
const optionalString = z.string().nullable().optional();
const openProductSchema = z.object({ code: z.string(), product_name: optionalString, brands: optionalString, ingredients_text: optionalString, countries_tags: z.array(z.string()).optional(), last_modified_t: z.number().int().nonnegative().optional(), variant: VariantSchema.optional() });
const openEnvelopeSchema = z.object({ status: z.union([z.literal(0), z.literal(1)]), product: openProductSchema.optional() });
const upcEnvelopeSchema = z.object({ code: z.literal('OK'), items: z.array(z.object({ ean: z.string().optional(), upc: z.string().optional(), title: z.string(), brand: optionalString, variant: VariantSchema.optional() })).max(20) });
/** Frozen responses only: no network path, credentials, user profile or uploaded assets. */
export function evaluateProviderFixture(provider: 'open_facts' | 'upcitemdb', requestInput: ProviderLookupRequest, policy: SourcePolicy, fixture: BoundedProviderFixture, input: { now: string; observationId: string; contentHash: string; sourceUrl: string | null }): LookupReply {
  const request = ProviderLookupRequestSchema.parse(requestInput);
  const reply = (status: LookupReply['status'], observations: SourceObservation[] = [], retryAfter: string | null = null, calls = 1): LookupReply => LookupReplySchema.parse({ status, provider, adapterVersion: PROVIDER_ADAPTER_VERSION, policyVersion: policy.version, providerRequestId: calls ? fixture.providerRequestId : null, observations, retryAfter, reservationId: calls ? request.reservationId : null, elapsedMs: calls ? fixture.elapsedMs : 0, usage: { calls, costMinor: 0 } });
  const original = normalizeBarcode({ raw: request.originalCode, symbology: request.symbology, namespace: 'gtin', retailerId: null });
  const native = normalizeBarcode({ raw: request.nativeCode, symbology: request.nativeCode.length === 8 ? request.symbology : null, namespace: 'gtin', retailerId: null });
  if (!original.supported || !native.supported || original.canonicalCode !== request.canonicalCode || native.canonicalCode !== request.canonicalCode) return reply('unsupported', [], null, 0);
  if (policy.provider !== provider || !policyAllows(policy, 'lookup', input.now) || !policyAllows(policy, 'process', input.now) || !policyAllows(policy, 'retain', input.now)) return reply('disallowed_by_source_policy', [], null, 0);
  if (!policy.retainedFields.includes('identity') || request.requestedFields.includes('ingredients') && !policy.retainedFields.includes('ingredients')) return reply('disallowed_by_source_policy', [], null, 0);
  if (Date.parse(request.deadlineAt) <= Date.parse(input.now)) return reply('unavailable', [], null, 0);
  if (fixture.status === 429) return reply('rate_limited', [], parseRetryAfter(fixture.retryAfter, input.now));
  if (fixture.status === 401 || fixture.status === 403 && /json/i.test(fixture.contentType)) return reply('configuration_required');
  if (fixture.status >= 500 || fixture.status === 408 || fixture.status === 0) return reply('unavailable');
  if (fixture.status !== 200 || !/^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(fixture.contentType) || new TextEncoder().encode(fixture.body).byteLength > 262144 || fixture.decompressedBytes > 262144 || fixture.decompressedBytes < new TextEncoder().encode(fixture.body).byteLength) return reply('malformed_response');
  let body: unknown;
  try { body = JSON.parse(fixture.body); } catch { return reply('malformed_response'); }
  const parsed = provider === 'open_facts' ? openEnvelopeSchema.safeParse(body) : upcEnvelopeSchema.safeParse(body);
  if (!parsed.success) return reply('malformed_response');
  const records: Array<{ code: string; name: string | null; variant: Variant; ingredients: string | null; markets: string[]; updatedAt: string | null }> = [];
  if (provider === 'open_facts') {
    const envelope = openEnvelopeSchema.parse(body);
    if (envelope.status === 0) return envelope.product ? reply('malformed_response') : reply('not_found');
    if (!envelope.product) return reply('malformed_response');
    const p = envelope.product;
    records.push({ code: p.code, name: p.product_name ?? null, variant: p.variant ?? { ...emptyVariant(), brand: p.brands ?? null }, ingredients: request.requestedFields.includes('ingredients') ? p.ingredients_text ?? null : null, markets: p.countries_tags ?? [], updatedAt: p.last_modified_t === undefined ? null : new Date(p.last_modified_t * 1000).toISOString() });
  } else {
    const envelope = upcEnvelopeSchema.parse(body);
    if (!envelope.items.length) return reply('not_found');
    for (const p of envelope.items) { if (!p.ean && !p.upc) return reply('malformed_response'); records.push({ code: p.ean ?? p.upc!, name: p.title, variant: p.variant ?? { ...emptyVariant(), brand: p.brand ?? null }, ingredients: null, markets: [], updatedAt: null }); }
  }
  // Normalize every returned code before comparing; the requested barcode is not source proof.
  const observations: SourceObservation[] = records.map((record, i) => {
    const normalized = normalizeBarcode({ raw: record.code, symbology: record.code.length === 8 ? 'ean8' : null, namespace: 'gtin', retailerId: null });
    return { observationId: records.length === 1 ? input.observationId : derivedId(input.observationId, i), provider, providerRequestId: fixture.providerRequestId, providerResponseId: null, comparison: !normalized.supported ? 'unknown' : normalized.canonicalCode === request.canonicalCode ? 'exact' : 'contradiction', fetchedAt: input.now, sourceUpdatedAt: record.updatedAt, adapterVersion: PROVIDER_ADAPTER_VERSION, parserVersion: 'raw-preserved-1', policyVersion: policy.version, contentHash: input.contentHash, variant: record.variant, sourceMarkets: record.markets, sourceUrl: input.sourceUrl, policyId: policy.policyId, status: 'active', dependencyIds: [], payload: { nativeCode: record.code, canonicalCode: normalized.canonicalCode, name: record.name, rawIngredients: record.ingredients } };
  });
  return reply(observations.length > 1 ? 'ambiguous' : 'found', observations);
}
function derivedId(id: string, index: number): string { return id.slice(0, -4) + index.toString(16).padStart(4, '0'); }
export function parseRetryAfter(raw: string | null, now: string): string | null {
  if (raw === null) return null;
  if (/^\d+$/.test(raw)) { const ms = Number(raw) * 1000; return Number.isSafeInteger(ms) && ms <= 365 * 86400000 ? new Date(Date.parse(now) + ms).toISOString() : null; }
  const parsed = Date.parse(raw); return Number.isFinite(parsed) && parsed >= Date.parse(now) ? new Date(parsed).toISOString() : null;
}
export function negativeCacheExpiry(reply: LookupReply, now: string): string | null {
  return reply.status === 'not_found' ? new Date(Date.parse(now) + 6 * 3600000).toISOString() : null;
}
/** Caller must resolve DNS and call this for EACH redirect before dispatch. Missing DNS fails. */
export function isPermittedProviderDestination(raw: string, allowedHosts: readonly string[], resolvedAddresses: readonly string[], redirectCount = 0): boolean {
  if (redirectCount < 0 || redirectCount > 3 || !resolvedAddresses.length) return false;
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && !url.hash && allowedHosts.includes(url.hostname.toLowerCase()) && resolvedAddresses.every(isPublicAddress); } catch { return false; }
}
function isPublicAddress(raw: string): boolean {
  if (raw.includes(':')) {
    // Permit global unicast only; exclude mapped IPv4, local, link-local and reserved IPv6.
    if (!/^[0-9a-f:]+$/i.test(raw) || !/^[23][0-9a-f]{3}:/i.test(raw) || /^2001:(?:db8|0|10|20):/i.test(raw)) return false;
    const halves = raw.split('::');
    if (halves.length > 2) return false;
    const groups = raw.split(':').filter(Boolean);
    return groups.every(g => g.length <= 4) && (halves.length === 2 ? groups.length < 8 : groups.length === 8);
  }
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return false;
  const [a, b, c, d] = raw.split('.').map(Number);
  if ([a, b, c, d].some(n => n > 255) || a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113) return false;
  return true;
}

/** URL construction only. Reviewed origin configuration, DNS/redirect guards and grants
 * remain prerequisites to a future dispatcher; these builders never issue a request. */
export function buildOpenFactsLookupUrl(requestInput: ProviderLookupRequest, reviewedOrigin: string): string {
  const request = ProviderLookupRequestSchema.parse(requestInput);
  const origin = new URL(reviewedOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('invalid_provider_origin');
  const normalized = normalizeBarcode({ raw: request.originalCode, symbology: request.symbology, namespace: 'gtin', retailerId: null });
  const native = normalizeBarcode({ raw: request.nativeCode, symbology: request.nativeCode.length === 8 ? request.symbology : null, namespace: 'gtin', retailerId: null });
  if (!normalized.supported || normalized.canonicalCode !== request.canonicalCode || !native.supported || native.canonicalCode !== request.canonicalCode) throw new Error('unsupported_provider_code');
  const url = new URL(`/api/v2/product/${encodeURIComponent(request.nativeCode)}.json`, origin);
  url.searchParams.set('product_type', 'all');
  url.searchParams.set('fields', 'code,product_name,brands,ingredients_text,countries_tags,last_modified_t');
  return url.toString();
}
export function needsUpcIdentityFallback(identity: 'pending' | 'exact' | 'candidate' | 'ambiguous' | 'unresolved', reply: LookupReply): boolean {
  return identity !== 'exact' && reply.provider === 'open_facts' && ['found', 'not_found', 'unsupported', 'ambiguous', 'unavailable', 'malformed_response'].includes(reply.status);
}
export function buildUpcIdentityLookupUrl(requestInput: ProviderLookupRequest, reviewedEndpoint: string): string {
  const request = ProviderLookupRequestSchema.parse(requestInput), url = new URL(reviewedEndpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search) throw new Error('invalid_provider_endpoint');
  const normalized = normalizeBarcode({ raw: request.originalCode, symbology: request.symbology, namespace: 'gtin', retailerId: null });
  const native = normalizeBarcode({ raw: request.nativeCode, symbology: request.nativeCode.length === 8 ? request.symbology : null, namespace: 'gtin', retailerId: null });
  if (!normalized.supported || normalized.canonicalCode !== request.canonicalCode || !native.supported || native.canonicalCode !== request.canonicalCode) throw new Error('unsupported_provider_code');
  url.searchParams.set('upc', request.nativeCode); return url.toString();
}
/** Manufacturer/official-label rights and DailyMed exact package/NDC mapping are
 * unresolved. No general website scrape or drug-name association is substituted. */
export function supplementalAdapterDisabledReply(provider: 'manufacturer' | 'dailymed', policy: SourcePolicy, now: string): LookupReply {
  return LookupReplySchema.parse({ status: !policyAllows(policy, 'lookup', now) || !policyAllows(policy, 'process', now) || !policyAllows(policy, 'retain', now) || !policyAllows(policy, 'sharedDisplay', now) ? 'disallowed_by_source_policy' : 'configuration_required', provider, adapterVersion: PROVIDER_ADAPTER_VERSION, policyVersion: policy.version, providerRequestId: null, observations: [], retryAfter: null, reservationId: null, elapsedMs: 0, usage: { calls: 0, costMinor: 0 } });
}
