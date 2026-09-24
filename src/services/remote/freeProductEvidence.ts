import type { FreeProductEvidenceUpload, PrepareFreeProductEvidenceInput } from '../../contracts/FreeProductEvidence.ts';
import { supabase } from '../supabase.ts';

type PhotoClient = {
  functions: { invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }> };
  storage: { from: (bucket: string) => { upload: (path: string, data: ArrayBuffer, options: {
    contentType: string; upsert: false;
  }) => Promise<{ error: unknown }> } };
};

export async function prepareFreeProductEvidence(input: PrepareFreeProductEvidenceInput,
  client: PhotoClient | null = supabase as PhotoClient | null): Promise<FreeProductEvidenceUpload> {
  if (!client) throw new Error('Supabase client is not configured');
  const { data, error } = await client.functions.invoke('prepare-free-product-evidence', { body: input });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Photo upload is unavailable');
  const target = data as FreeProductEvidenceUpload;
  if (target.bucket !== 'customer-product-evidence' || typeof target.storagePath !== 'string'
    || target.role !== input.role || target.mimeType !== input.mimeType || target.maxBytes !== 10 * 1024 * 1024) {
    throw new Error('Invalid photo upload target');
  }
  return target;
}

/** Upload decoded image bytes; native callers may use their existing URI-to-ArrayBuffer reader. */
export async function uploadFreeProductEvidence(target: FreeProductEvidenceUpload, bytes: ArrayBuffer,
  client: PhotoClient | null = supabase as PhotoClient | null): Promise<void> {
  if (!client) throw new Error('Supabase client is not configured');
  if (bytes.byteLength === 0 || bytes.byteLength > target.maxBytes) throw new Error('Photo exceeds upload limit');
  const { error } = await client.storage.from(target.bucket).upload(target.storagePath, bytes, {
    contentType: target.mimeType, upsert: false,
  });
  if (error) throw new Error('Photo upload failed');
}
