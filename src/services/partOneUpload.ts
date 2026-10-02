import { z } from 'zod';
import { OcrObservationSchema } from '../contracts/PartOne.ts';
import { validateOcrObservation } from './partOneOcr.ts';
import type { LocalOcrInput, OcrObservation } from './partOneOcr.ts';
export type LabelDerivativeOcrBinding = Omit<LocalOcrInput, 'uri'>;
/** Sanitization is local only. This boundary neither uploads nor persists its returned bytes. */
export type PreparedLabelUpload = { bytes: Uint8Array; mimeType: 'image/jpeg'; width: number; height: number;
  sourceWidth: number; sourceHeight: number; orientationTransform: number[]; cropRegion: number[]; recipeVersion: 'derive-private-jpeg-v1'; derivativeObservation?: OcrObservation };
export interface NativeLabelUploadBridge { prepareUpload(input: { uri: string; cropRegion: number[] } & Partial<LabelDerivativeOcrBinding>): Promise<unknown> }
const payloadSchema = z.strictObject({ status: z.literal('prepared'), base64: z.string().max(Math.ceil(2 * 1024 * 1024 / 3) * 4),
  mimeType: z.literal('image/jpeg'), width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096),
  sourceWidth: z.number().int().positive(), sourceHeight: z.number().int().positive(), orientationTransform: z.array(z.number().finite()).length(9),
  cropRegion: z.array(z.number().min(0).max(1)).length(4), recipeVersion: z.literal('derive-private-jpeg-v1'), derivativeObservation: OcrObservationSchema.optional() });
function decodeBase64(value: string): Uint8Array {
  if (!value || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('invalid_sanitized_derivative');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0, length = value.length / 4 * 3 - padding;
  if (length < 4 || length > 2 * 1024 * 1024) throw new Error('invalid_sanitized_derivative');
  const bytes = new Uint8Array(length); let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const bits = alphabet.indexOf(value[index]) << 18 | alphabet.indexOf(value[index + 1]) << 12 |
      Math.max(0, alphabet.indexOf(value[index + 2])) << 6 | Math.max(0, alphabet.indexOf(value[index + 3]));
    if (offset < length) bytes[offset++] = bits >> 16 & 255;
    if (offset < length) bytes[offset++] = bits >> 8 & 255;
    if (offset < length) bytes[offset++] = bits & 255;
  }
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[length - 2] !== 255 || bytes[length - 1] !== 217) {
    bytes.fill(0); throw new Error('invalid_sanitized_derivative');
  }
  return bytes;
}
export function createPrivateLabelSanitizer(native: NativeLabelUploadBridge | null) {
  return async (uri: string, cropRegion = [0, 0, 1, 1], binding?: LabelDerivativeOcrBinding): Promise<PreparedLabelUpload> => {
    if (!native || !uri.startsWith('file://')) throw new Error('local_sanitizer_unavailable');
    if (cropRegion.length !== 4 || cropRegion.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
      !cropRegion[2] || !cropRegion[3] || cropRegion[0] + cropRegion[2] > 1 || cropRegion[1] + cropRegion[3] > 1) throw new Error('invalid_crop_region');
    let payload: unknown;
    try { payload = await native.prepareUpload({ uri, cropRegion, ...binding }); } catch { throw new Error('local_sanitizer_failed'); }
    const parsed = payloadSchema.safeParse(payload); if (!parsed.success) throw new Error('invalid_sanitized_derivative');
    const { base64, status: _status, ...properties } = parsed.data;
    const actual = properties.cropRegion;
    if (!actual[2] || !actual[3] || actual[0] + actual[2] > 1 || actual[1] + actual[3] > 1 ||
      properties.sourceWidth * properties.sourceHeight > 40_000_000) throw new Error('invalid_sanitized_derivative');
    if (binding) {
      if (!properties.derivativeObservation || binding.correctionEnabled !== false) throw new Error('missing_derivative_observation');
      const observation = validateOcrObservation(properties.derivativeObservation, { uri, ...binding });
      if (observation.sourceWidth !== properties.width || observation.sourceHeight !== properties.height ||
        JSON.stringify(observation.orientationTransform) !== '[1,0,0,0,1,0,0,0,1]') throw new Error('invalid_derivative_geometry');
    }
    return { ...properties, bytes: decodeBase64(base64) };
  };
}
