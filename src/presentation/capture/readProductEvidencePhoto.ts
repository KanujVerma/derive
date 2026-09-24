import type { FreeProductEvidenceUpload } from '../../contracts/FreeProductEvidence.ts';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
type PhotoPlatform = 'ios' | 'android' | 'web';
type NativePhotoFile = { exists: boolean; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };

export type ProductPhoto = { bytes: ArrayBuffer; mimeType: FreeProductEvidenceUpload['mimeType'] };
export type ProductPhotoReadOptions = {
  platform?: PhotoPlatform;
  nativeFileFactory?: (uri: string) => NativePhotoFile;
  fetchPhoto?: (uri: string) => Promise<{ ok: boolean; blob(): Promise<Blob> }>;
};

export type ProductPhotoReadErrorCode = 'PHOTO_READ_FAILED' | 'PHOTO_EMPTY' | 'PHOTO_TOO_LARGE' | 'PHOTO_MIME_UNSUPPORTED';

export class ProductPhotoReadError extends Error {
  readonly code: ProductPhotoReadErrorCode;

  constructor(code: ProductPhotoReadErrorCode) {
    super(code);
    this.name = 'ProductPhotoReadError';
    this.code = code;
  }
}

function checkSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new ProductPhotoReadError('PHOTO_EMPTY');
  if (size > MAX_PHOTO_BYTES) throw new ProductPhotoReadError('PHOTO_TOO_LARGE');
}

function mimeFromBytes(bytes: ArrayBuffer): ProductPhoto['mimeType'] {
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 24));
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => head[index] === value)) return 'image/png';
  const ascii = (start: number, end: number) => String.fromCharCode(...head.slice(start, end));
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(brand)) return 'image/heif';
  }
  throw new ProductPhotoReadError('PHOTO_MIME_UNSUPPORTED');
}

function currentPlatform(): PhotoPlatform {
  return process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android' ? process.env.EXPO_OS : 'web';
}

/** Read camera evidence with Expo's existing File API and identify its type from bytes. */
export async function readProductEvidencePhoto(uri: string, options: ProductPhotoReadOptions = {}): Promise<ProductPhoto> {
  try {
    let bytes: ArrayBuffer;
    if ((options.platform ?? currentPlatform()) === 'web') {
      const response = await (options.fetchPhoto ?? fetch)(uri);
      if (!response.ok) throw new ProductPhotoReadError('PHOTO_READ_FAILED');
      const blob = await response.blob();
      checkSize(blob.size);
      bytes = await blob.arrayBuffer();
    } else {
      const file = options.nativeFileFactory
        ? options.nativeFileFactory(uri)
        : new (await import('expo-file-system')).File(uri);
      if (!file.exists) throw new ProductPhotoReadError('PHOTO_READ_FAILED');
      checkSize(file.size);
      bytes = await file.arrayBuffer();
    }
    if (!(bytes instanceof ArrayBuffer)) throw new ProductPhotoReadError('PHOTO_READ_FAILED');
    checkSize(bytes.byteLength);
    return { bytes, mimeType: mimeFromBytes(bytes) };
  } catch (error) {
    if (error instanceof ProductPhotoReadError) throw error;
    // Native exceptions can contain private local paths. Keep them out of UI and logs.
    throw new ProductPhotoReadError('PHOTO_READ_FAILED');
  }
}
