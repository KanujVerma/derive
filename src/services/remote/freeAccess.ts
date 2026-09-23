import type { FreeAccessState } from '../../contracts/FreeAccess.ts';
import { supabase } from '../supabase.ts';

/** Invoke only after Supabase establishes a real Auth session. No membership row is created. */
export async function getFreeAccessState(client: any = supabase): Promise<FreeAccessState> {
  if (!client) throw new Error('Supabase client is not configured');
  const { data, error } = await client.functions.invoke('access-state', { body: {} });
  if (error || !data || typeof data.userId !== 'string'
    || !['anonymous', 'permanent'].includes(data.identityKind)
    || data.freeProductAccess !== true
    || !['active', 'paused', 'cancelled', 'none'].includes(data.managedMembershipStatus)
    || data.managedAccess !== (data.identityKind === 'permanent' && data.managedMembershipStatus === 'active')) {
    throw new Error('Free access state is unavailable');
  }
  return data as FreeAccessState;
}
