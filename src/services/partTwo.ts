import { PART_ONE_ENABLED } from './partOne';
import { supabase } from './supabase';
import { createPartTwoTransport, createPartTwoSavedTransport } from './partTwoClient';
export const PART_TWO_ENABLED = PART_ONE_ENABLED && process.env.EXPO_PUBLIC_PART_TWO_ENABLED === 'true';
export async function invokePartTwo(path: string, body: string) {
  if (!PART_TWO_ENABLED || !supabase) throw new Error('Ingredient details unavailable');
  return supabase.functions.invoke(path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
}
export const partTwoTransport = createPartTwoTransport({ enabled: () => PART_TWO_ENABLED && Boolean(supabase), invoke: async (path, body) => {
  if (!supabase) throw new Error('Ingredient details unavailable');
  return supabase.functions.invoke(path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
} });
export function partTwoSavedTransport(saveId: string) {
  return createPartTwoSavedTransport(saveId, { enabled: () => PART_TWO_ENABLED && Boolean(supabase), invoke: async (path, body) => {
    if (!supabase) throw new Error('Ingredient details unavailable');
    return supabase.functions.invoke(path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  } });
}
