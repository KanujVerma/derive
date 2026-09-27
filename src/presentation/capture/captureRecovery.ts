import { CaptureProcessingError } from './freeEvidenceProcessor.ts';

/** Only allowlisted copy reaches the customer; never expose underlying errors. */
export function captureRecovery(cause: unknown): { message: string; canRetry: boolean; canCollectMore: boolean } {
  if (cause instanceof CaptureProcessingError) {
    switch (cause.code) {
      case 'DAILY_LIMIT':
        return { message: 'You have reached the daily product-photo limit. Your captures are still here while this screen is open. Try again later, or close capture and search by product name or barcode.', canRetry: false, canCollectMore: false };
      case 'ACCOUNT_CHANGED':
        return { message: 'Your session changed. Close capture and start a new Check.', canRetry: false, canCollectMore: false };
      case 'PHOTO_TOO_LARGE':
        return { message: 'This photo is too large. Retake it and try again.', canRetry: false, canCollectMore: true };
      case 'PHOTO_MIME_UNSUPPORTED':
        return { message: 'This photo format could not be used. Retake it and try again.', canRetry: false, canCollectMore: true };
    }
  }
  return { message: 'We could not review this evidence yet. Your captures are still here.', canRetry: true, canCollectMore: true };
}
