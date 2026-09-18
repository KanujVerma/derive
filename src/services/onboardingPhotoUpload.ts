import { supabase } from './supabase.ts';

/**
 * Uploads a local photo to Supabase Storage at a server-issued path.
 * Enforces:
 * - Direct upload to 'customer-skin-photos'
 * - Server-issued opaque path
 * - upsert: false (immutable server-side upload)
 * - Auto-detects MIME type (image/jpeg, image/png, image/webp)
 * - Throws on failure; never persists or returns local URIs
 */
export async function uploadPhotoToStorage(
  storagePath: string,
  localUri: string,
  client?: any
): Promise<void> {
  const sbClient = client || supabase;
  if (!sbClient) {
    throw new Error('Supabase client is not configured for photo upload.');
  }

  let contentType = 'image/jpeg';
  const lower = localUri.toLowerCase();
  if (lower.endsWith('.png') || lower.startsWith('data:image/png')) {
    contentType = 'image/png';
  } else if (lower.endsWith('.webp') || lower.startsWith('data:image/webp')) {
    contentType = 'image/webp';
  }

  let uploadBody: any;

  if (typeof fetch === 'function') {
    const res = await fetch(localUri);
    if (!res.ok) {
      throw new Error(`Failed to read photo from local URI (${res.status} ${res.statusText})`);
    }
    const blob = await res.blob();
    if (blob.type) {
      contentType = blob.type;
    }
    uploadBody = blob;
  } else {
    throw new Error('Environment does not support fetch for photo upload.');
  }

  const { error } = await sbClient.storage
    .from('customer-skin-photos')
    .upload(storagePath, uploadBody, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed uploading photo to ${storagePath}: ${error.message}`);
  }
}
