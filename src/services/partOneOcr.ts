import { OcrObservationSchema, PartOneIdSchema } from '../contracts/PartOne.ts';
import type { OcrObservation } from '../contracts/PartOne.ts';
export { OcrObservationSchema } from '../contracts/PartOne.ts';
export type { OcrObservation } from '../contracts/PartOne.ts';

/** Replaceable local recognizer boundary. No network, storage or analytics dependency. */
export type LocalOcrInput = {
  uri: string; evidenceId: string; captureSessionId: string; generation: number;
  languages: string[]; correctionEnabled: boolean;
};
export interface LocalLabelRecognizer {
  recognize(input: LocalOcrInput): Promise<OcrObservation>;
}
export interface NativeLabelOcrBridge { recognize(input: LocalOcrInput): Promise<unknown> }
export type LocalOcrDiagnostic = 'native_unavailable' | 'native_call_failed' | 'native_payload_invalid' |
  'native_binding_mismatch:evidenceId' | 'native_binding_mismatch:captureSessionId' | 'native_binding_mismatch:generation' |
  'native_binding_mismatch:correctionEnabled' | 'native_binding_mismatch:languageConfig' | 'native_payload_valid';
/** Diagnostic codes contain no photo URI, recognized text, identifiers or native exception details. */
export function createAppleVisionRecognizer(native: NativeLabelOcrBridge | null,
  onDiagnostic: (code: LocalOcrDiagnostic) => void = () => {}): LocalLabelRecognizer {
  return { async recognize(input) {
    if (!native) { onDiagnostic('native_unavailable'); throw new Error('model_unavailable'); }
    let payload: unknown;
    try { payload = await native.recognize(input); }
    catch { onDiagnostic('native_call_failed'); throw new Error('native_ocr_call_failed'); }
    const parsed = OcrObservationSchema.safeParse(payload);
    if (!parsed.success) { onDiagnostic('native_payload_invalid'); throw new Error('malformed_ocr_observation'); }
    const result = parsed.data;
    for (const field of ['evidenceId', 'captureSessionId', 'generation', 'correctionEnabled'] as const) {
      if (result[field] !== input[field]) { onDiagnostic(`native_binding_mismatch:${field}`); throw new Error('stale_ocr_binding'); }
    }
    if (JSON.stringify(result.languageConfig) !== JSON.stringify(input.languages)) {
      onDiagnostic('native_binding_mismatch:languageConfig'); throw new Error('stale_ocr_binding');
    }
    let observation: OcrObservation;
    try { observation = validateOcrObservation(result, input); }
    catch { onDiagnostic('native_payload_invalid'); throw new Error('malformed_ocr_observation'); }
    onDiagnostic('native_payload_valid'); return observation;
  } };
}
export const PART_ONE_OCR_LIMITS = Object.freeze({ maxImages: 6, maxLongEdge: 4096,
  maxConcurrentRecognition: 1, draftInactivityMs: 30 * 60 * 1000 });

/** Build proof alone cannot replace supported-device/script and privacy release acceptance. */
export const PART_ONE_OCR_RELEASE_ENABLED = false;
export function localOcrAvailable(input: { evaluationEnabled: boolean; platform: string; nativeAvailable: boolean }) {
  return input.evaluationEnabled && input.platform === 'ios' && input.nativeAvailable;
}
export function validateOcrObservation(value: unknown, input: LocalOcrInput): OcrObservation {
  const result = OcrObservationSchema.parse(value);
  if (result.evidenceId !== input.evidenceId || result.captureSessionId !== input.captureSessionId ||
    result.generation !== input.generation || result.correctionEnabled !== input.correctionEnabled ||
    JSON.stringify(result.languageConfig) !== JSON.stringify(input.languages)) throw new Error('stale_ocr_binding');
  if (result.status === 'recognized' && result.lines.length === 0) throw new Error('malformed_ocr_observation');
  if (result.status !== 'recognized' && result.lines.length > 0) throw new Error('malformed_ocr_observation');
  return result;
}

export const LOCAL_OCR_MESSAGES = Object.freeze({
  camera_denied: 'Camera access is off. Choose a photo or return to this product.',
  picker_cancelled: 'No photo added. Your product and draft are unchanged.',
  unsupported_script: 'This label language is not supported on this device. Your product is unchanged.',
  model_unavailable: 'Local text recognition is unavailable on this device. Try another supported device.',
  no_text: 'No readable text found. Add a clearer photo with some overlap.',
  failed: 'This photo could not be read locally. Add another photo or return to this product.',
  cap_reached: 'Six photos are already in this draft. Readable text remains partial; remove a photo to add another.',
  unsaved: 'This is a temporary preview. Private label text and photos are not saved.',
});

export const PART_ONE_DRAFT_CACHE_DIRECTORY = 'derive-part-one-drafts-v1';
export function isAppCacheFileUri(uri: string, cacheRoot: string) {
  const root = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
  try {
    const decoded = decodeURIComponent(uri);
    return uri.startsWith('file://') && uri.startsWith(root) && !decoded.includes('/../') && !decoded.includes('/./');
  } catch { return false; }
}
export type DraftCacheIo = { cacheRoot: string; draftRoot: string; removeDraftDirectory: () => void;
  createDraftDirectory: () => void; moveFile: (source: string, destination: string) => void };
/** No owner manifest or payload is saved: every process starts by removing all managed drafts. */
export function createDraftCacheLifecycle(io: DraftCacheIo) {
  let ready = false;
  return {
    initialize() {
      if (ready) return true;
      try { io.removeDraftDirectory(); io.createDraftDirectory(); ready = true; return true; }
      catch { return false; }
    },
    stage(source: string, evidenceId: string) {
      if (!ready) throw new Error('local_capture_cache_unavailable');
      PartOneIdSchema.parse(evidenceId);
      if (!isAppCacheFileUri(source, io.cacheRoot)) throw new Error('app_cache_photo_required');
      const root = io.draftRoot.endsWith('/') ? io.draftRoot : `${io.draftRoot}/`;
      const destination = `${root}${evidenceId}.img`;
      if (!isAppCacheFileUri(destination, io.cacheRoot)) throw new Error('invalid_draft_cache_root');
      io.moveFile(source, destination); return destination;
    },
  };
}
