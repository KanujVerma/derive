import type { ProductResolutionResult } from './ProductIdentityResolver.ts';

/** Source records are candidates; only the nested resolver result carries truth. */
export interface ProductLinkLabelCandidate {
  source: 'dailymed_spl';
  sourceRecordId: string;
  sourceVersion: number;
  title: string;
  publishedDate: string;
  sourceUrl: string;
  retrievedAt: string;
  identityStatus: 'label_title_only';
}

export type ProductLinkIntakeResult =
  | { status: 'resolution'; source: 'open_beauty_facts_url'; sourceUrl: string; barcode: string; resolution: ProductResolutionResult }
  | { status: 'label_candidate'; candidate: ProductLinkLabelCandidate; nextAction: 'confirm_package' }
  | { status: 'needs_details'; source: 'dailymed' | 'amazon' | 'amazon_short_link' | 'unsupported'; reason: string;
      nextAction: 'search_or_photo'; listingId?: string; sourceUrl?: string };

export interface ResolveProductLinkInput {
  /** Retain the same UUID for retries and the originating Check attempt. */
  requestId: string;
  url: string;
}
