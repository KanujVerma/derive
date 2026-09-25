import type { FreeProductEvidenceUpload, PrepareFreeProductEvidenceInput } from '../../contracts/FreeProductEvidence.ts';
import { supabase } from '../supabase.ts';

type PhotoClient = {
  functions: { invoke: (name: string, options: { body: object }) => Promise<{ data: unknown; error: unknown }> };
  storage: { from: (bucket: string) => { upload: (path: string, data: ArrayBuffer, options: {
    contentType: string; upsert: false;
  }) => Promise<{ error: unknown }> } };
};

/** A server-enforced daily photo-grant limit, not a network or upload failure. */
export class FreeProductEvidenceDailyLimitError extends Error {
  readonly code = 'DAILY_LIMIT' as const;

  constructor() {
    super('Daily product-photo limit reached');
    this.name = 'FreeProductEvidenceDailyLimitError';
  }
}

async function isDailyLimit(error: unknown): Promise<boolean> {
  if (!error || typeof error !== 'object' || !('context' in error)) return false;
  const context = error.context;
  if (!context || typeof context !== 'object' || !('status' in context) || context.status !== 429) return false;
  try {
    const response = 'clone' in context && typeof context.clone === 'function' ? context.clone() : context;
    if (!response || typeof response !== 'object' || !('json' in response) || typeof response.json !== 'function') return false;
    const payload: unknown = await response.json();
    return !!payload && typeof payload === 'object' && 'code' in payload && payload.code === 'DAILY_LIMIT';
  } catch {
    return false;
  }
}

export async function prepareFreeProductEvidence(input: PrepareFreeProductEvidenceInput,
  client: PhotoClient | null = supabase as PhotoClient | null): Promise<FreeProductEvidenceUpload> {
  if (!client) throw new Error('Supabase client is not configured');
  const { data, error } = await client.functions.invoke('prepare-free-product-evidence', { body: input });
  if (await isDailyLimit(error)) throw new FreeProductEvidenceDailyLimitError();
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
