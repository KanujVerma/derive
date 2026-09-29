import { MANAGED_WAITLIST_OFFER_VERSION, MANAGED_WAITLIST_PRICE_CENTS } from '../presentation/managed-waitlist/offer.ts';
import {
  createMemoryWaitlistStore,
  type WaitlistRecord,
  type WaitlistStore,
} from '../presentation/managed-waitlist/store.ts';
import { supabase } from './supabase.ts';

function parseRecord(value: unknown): WaitlistRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid waitlist');
  }
  const status = Reflect.get(value, 'status');
  if (status === 'none') return { status: 'none' };
  if (status !== 'joined' && status !== 'withdrawn') throw new Error('invalid waitlist');
  const joinedAt = Reflect.get(value, 'joinedAt');
  const offerVersion = Reflect.get(value, 'offerVersion');
  if (typeof joinedAt !== 'string' || typeof offerVersion !== 'string') throw new Error('invalid waitlist');
  return { status, joinedAt, offerVersion };
}

async function signedIn(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

async function rpc(name: 'read_managed_waitlist' | 'withdraw_managed_waitlist'): Promise<WaitlistRecord> {
  if (!supabase) throw new Error('waitlist unavailable');
  const { data, error } = await supabase.rpc(name);
  if (error) throw error;
  return parseRecord(data);
}

/** Canonical owner comes from the session. A signed-out preview stays on a local store. */
export function createLiveWaitlistStore(): WaitlistStore {
  const memory = createMemoryWaitlistStore();
  return {
    async read(ownerKey) {
      if (!(await signedIn())) return memory.read(ownerKey);
      return rpc('read_managed_waitlist');
    },
    async join(ownerKey) {
      if (!(await signedIn())) return memory.join(ownerKey);
      if (!supabase) throw new Error('waitlist unavailable');
      const { data, error } = await supabase.rpc('join_managed_waitlist', {
        p_offer_version: MANAGED_WAITLIST_OFFER_VERSION,
        p_price_cents: MANAGED_WAITLIST_PRICE_CENTS,
        p_entry_surface: 'plan',
      });
      if (error) throw error;
      return parseRecord(data);
    },
    async withdraw(ownerKey) {
      if (!(await signedIn())) return memory.withdraw(ownerKey);
      return rpc('withdraw_managed_waitlist');
    },
  };
}
