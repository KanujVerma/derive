import { z } from 'zod';
import { LookupReplySchema, PartOneIdSchema, VariantSchema } from '../../../src/contracts/PartOne.ts';
import type { LookupReply, SourceObservation, SourcePolicy, Variant } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { policyAllows } from '../../../src/domain/part-one/evidence.ts';

export const PROVIDER_ADAPTER_VERSION = 'part-one-provider-2';
export const ProviderLookupRequestSchema = z.strictObject({ canonicalCode: z.string(), originalCode: z.string(), symbology: z.string().nullable(), nativeCode: z.string(), requestedMarket: z.string().nullable(), categoryHint: z.string().nullable(), requestedFields: z.array(z.enum(['identity', 'ingredients'])), jobId: PartOneIdSchema, stageId: PartOneIdSchema, deadlineAt: z.iso.datetime(), reservationId: PartOneIdSchema });
export type ProviderLookupRequest = z.infer<typeof ProviderLookupRequestSchema>;
export type BoundedProviderFixture = { status: number; contentType: string; body: string; retryAfter: string | null; providerRequestId: string | null; elapsedMs: number; decompressedBytes: number };
const emptyVariant = (): Variant => ({ brand: null, line: null, form: null, scent: null, shade: null, spf: null, strength: null, size: null, unit: null, packCount: null, packagingLevel: null });
const optionalString = z.string().nullable().optional();
const openProductSchema = z.object({ code: z.string(), product_name: optionalString, brands: optionalString, ingredients_text: optionalString, quantity: optionalString, image_front_url: optionalString, countries_tags: z.array(z.string()).optional(), last_modified_t: z.number().int().nonnegative().optional(), variant: VariantSchema.optional() });
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
  const records: Array<{ code: string; name: string | null; variant: Variant; nativeBrand: string | null; structuredVariant: Variant | null; ingredients: string | null; imageUrl?: string | null; sourceQuantity?: string | null; markets: string[]; updatedAt: string | null }> = [];
  if (provider === 'open_facts') {
    const envelope = openEnvelopeSchema.parse(body);
    if (envelope.status === 0) return envelope.product ? reply('malformed_response') : reply('not_found');
    if (!envelope.product) return reply('malformed_response');
    const p = envelope.product;
    records.push({ code: p.code, name: p.product_name ?? null, variant: p.variant ?? { ...emptyVariant(), brand: p.brands ?? null }, nativeBrand: p.brands ?? null, structuredVariant: p.variant ?? null, ingredients: request.requestedFields.includes('ingredients') ? p.ingredients_text ?? null : null, imageUrl: permittedOpenFactsImage(p.image_front_url ?? null, p.code, policy, input.now), sourceQuantity: p.quantity ?? null, markets: p.countries_tags ?? [], updatedAt: p.last_modified_t === undefined ? null : new Date(p.last_modified_t * 1000).toISOString() });
  } else {
    const envelope = upcEnvelopeSchema.parse(body);
    if (!envelope.items.length) return reply('not_found');
    for (const p of envelope.items) { if (!p.ean && !p.upc) return reply('malformed_response'); records.push({ code: p.ean ?? p.upc!, name: p.title, variant: p.variant ?? { ...emptyVariant(), brand: p.brand ?? null }, nativeBrand: p.brand ?? null, structuredVariant: p.variant ?? null, ingredients: null, markets: [], updatedAt: null }); }
  }
  // Normalize every returned code before comparing; the requested barcode is not source proof.
  const observations: SourceObservation[] = records.map((record, i) => {
    const normalized = normalizeBarcode({ raw: record.code, symbology: record.code.length === 8 ? 'ean8' : null, namespace: 'gtin', retailerId: null });
    const normalizedBrand = (brand: string) => brand.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
    const brandContradiction = record.nativeBrand !== null && record.structuredVariant?.brand != null && normalizedBrand(record.nativeBrand) !== normalizedBrand(record.structuredVariant.brand);
    return { observationId: records.length === 1 ? input.observationId : derivedId(input.observationId, i), provider, providerRequestId: fixture.providerRequestId, providerResponseId: null, comparison: brandContradiction ? 'contradiction' : !normalized.supported ? 'unknown' : normalized.canonicalCode === request.canonicalCode ? 'exact' : 'contradiction', fetchedAt: input.now, sourceUpdatedAt: record.updatedAt, adapterVersion: PROVIDER_ADAPTER_VERSION, parserVersion: 'raw-preserved-1', policyVersion: policy.version, contentHash: input.contentHash, variant: record.variant, sourceMarkets: record.markets, sourceUrl: input.sourceUrl, policyId: policy.policyId, status: 'active', dependencyIds: [], payload: { nativeCode: record.code, canonicalCode: normalized.canonicalCode, name: record.name, rawIngredients: record.ingredients, nativeBrand: record.nativeBrand, structuredVariant: record.structuredVariant, ...(provider === 'open_facts' ? { imageUrl: record.imageUrl ?? null, sourceQuantity: record.sourceQuantity ?? null } : {}) } };
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
  url.searchParams.set('fields', ['code', 'product_name', 'brands', ...(request.requestedFields.includes('ingredients') ? ['ingredients_text'] : []), 'quantity', 'image_front_url', 'countries_tags', 'last_modified_t'].join(','));
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

export type PrimaryProvider = 'open_facts' | 'upcitemdb';
export type ProviderConfiguration = { endpoint: string; allowedHosts: readonly string[]; userAgent: string; maxBytes?: number; timeoutMs?: number };
export interface ProviderTransport {
  /** The implementation connects only to the addresses supplied after validation. */
  pinsResolvedAddresses: true;
  resolve(hostname: string, signal: AbortSignal): Promise<string[]>;
  fetch(url: string, options: { method: 'GET'; headers: Record<string, string>; redirect: 'manual'; signal: AbortSignal; resolvedAddresses: readonly string[] }): Promise<Response>;
}
export function providerOperationPermitted(provider: PrimaryProvider, policy: SourcePolicy | undefined, fields: readonly string[], now: string): boolean {
  return policy?.provider === provider && ['lookup', 'process', 'retain', 'sharedDisplay'].every(operation => policyAllows(policy, operation as keyof SourcePolicy['operations'], now)) && fields.every(field => policy.retainedFields.includes(field));
}
export function emptyProviderReply(provider: string, status: LookupReply['status'], policyVersion = 'unconfigured', retryAfter: string | null = null): LookupReply {
  return LookupReplySchema.parse({ status, provider, adapterVersion: PROVIDER_ADAPTER_VERSION, policyVersion, providerRequestId: null, observations: [], retryAfter, reservationId: null, elapsedMs: 0, usage: { calls: 0, costMinor: 0 } });
}
/** Callable bounded adapter. No default fetch exists: only an explicit DNS-pinning
 * transport and reviewed per-operation policy can reach the dispatch boundary. */
export async function lookupPrimaryProvider(provider: PrimaryProvider, requestInput: ProviderLookupRequest, policy: SourcePolicy | undefined,
  config: ProviderConfiguration | undefined, transport: ProviderTransport | undefined,
  ports: { now(): string; hash(text: string): Promise<string>; observationId: string;
    beforeRequest(url: string, redirectIndex: number): Promise<boolean>; onUnknownDispatch?(): void; resume?: { url: string; redirectIndex: number }; afterRedirect?(url: string, redirectIndex: number): Promise<void> }): Promise<LookupReply> {
  const request = ProviderLookupRequestSchema.parse(requestInput);
  if (!providerOperationPermitted(provider, policy, request.requestedFields, ports.now())) return emptyProviderReply(provider, 'disallowed_by_source_policy', policy?.version);
  if (!config || !transport || transport.pinsResolvedAddresses !== true || !config.userAgent) return emptyProviderReply(provider, 'configuration_required', policy!.version);
  if (Date.parse(request.deadlineAt) <= Date.parse(ports.now())) return emptyProviderReply(provider, 'unavailable', policy!.version);
  let url: string;
  try { url = provider === 'open_facts' ? buildOpenFactsLookupUrl(request, config.endpoint) : buildUpcIdentityLookupUrl(request, config.endpoint); }
  catch { return emptyProviderReply(provider, 'unsupported', policy!.version); }
  if (ports.resume) {
    if (!Number.isInteger(ports.resume.redirectIndex) || ports.resume.redirectIndex < 1 || ports.resume.redirectIndex > 3) return emptyProviderReply(provider, 'unsupported', policy!.version);
    url = ports.resume.url;
  }
  const controller = new AbortController();
  const timeoutMs = Math.min(10000, Math.max(1, config.timeoutMs ?? 8000), Math.max(1, Date.parse(request.deadlineAt) - Date.parse(ports.now())));
  const maxBytes = Math.min(262144, Math.max(1, config.maxBytes ?? 65536));
  let dispatched = 0;
  let persistenceError: unknown;
  let authorizationInProgress = false;
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('provider_deadline')); }, timeoutMs); });
  const account = (reply: LookupReply): LookupReply => ({ ...reply, reservationId: dispatched ? request.reservationId : null, elapsedMs: dispatched ? Date.now() - started : 0, usage: { calls: dispatched, costMinor: 0 } });
  const execute = async (): Promise<LookupReply> => {
    for (let redirect = ports.resume?.redirectIndex ?? 0; redirect <= 3; redirect++) {
      // Validate again on every hop and every dispatch, including policy changes.
      if (!providerOperationPermitted(provider, policy, request.requestedFields, ports.now())) return account(emptyProviderReply(provider, 'disallowed_by_source_policy', policy!.version));
      const parsedUrl = new URL(url);
      if (controller.signal.aborted) throw new Error('provider_deadline');
      const addresses = await transport.resolve(parsedUrl.hostname, controller.signal);
      if (controller.signal.aborted) throw new Error('provider_deadline');
      if (!isPermittedProviderDestination(url, config.allowedHosts, addresses, redirect)) return account(emptyProviderReply(provider, 'unsupported', policy!.version));
      let authorized: boolean;
      try { authorizationInProgress = true; authorized = await ports.beforeRequest(url, redirect); authorizationInProgress = false; } catch (error) { persistenceError = error; throw error; }
      if (controller.signal.aborted) throw new Error('provider_deadline');
      if (!authorized) return account(emptyProviderReply(provider, 'rate_limited', policy!.version));
      dispatched++;
      const response = await transport.fetch(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': config.userAgent }, redirect: 'manual', signal: controller.signal, resolvedAddresses: addresses });
      if (controller.signal.aborted) { await response.body?.cancel(); throw new Error('provider_deadline'); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location || redirect === 3) return account(emptyProviderReply(provider, 'malformed_response', policy!.version));
        url = new URL(location, url).toString();
        try { await ports.afterRedirect?.(url, redirect + 1); } catch (error) { persistenceError = error; throw error; }
        continue;
      }
      const type = response.headers.get('content-type') ?? '';
      let body = '', bytes = 0;
      // Error statuses do not need raw denial pages retained to classify them.
      if (response.status === 200 && /^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(type)) {
        const reader = response.body?.getReader(); const chunks: Uint8Array[] = [];
        if (reader) {
          while (true) {
            const chunk = await reader.read(); if (controller.signal.aborted) { await reader.cancel(); throw new Error('provider_deadline'); } if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > maxBytes) { await reader.cancel(); return account(emptyProviderReply(provider, 'malformed_response', policy!.version)); }
            chunks.push(chunk.value);
          }
        }
        const payload = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
        body = new TextDecoder('utf-8', { fatal: true }).decode(payload);
      } else await response.body?.cancel();
      const reply = evaluateProviderFixture(provider, request, policy!, { status: response.status, contentType: type, body,
        retryAfter: response.headers.get('retry-after'), providerRequestId: response.headers.get('x-request-id'), elapsedMs: Date.now() - started, decompressedBytes: bytes },
      { now: ports.now(), observationId: ports.observationId, contentHash: await ports.hash(body), sourceUrl: url });
      return account(reply);
    }
    return account(emptyProviderReply(provider, 'malformed_response', policy!.version));
  };
  try { return await Promise.race([execute(), timeout]); }
  catch (error) { if (persistenceError !== undefined) throw persistenceError; if (dispatched || authorizationInProgress) ports.onUnknownDispatch?.(); return account(emptyProviderReply(provider, 'unavailable', policy!.version)); }
  finally { if (timer) clearTimeout(timer); controller.abort(); }
}

/** Only the returned barcode's unmodified provider front photo can be hotlinked. */
export function permittedOpenFactsImage(raw: string | null, code: string, policy: SourcePolicy, now: string): string | null {
  if (!raw || !policy.retainedFields.includes('images') || !policyAllows(policy, 'hotlink', now) || !policyAllows(policy, 'sharedDisplay', now)) return null;
  try {
    const url = new URL(raw);
    const pathCode = code.replace(/^0+(?=\d{13}$)/, '');
    const chunks = pathCode.length > 8 ? `${pathCode.slice(0, 3)}/${pathCode.slice(3, 6)}/${pathCode.slice(6, 9)}/${pathCode.slice(9)}` : pathCode;
    return url.protocol === 'https:' && ['images.openbeautyfacts.org', 'images.openfoodfacts.org'].includes(url.hostname) && !url.port && !url.username && !url.password && !url.search && !url.hash
      && url.pathname.startsWith(`/images/products/${chunks}/front_`) && /\.\d+\.\d+\.jpg$/.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}
