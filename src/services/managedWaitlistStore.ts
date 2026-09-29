import { MANAGED_WAITLIST_OFFER_VERSION, MANAGED_WAITLIST_PRICE_CENTS } from '../presentation/managed-waitlist/offer.ts';
import { createCanonicalWaitlistStore } from '../presentation/managed-waitlist/canonical.ts';
import type { WaitlistStore } from '../presentation/managed-waitlist/store.ts';
import { supabase } from './supabase.ts';

/** Live Plan path. No session means no joined state and no RPC. */
export function createLiveWaitlistStore(): WaitlistStore {
  return createCanonicalWaitlistStore({
    async getSession() {
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      return userId ? { userId } : null;
    },
    async read() {
      if (!supabase) throw new Error('waitlist unavailable');
      const { data, error } = await supabase.rpc('read_managed_waitlist');
      if (error) throw error;
      return data;
    },
    async join() {
      if (!supabase) throw new Error('waitlist unavailable');
      const { data, error } = await supabase.rpc('join_managed_waitlist', {
        p_offer_version: MANAGED_WAITLIST_OFFER_VERSION,
        p_price_cents: MANAGED_WAITLIST_PRICE_CENTS,
        p_entry_surface: 'plan',
      });
      if (error) throw error;
      return data;
    },
    async withdraw() {
      if (!supabase) throw new Error('waitlist unavailable');
      const { data, error } = await supabase.rpc('withdraw_managed_waitlist');
      if (error) throw error;
      return data;
    },
  });
}
