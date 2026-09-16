import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

/**
 * Storage helper for private photo upload
 */
export async function uploadPrivatePhoto(
  uri: string,
  bucket: string,
  path: string
): Promise<{ path: string; error: Error | null }> {
  if (!isSupabaseConfigured) {
    // In mock mode, return the local file URI directly
    return { path: uri, error: null };
  }

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
      upsert: true,
    });
    if (error) throw error;
    return { path: data.path, error: null };
  } catch (err: any) {
    console.error('Photo upload failed:', err);
    return { path: uri, error: err };
  }
}
