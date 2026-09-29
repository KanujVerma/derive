import type { ProductResolutionResult } from '../../../src/contracts/ProductIdentityResolver.ts';
import { lookupDailyMedLink, type DailyMedLinkLookup } from '../_shared/dailymed-link-candidate.ts';
import { InvalidProductLink, parseProductLink } from '../_shared/product-link-intake.ts';

type LinkAuth = { userId: string; admin: unknown };

interface Dependencies<TAuth extends LinkAuth> {
  authenticate: (request: Request) => Promise<TAuth>;
  readJsonObject: (request: Request) => Promise<Record<string, unknown>>;
  reserveExternalLookup: (identity: TAuth) => Promise<void>;
  resolveBarcode: (identity: TAuth, requestId: string, barcode: string, request: Request) => Promise<ProductResolutionResult>;
  lookupDailyMed?: typeof lookupDailyMedLink;
  dailyMedEnabled: boolean;
  failure: (code: string, message: string, status: number) => Error;
  respond: (body: unknown, status?: number) => Response;
  errorResponse: (error: unknown) => Response;
  corsHeaders: HeadersInit;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleProductLink<TAuth extends LinkAuth>(request: Request, deps: Dependencies<TAuth>): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: deps.corsHeaders });
  if (request.method !== 'POST') return deps.respond({ code: 'METHOD_NOT_ALLOWED', error: 'POST required' }, 405);
  try {
    const identity = await deps.authenticate(request);
    const body = await deps.readJsonObject(request);
    if (Object.keys(body).some((key) => key !== 'url' && key !== 'requestId')
        || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
      throw deps.failure('INVALID_PAYLOAD', 'A request ID and product URL are required', 400);
    }
    let link;
    try { link = parseProductLink(body.url); }
    catch (error) {
      if (error instanceof InvalidProductLink) throw deps.failure('INVALID_PRODUCT_LINK', error.message, 400);
      throw error;
    }
    if (link.kind === 'barcode_hint') {
      const resolution = await deps.resolveBarcode(identity, body.requestId, link.barcode, request);
      return deps.respond({ status: 'resolution', source: link.source, sourceUrl: link.canonicalUrl,
        barcode: link.barcode, resolution });
    }
    if (link.kind === 'dailymed_label') {
      if (!deps.dailyMedEnabled) return deps.respond({ status: 'needs_details', source: link.source,
        reason: 'Label lookup is not available yet', nextAction: 'search_or_photo' });
      await deps.reserveExternalLookup(identity);
      const found: DailyMedLinkLookup = await (deps.lookupDailyMed ?? lookupDailyMedLink)(link);
      if (found.status === 'candidate') return deps.respond({ status: 'label_candidate',
        candidate: found.candidate, nextAction: 'confirm_package' });
      if (found.status === 'rate_limited') throw deps.failure('RATE_LIMITED', 'Label lookup is temporarily limited', 429);
      return deps.respond({ status: 'needs_details', source: link.source,
        reason: found.status === 'historical_version_unavailable' ? 'This older label version needs a package check'
          : 'The label could not identify this package', nextAction: 'search_or_photo' });
    }
    if (link.kind === 'amazon_listing') return deps.respond({ status: 'needs_details', source: link.source,
      listingId: link.asin, sourceUrl: link.canonicalUrl, reason: 'An Amazon listing alone cannot confirm the product or ingredients',
      nextAction: 'search_or_photo' });
    return deps.respond({ status: 'needs_details', source: link.source, reason: link.reason,
      nextAction: 'search_or_photo' });
  } catch (error) { return deps.errorResponse(error); }
}
