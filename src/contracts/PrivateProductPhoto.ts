/** Explicit, one-shot sharing of product packaging only; never identity or skin context. */
export interface PrivateProductPhotoRequest {
  photos: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }[];
  photoSharingConsent: true;
}

/** Text observed on supplied labels, not a canonical formula or a suitability decision. */
export type PrivateProductPhotoResult = {
  status: 'extracted';
  productName: string | null;
  brand: string | null;
  size: string | null;
  ingredientsText: string | null;
  category: 'skincare' | 'other_personal_care' | 'unsupported' | 'unknown';
  basis: 'photo_label';
  formulaVerified: false;
} | { status: 'unreadable' | 'rate_limited' | 'configuration_required' | 'unavailable' };
