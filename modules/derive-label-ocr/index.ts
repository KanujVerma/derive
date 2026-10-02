import { requireOptionalNativeModule } from 'expo-modules-core';
import type { NativeLabelOcrBridge } from '../../src/services/partOneOcr';
import { createAppleVisionRecognizer } from '../../src/services/partOneOcr';

const native = requireOptionalNativeModule<NativeLabelOcrBridge>('DeriveLabelOcr');
export const isNativeLabelOcrAvailable = native !== null;
export const appleVisionLabelRecognizer = createAppleVisionRecognizer(native, code => {
  if (__DEV__) console.warn('Derive local OCR boundary:', code);
});
