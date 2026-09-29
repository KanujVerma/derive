import { z } from 'zod';
import type { ProductLinkIntakeResult, ResolveProductLinkInput } from '../contracts/ProductLinkIntake.ts';
import { parseProductTruthSnapshot } from '../contracts/productTruthValidation.ts';

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(500);
const https = z.string().url().refine((value) => new URL(value).protocol === 'https:');
const resolutionSchema = z.object({
  caseId: uuid,
  state: z.enum(['verified_product_formula', 'identified_formula_unverified', 'ambiguous_candidates', 'formula_only', 'insufficient_evidence']),
  product: z.object({ productId: uuid, brand: text, name: text, variantId: uuid.optional(), variantName: text.optional(), regionCode: text.optional() }).optional(),
  formula: z.object({ formulaVersionId: uuid, verificationStatus: z.literal('verified'), sourceReference: text, observedAt: text }).optional(),
  candidates: z.array(z.object({ productId: uuid.optional(), variantId: uuid.optional(), formulaVersionId: uuid.optional(),
    brand: text.optional(), name: text.optional(), variantName: text.optional(),
    basis: z.enum(['authoritative_identifier', 'exact_typed_identity', 'label_text', 'ingredient_fingerprint', 'packaging', 'combined_candidate_evidence']),
    matchReasons: z.array(text).max(30) })).max(30),
  nextAction: z.enum(['evaluate_product_fit', 'confirm_variant', 'photograph_ingredients', 'choose_candidate', 'manual_review']),
  requiresFounderReview: z.boolean(),
  truthSnapshot: z.unknown().optional(),
}).passthrough();
const resultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('resolution'), source: z.literal('open_beauty_facts_url'), sourceUrl: https,
    barcode: z.string().regex(/^\d{8}$|^\d{12,14}$/), resolution: resolutionSchema }),
  z.object({ status: z.literal('label_candidate'), nextAction: z.literal('confirm_package'), candidate: z.object({
    source: z.literal('dailymed_spl'), sourceRecordId: uuid, sourceVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(240), publishedDate: z.string().min(1).max(40), sourceUrl: https,
    retrievedAt: z.string().datetime(), identityStatus: z.literal('label_title_only'),
  }) }),
  z.object({ status: z.literal('needs_details'), source: z.enum(['dailymed', 'amazon', 'amazon_short_link', 'unsupported']),
    reason: text, nextAction: z.literal('search_or_photo'), listingId: z.string().regex(/^[A-Z0-9]{10}$/).optional(), sourceUrl: https.optional() }),
]);

export class ProductLinkError extends Error {
  readonly code: 'INVALID_LINK' | 'RATE_LIMITED' | 'UNAVAILABLE';
  constructor(code: 'INVALID_LINK' | 'RATE_LIMITED' | 'UNAVAILABLE') {
    super(code === 'INVALID_LINK' ? 'Enter a valid HTTPS product link.'
      : code === 'RATE_LIMITED' ? 'Product lookup is temporarily limited. Try again later.'
        : 'Product link lookup is unavailable. Search by name or scan the package.');
    this.name = 'ProductLinkError';
    this.code = code;
  }
}

/** Validate a remote response without upgrading a label title into product truth. */
export function parseProductLinkResult(value: unknown): ProductLinkIntakeResult {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) throw new ProductLinkError('UNAVAILABLE');
  const result = parsed.data;
  if (result.status === 'resolution') {
    const resolution = result.resolution;
    if ((resolution.state === 'verified_product_formula' && (!resolution.product?.variantId || !resolution.formula))
        || (resolution.formula && resolution.state !== 'verified_product_formula' && resolution.state !== 'formula_only')
        || (resolution.nextAction === 'evaluate_product_fit' && resolution.state !== 'verified_product_formula')) {
      throw new ProductLinkError('UNAVAILABLE');
    }
  }
  if (result.status === 'resolution' && result.resolution.truthSnapshot !== undefined) {
    try {
      const resolution = result.resolution;
      const snapshot = parseProductTruthSnapshot(resolution.truthSnapshot);
      if (snapshot.resolutionCaseId !== resolution.caseId || snapshot.state !== resolution.state
          || (snapshot.product?.productId ?? null) !== (resolution.product?.productId ?? null)
          || (snapshot.product?.variantId ?? null) !== (resolution.product?.variantId ?? null)
          || (snapshot.formula?.formulaVersionId ?? null) !== (resolution.formula?.formulaVersionId ?? null)) {
        throw new Error('Snapshot mismatch');
      }
      resolution.truthSnapshot = snapshot;
    } catch { throw new ProductLinkError('UNAVAILABLE'); }
  }
  return result as ProductLinkIntakeResult;
}

type LinkClient = { functions: { invoke: (name: string, options: { body: ResolveProductLinkInput }) => Promise<{ data: unknown; error: unknown }> } };

/** One authenticated call; UI controls retries and must ignore stale owner responses. */
export async function resolveProductLink(input: ResolveProductLinkInput, client?: LinkClient): Promise<ProductLinkIntakeResult> {
  if (!uuid.safeParse(input.requestId).success || typeof input.url !== 'string'
      || input.url.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(input.url)) throw new ProductLinkError('INVALID_LINK');
  let url: URL;
  try { url = new URL(input.url); } catch { throw new ProductLinkError('INVALID_LINK'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new ProductLinkError('INVALID_LINK');
  const selected = client ?? (await import('./supabase.ts')).supabase;
  if (!selected) throw new ProductLinkError('UNAVAILABLE');
  let response;
  try { response = await selected.functions.invoke('resolve-product-link', { body: input }); }
  catch { throw new ProductLinkError('UNAVAILABLE'); }
  if (response.error) {
    const context = (response.error as { context?: { status?: number } }).context;
    if (context?.status === 429) throw new ProductLinkError('RATE_LIMITED');
    if (context?.status === 400) throw new ProductLinkError('INVALID_LINK');
    throw new ProductLinkError('UNAVAILABLE');
  }
  return parseProductLinkResult(response.data);
}
