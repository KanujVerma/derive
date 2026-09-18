import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Start Supabase auth auto-refresh (e.g. when app transitions to active foreground).
 */
export function startAuthAutoRefresh(): void {
  if (supabase) {
    supabase.auth.startAutoRefresh();
  }
}

/**
 * Stop Supabase auth auto-refresh (e.g. when app transitions to background).
 */
export function stopAuthAutoRefresh(): void {
  if (supabase) {
    supabase.auth.stopAutoRefresh();
  }
}

/**
 * Storage helper for private photo upload.
 * Strictly respects INSERT-only RLS policy on customer-skin-photos bucket (upsert: false).
 */
export async function uploadPrivatePhoto(
  uri: string,
  bucket: string,
  path: string
): Promise<{ path: string; error: Error | null }> {
  if (!isSupabaseConfigured || !supabase) {
    // In mock mode, return the local file URI directly
    return { path: uri, error: null };
  }

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
      upsert: false,
    });
    if (error) throw error;
    return { path: data.path, error: null };
  } catch (err: any) {
    console.error('Photo upload failed:', err);
    return { path: uri, error: err };
  }
}
