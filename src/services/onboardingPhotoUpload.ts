import { supabase } from './supabase.ts';

const PHOTO_BUCKET = 'customer-skin-photos';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

type PhotoPlatform = 'ios' | 'android' | 'web';
type NativePhotoFile = {
  exists: boolean;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type PhotoReadOptions = {
  /** Used by focused tests; Expo sets EXPO_OS at bundle time in the app. */
  platform?: PhotoPlatform;
  nativeFileFactory?: (uri: string) => NativePhotoFile;
  fetchPhoto?: (uri: string) => Promise<{ ok: boolean; blob(): Promise<Blob> }>;
};

type PhotoUploadErrorCode = 'PHOTO_READ_FAILED' | 'PHOTO_EMPTY' | 'PHOTO_TOO_LARGE' | 'PHOTO_MIME_UNSUPPORTED' | 'PHOTO_STORAGE_FAILED';

export class PhotoUploadError extends Error {
  readonly code: PhotoUploadErrorCode;

  constructor(code: PhotoUploadErrorCode) {
    super(code);
    this.name = 'PhotoUploadError';
    this.code = code;
  }
}

function photoPlatform(): PhotoPlatform {
  // babel-preset-expo inlines EXPO_OS for native and web bundles.
  // The web branch is also usable by the repository's Node test harness.
  return process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android'
    ? process.env.EXPO_OS
    : 'web';
}

function mimeFromUri(uri: string): string | null {
  const cleanUri = uri.split(/[?#]/, 1)[0].toLowerCase();
  if (/\.(jpe?g)$/.test(cleanUri) || cleanUri.startsWith('data:image/jpeg')) return 'image/jpeg';
  if (/\.png$/.test(cleanUri) || cleanUri.startsWith('data:image/png')) return 'image/png';
  if (/\.webp$/.test(cleanUri) || cleanUri.startsWith('data:image/webp')) return 'image/webp';
  if (/\.heic$/.test(cleanUri) || cleanUri.startsWith('data:image/heic')) return 'image/heic';
  if (/\.heif$/.test(cleanUri) || cleanUri.startsWith('data:image/heif')) return 'image/heif';
  return null;
}

function resolveMimeType(reportedType: string | undefined, uri: string): string {
  const normalized = reportedType?.trim().toLowerCase().split(';', 1)[0] ?? '';
  const type = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
  if (SUPPORTED_MIME_TYPES.has(type)) return type;
  // A missing or generic file type is common for device cache files. Use the
  // captured file extension only then; never override a specific MIME claim.
  if (!type || type === 'application/octet-stream') {
    const inferred = mimeFromUri(uri);
    if (inferred) return inferred;
  }
  throw new PhotoUploadError('PHOTO_MIME_UNSUPPORTED');
}

function validateSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new PhotoUploadError('PHOTO_EMPTY');
  if (size > MAX_PHOTO_BYTES) throw new PhotoUploadError('PHOTO_TOO_LARGE');
}

async function readNativePhoto(uri: string, options: PhotoReadOptions): Promise<{ body: ArrayBuffer; contentType: string }> {
  let file: NativePhotoFile;
  try {
    if (options.nativeFileFactory) {
      file = options.nativeFileFactory(uri);
    } else {
      const { File } = await import('expo-file-system');
      file = new File(uri);
    }
    if (!file.exists) throw new PhotoUploadError('PHOTO_READ_FAILED');
    validateSize(file.size);
    const contentType = resolveMimeType(file.type, uri);
    const body = await file.arrayBuffer();
    if (!(body instanceof ArrayBuffer)) throw new PhotoUploadError('PHOTO_READ_FAILED');
    validateSize(body.byteLength);
    return { body, contentType };
  } catch (error) {
    if (error instanceof PhotoUploadError) throw error;
    // Do not propagate native URI, file contents, or lower-level exception text.
    throw new PhotoUploadError('PHOTO_READ_FAILED');
  }
}

async function readWebPhoto(uri: string, options: PhotoReadOptions): Promise<{ body: Blob; contentType: string }> {
  try {
    const response = await (options.fetchPhoto ?? fetch)(uri);
    if (!response.ok) throw new PhotoUploadError('PHOTO_READ_FAILED');
    const body = await response.blob();
    // Browser Blob.size is always a number. Older test doubles omit it.
    if (typeof body.size === 'number') validateSize(body.size);
    return { body, contentType: resolveMimeType(body.type, uri) };
  } catch (error) {
    if (error instanceof PhotoUploadError) throw error;
    throw new PhotoUploadError('PHOTO_READ_FAILED');
  }
}

/** Upload a local image to a server-issued private Storage path without overwriting it. */
export async function uploadPhotoToStorage(
  storagePath: string,
  localUri: string,
  client?: any,
  options: PhotoReadOptions = {},
): Promise<void> {
  const sbClient = client || supabase;
  if (!sbClient || !storagePath) throw new PhotoUploadError('PHOTO_STORAGE_FAILED');

  const platform = options.platform ?? photoPlatform();
  const { body, contentType } = platform === 'web'
    ? await readWebPhoto(localUri, options)
    : await readNativePhoto(localUri, options);

  try {
    const { error } = await sbClient.storage.from(PHOTO_BUCKET).upload(storagePath, body, {
      contentType,
      upsert: false,
    });
    if (error) throw new PhotoUploadError('PHOTO_STORAGE_FAILED');
  } catch {
    // Keep authenticated path and Storage error details out of customer logs.
    throw new PhotoUploadError('PHOTO_STORAGE_FAILED');
  }
}
