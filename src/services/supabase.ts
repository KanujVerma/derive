import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { publicEnvironment } from '../config/environment.ts';

const { supabaseUrl, supabasePublishableKey } = publicEnvironment;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
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
