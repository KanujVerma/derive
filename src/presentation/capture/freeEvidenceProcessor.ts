import type { FreeProductEvidenceUpload, PrepareFreeProductEvidenceInput } from '../../contracts/FreeProductEvidence.ts';
import type { ProductResolutionResult, ResolveProductIdentityInput } from '../../contracts/ProductIdentityResolver.ts';
import type { CaptureCandidate, CaptureEvidence, CaptureProcessor, CaptureResult, PhotoRole } from './productEvidence.ts';
import { ProductPhotoReadError } from './readProductEvidencePhoto.ts';
import type { ProductPhoto } from './readProductEvidencePhoto.ts';

type Dependencies = {
  readPhoto(uri: string): Promise<ProductPhoto>;
  createRequestId(): string;
  prepare(input: PrepareFreeProductEvidenceInput): Promise<FreeProductEvidenceUpload>;
  upload(target: FreeProductEvidenceUpload, bytes: ArrayBuffer): Promise<void>;
  resolve(input: ResolveProductIdentityInput): Promise<ProductResolutionResult>;
};

export type CaptureProcessingErrorCode = 'PHOTO_FAILED' | 'PHOTO_TOO_LARGE' | 'PHOTO_MIME_UNSUPPORTED' | 'PREPARE_FAILED' | 'UPLOAD_FAILED' | 'RESOLVE_FAILED';
export class CaptureProcessingError extends Error {
  readonly code: CaptureProcessingErrorCode;

  constructor(code: CaptureProcessingErrorCode) {
    super(code);
    this.name = 'CaptureProcessingError';
    this.code = code;
  }
}

function candidatesFor(result: ProductResolutionResult): CaptureCandidate[] {
  return result.candidates.flatMap((candidate, index) => {
    const label = [candidate.brand, candidate.name].filter(Boolean).join(' ').trim();
    return label ? [{ id: `${result.caseId}:${index}`, label, detail: 'Possible match. Formula unverified.' }] : [];
  });
}

/** Keep S6's candidate and unknown authority boundary in the capture presentation. */
export function mapFreeResolutionToCapture(result: ProductResolutionResult): CaptureResult {
  const candidates = candidatesFor(result);
  if (result.state === 'ambiguous_candidates' && candidates.length) return { state: 'ambiguous', candidates };
  if (candidates.length) return { state: 'candidates', candidates };
  if (result.product && result.state !== 'insufficient_evidence') {
    const label = [result.product.brand, result.product.name].filter(Boolean).join(' ').trim();
    if (label) return { state: 'candidates', candidates: [{ id: `${result.caseId}:product`, label, detail: 'Possible match. Formula unverified.' }] };
  }
  return { state: 'insufficient_evidence', candidates: [] };
}

/** One processor instance belongs to one capture host and retains retry IDs in memory. */
export function createFreeEvidenceProcessor(deps: Dependencies): CaptureProcessor & {
  resolutionFor(review: CaptureResult): ProductResolutionResult | null;
} {
  const photoAttempts = new Map<string, { requestId: string; target?: FreeProductEvidenceUpload; uploaded: boolean }>();
  const resolutions = new WeakMap<CaptureResult, ProductResolutionResult>();
  let caseAttempt: { key: string; requestId: string } | null = null;

  const present = (result: ProductResolutionResult): CaptureResult => {
    const review = mapFreeResolutionToCapture(result);
    resolutions.set(review, result);
    return review;
  };

  return {
    async process(evidence: readonly CaptureEvidence[]): Promise<CaptureResult> {
      const barcode = evidence.find((item) => item.kind === 'barcode' && item.role === 'barcode');
      if (barcode) {
        if (!/^\d{8,14}$/.test(barcode.value)) return { state: 'insufficient_evidence', candidates: [] };
        const key = `barcode:${barcode.value}`;
        if (caseAttempt?.key !== key) caseAttempt = { key, requestId: deps.createRequestId() };
        try {
          return present(await deps.resolve({ requestId: caseAttempt.requestId, consumer: 'scan', barcode: barcode.value }));
        } catch { throw new CaptureProcessingError('RESOLVE_FAILED'); }
      }

      const photos = evidence.filter((item): item is CaptureEvidence & { role: PhotoRole; kind: 'local_photo' } =>
        item.kind === 'local_photo' && (item.role === 'front_label' || item.role === 'ingredients' || item.role === 'packaging'));
      if (!photos.length) return { state: 'insufficient_evidence', candidates: [] };
      if (photos.length > 3 || new Set(photos.map((item) => item.role)).size !== photos.length) {
        throw new CaptureProcessingError('PHOTO_FAILED');
      }
      const evidencePhotos: NonNullable<ResolveProductIdentityInput['evidencePhotos']> = [];
      for (const item of photos) {
        const key = `${item.role}\u0000${item.value}`;
        let image: ProductPhoto;
        try { image = await deps.readPhoto(item.value); }
        catch (error) {
          if (error instanceof ProductPhotoReadError && error.code === 'PHOTO_TOO_LARGE') throw new CaptureProcessingError('PHOTO_TOO_LARGE');
          if (error instanceof ProductPhotoReadError && error.code === 'PHOTO_MIME_UNSUPPORTED') throw new CaptureProcessingError('PHOTO_MIME_UNSUPPORTED');
          throw new CaptureProcessingError('PHOTO_FAILED');
        }
        let attempt = photoAttempts.get(key);
        if (!attempt) {
          attempt = { requestId: deps.createRequestId(), uploaded: false };
          photoAttempts.set(key, attempt);
        }
        if (!attempt.target) {
          try { attempt.target = await deps.prepare({ requestId: attempt.requestId, role: item.role, mimeType: image.mimeType }); }
          catch { throw new CaptureProcessingError('PREPARE_FAILED'); }
        }
        if (attempt.target.role !== item.role || attempt.target.mimeType !== image.mimeType
          || attempt.target.bucket !== 'customer-product-evidence' || !attempt.target.storagePath
          || !Number.isFinite(attempt.target.maxBytes) || attempt.target.maxBytes > 10 * 1024 * 1024
          || image.bytes.byteLength === 0 || image.bytes.byteLength > attempt.target.maxBytes) {
          throw new CaptureProcessingError('PHOTO_FAILED');
        }
        if (!attempt.uploaded) {
          try { await deps.upload(attempt.target, image.bytes); attempt.uploaded = true; }
          catch { throw new CaptureProcessingError('UPLOAD_FAILED'); }
        }
        evidencePhotos.push({ storagePath: attempt.target.storagePath, role: item.role });
      }
      const key = photos.map((item) => `${item.role}\u0000${item.value}`).join('\u0001');
      if (caseAttempt?.key !== key) caseAttempt = { key, requestId: deps.createRequestId() };
      try {
        return present(await deps.resolve({ requestId: caseAttempt.requestId, consumer: 'scan', evidencePhotos }));
      } catch { throw new CaptureProcessingError('RESOLVE_FAILED'); }
    },
    resolutionFor(review: CaptureResult): ProductResolutionResult | null {
      return resolutions.get(review) ?? null;
    },
  };
}
