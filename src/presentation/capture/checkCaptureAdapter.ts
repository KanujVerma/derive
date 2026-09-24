import type { CaptureEvidence, CaptureHandoff, CaptureProcessor, CaptureResult, PhotoRole } from './productEvidence';
import type { ProductResolutionResult } from '../../contracts/ProductIdentityResolver';

export interface CheckCaptureHandoff {
  authority: 'customer_evidence';
  barcodeLookup: { barcode: string } | null;
  localPhotos: { role: PhotoRole; uri: string }[];
  review: {
    state: CaptureResult['state'] | 'pending';
    selectedCandidateId: string | null;
  };
  /** Server result already produced from these exact photos; Check must not resolve them again. */
  resolvedCase?: ProductResolutionResult | null;
}

// This is a local handoff only. The host decides when or whether to resolve evidence.
export function mapCaptureForCheck(handoff: CaptureHandoff, outcome?: CaptureResult): CheckCaptureHandoff {
  const barcode = handoff.evidence.find((item) => item.role === 'barcode' && item.kind === 'barcode')?.value;
  const localPhotos = handoff.evidence.flatMap((item) =>
    item.kind === 'local_photo' && (item.role === 'front_label' || item.role === 'ingredients' || item.role === 'packaging')
      ? [{ role: item.role, uri: item.value }]
      : [],
  );
  const selectedCandidateId = outcome?.candidates.some((candidate) => candidate.id === handoff.selectedCandidateId)
    ? handoff.selectedCandidateId ?? null
    : null;

  return {
    authority: 'customer_evidence',
    barcodeLookup: barcode && /^\d{8,14}$/.test(barcode) ? { barcode } : null,
    localPhotos,
    review: { state: outcome?.state ?? 'pending', selectedCandidateId },
  };
}

export function createCheckCaptureBridge(processor: CaptureProcessor & {
  resolutionFor?: (review: CaptureResult) => ProductResolutionResult | null;
}): {
  processor: CaptureProcessor;
  handoff: (capture: CaptureHandoff) => CheckCaptureHandoff;
} {
  let reviewedEvidence: readonly CaptureEvidence[] | null = null;
  let outcome: CaptureResult | undefined;
  let processingSequence = 0;

  return {
    processor: {
      async process(evidence) {
        const sequence = ++processingSequence;
        reviewedEvidence = null;
        outcome = undefined;
        try {
          const result = await processor.process(evidence);
          if (sequence === processingSequence) {
            reviewedEvidence = evidence.map((item) => ({ ...item }));
            outcome = result;
          }
          return result;
        } catch (error) {
          if (sequence === processingSequence) {
            reviewedEvidence = evidence.map((item) => ({ ...item }));
            outcome = { state: 'insufficient_evidence', candidates: [] };
          }
          throw error;
        }
      },
    },
    handoff(capture) {
      const stillCurrent = reviewedEvidence !== null &&
        reviewedEvidence.length === capture.evidence.length &&
        reviewedEvidence.every((item, index) => {
          const current = capture.evidence[index];
          return current.role === item.role && current.kind === item.kind && current.value === item.value;
        });
      return {
        ...mapCaptureForCheck(capture, stillCurrent ? outcome : undefined),
        resolvedCase: stillCurrent && outcome ? processor.resolutionFor?.(outcome) ?? null : null,
      };
    },
  };
}
