import type { ProductEvidencePhotoRole } from './ProductIdentityResolver.ts';

/** Private, server-issued upload target for a free product Check photo. */
export interface FreeProductEvidenceUpload {
  bucket: 'customer-product-evidence';
  storagePath: string;
  role: ProductEvidencePhotoRole;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';
  maxBytes: number;
}

export interface PrepareFreeProductEvidenceInput {
  /** A new UUID per photo; reuse on network retry. */
  requestId: string;
  role: ProductEvidencePhotoRole;
  mimeType: FreeProductEvidenceUpload['mimeType'];
}
