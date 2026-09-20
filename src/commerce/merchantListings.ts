/** Curated beta acquisition data. This is client presentation, not product or offer authority. */
import { resolveActionCommerceSemantics } from './types.ts';
import type { RoutineAction } from '../types/schema.ts';

export interface MerchantDefinition {
  id: string;
  displayName: string;
  trustedDomains: readonly string[];
  kind: 'external' | 'derive';
  priority: number;
}

export interface MerchantListing {
  id: string;
  productKey: string;
  merchantId: string;
  merchantProductId?: string;
  url?: string;
  verifiedAt: string;
  variant?: string;
  purchasePath?: { kind: 'derive_checkout' };
}

export interface MerchantOfferSnapshot {
  listingId: string;
  amountMinor: number;
  currency: string;
  observedAt: string;
  source: { kind: 'merchant_api' | 'official_feed'; name: string };
  availability?: 'in_stock' | 'out_of_stock';
}

export interface PurchaseOptionPresentation {
  merchant: MerchantDefinition;
  listing: MerchantListing;
  offer?: { price: string; provenance: string };
}

export const MERCHANTS: readonly MerchantDefinition[] = [
  { id: 'derive', displayName: 'Derive', trustedDomains: [], kind: 'derive', priority: 0 },
  { id: 'target', displayName: 'Target', trustedDomains: ['www.target.com'], kind: 'external', priority: 20 },
  { id: 'ulta', displayName: 'Ulta', trustedDomains: ['www.ulta.com'], kind: 'external', priority: 30 },
  { id: 'sephora', displayName: 'Sephora', trustedDomains: ['www.sephora.com'], kind: 'external', priority: 40 },
  { id: 'walmart', displayName: 'Walmart', trustedDomains: ['www.walmart.com'], kind: 'external', priority: 50 },
  { id: 'amazon', displayName: 'Amazon', trustedDomains: ['www.amazon.com'], kind: 'external', priority: 60 },
  { id: 'cerave', displayName: 'CeraVe', trustedDomains: ['www.cerave.com'], kind: 'external', priority: 10 },
];

/** Only case and whitespace normalization. Punctuation and variant words must match. */
export function exactProductKey(brand: string, name: string): string {
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return JSON.stringify([normalize(brand), normalize(name)]);
}

export const CURATED_LISTINGS: readonly MerchantListing[] = [
  {
    id: 'cerave-hydrating-cleanser-ulta',
    productKey: exactProductKey('CeraVe', 'Hydrating Facial Cleanser'),
    merchantId: 'ulta',
    merchantProductId: '2559841',
    url: 'https://www.ulta.com/p/hydrating-facial-cleanser-xlsImpprod4190255',
    verifiedAt: '2026-09-19',
    variant: 'Choose size at Ulta',
  },
];

/** Recheck untrusted data at both option composition and tap time. */
export function isTrustedMerchantUrl(raw: string | undefined, merchant: MerchantDefinition): boolean {
  if (!raw || merchant.kind !== 'external') return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.port === '' && !url.username && !url.password &&
      url.hash === '' && merchant.trustedDomains.includes(url.hostname.toLowerCase()) &&
      url.pathname !== '/' && !/^\/(?:search|s|browse)(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** Current means observed within 24 hours through a named authoritative source. */
export function presentOfferPrice(offer: MerchantOfferSnapshot, now: string): { price: string; provenance: string } | null {
  const age = Date.parse(now) - Date.parse(offer.observedAt);
  if (offer.availability === 'out_of_stock' || !Number.isSafeInteger(offer.amountMinor) || offer.amountMinor < 0 ||
      offer.currency !== 'USD' || !['official_feed', 'merchant_api'].includes(offer.source?.kind) ||
      !offer.source.name?.trim() || !Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) return null;
  return {
    price: new Intl.NumberFormat('en-US', { style: 'currency', currency: offer.currency }).format(offer.amountMinor / 100),
    provenance: `Checked ${new Date(offer.observedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${offer.source.name}`,
  };
}

export function resolvePurchaseOptions(input: {
  product: { id: string; brand: string; name: string; isCatalogStandard?: boolean };
  currentRoutineProductIds: readonly string[];
  action?: RoutineAction;
  routineStatus: 'draft' | 'awaiting_review' | 'approved' | 'published' | null;
  merchants?: readonly MerchantDefinition[];
  listings?: readonly MerchantListing[];
  offers?: readonly MerchantOfferSnapshot[];
  now?: string;
}): PurchaseOptionPresentation[] {
  if (!input.product.isCatalogStandard || !input.currentRoutineProductIds.includes(input.product.id) || !input.action ||
      !resolveActionCommerceSemantics(input.action, input.routineStatus).acquisitionEligible) return [];
  const key = exactProductKey(input.product.brand, input.product.name);
  const merchants = input.merchants ?? MERCHANTS;
  const offers = input.offers ?? [];
  const now = input.now ?? new Date().toISOString();
  return (input.listings ?? CURATED_LISTINGS).flatMap((listing) => {
    if (listing.productKey !== key) return [];
    const merchant = merchants.find((candidate) => candidate.id === listing.merchantId);
    if (!merchant) return [];
    const offer = offers.find((candidate) => candidate.listingId === listing.id);
    const presentedOffer = offer && presentOfferPrice(offer, now);
    if (merchant.kind === 'derive') {
      // Only a verified, active future Derive offer can enter the presentation.
      if (listing.purchasePath?.kind !== 'derive_checkout' || !presentedOffer) return [];
    } else if (!isTrustedMerchantUrl(listing.url, merchant)) return [];
    return [{ merchant, listing, ...(presentedOffer ? { offer: presentedOffer } : {}) }];
  }).sort((a, b) => a.merchant.priority - b.merchant.priority);
}

/** An external click is an intent signal, never an Order or proof of purchase. */
export async function openExternalPurchase(
  option: PurchaseOptionPresentation,
  productId: string,
  openURL: (url: string) => Promise<unknown>,
  track: (event: 'external_purchase_opened', payload: { productId: string; merchantId: string; entryPoint: 'product_detail' }) => void,
): Promise<boolean> {
  if (!isTrustedMerchantUrl(option.listing.url, option.merchant)) return false;
  try {
    await openURL(option.listing.url!);
  } catch {
    return false;
  }
  try {
    track('external_purchase_opened', { productId, merchantId: option.merchant.id, entryPoint: 'product_detail' });
  } catch {
    // Telemetry must not turn an already opened retailer page into a failed handoff.
  }
  return true;
}
