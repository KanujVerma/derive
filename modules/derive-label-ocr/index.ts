import { requireOptionalNativeModule } from 'expo-modules-core';
import type { NativeLabelOcrBridge } from '../../src/services/partOneOcr';
import { createPrivateLabelSanitizer } from '../../src/services/partOneUpload';
import type { NativeLabelUploadBridge } from '../../src/services/partOneUpload';
import { createAppleVisionRecognizer } from '../../src/services/partOneOcr';

const native = requireOptionalNativeModule<NativeLabelOcrBridge & NativeLabelUploadBridge>('DeriveLabelOcr');
export const isNativeLabelOcrAvailable = native !== null;
export const appleVisionLabelRecognizer = createAppleVisionRecognizer(native, code => {
  if (__DEV__) console.warn('Derive local OCR boundary:', code);
});

export const preparePrivateLabelUpload = createPrivateLabelSanitizer(native);
