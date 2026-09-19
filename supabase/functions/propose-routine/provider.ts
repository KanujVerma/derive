// Provider-Neutral Routine Intelligence Provider Factory & Registry
// Part of DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure

declare const Deno: any;

import type { RoutineIntelligenceProvider } from './types.ts';
import { FixtureRoutineProvider } from './fixture-provider.ts';
import { GeminiRoutineProvider } from './gemini-adapter.ts';

export type { RoutineIntelligenceProvider } from './types.ts';

/**
 * Resolves the configured server-side routine intelligence provider.
 * 
 * Rules:
 * 1. Provider selection is strictly server-side configuration.
 * 2. Client requests (headers, query parameters, bodies) can NEVER select a provider.
 * 3. If unconfigured or empty, returns null (fails closed with MODEL_UNAVAILABLE).
 * 4. Never defaults to any commercial provider while the architecture decision remains open.
 */
export async function resolveRoutineProvider(supabaseAdmin?: any): Promise<RoutineIntelligenceProvider | null> {
  let providerName = '';

  // 1. Check process environment (highest precedence in production)
  if (typeof Deno !== 'undefined') {
    providerName = (Deno.env.get('ROUTINE_MODEL_PROVIDER') || '').trim().toLowerCase();
  } else if (typeof process !== 'undefined') {
    providerName = (process.env.ROUTINE_MODEL_PROVIDER || '').trim().toLowerCase();
  }

  // 2. If unset in process env, check secure server runtime configuration in database
  if (!providerName && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('server_runtime_config')
        .select('value')
        .eq('key', 'routine_model_provider')
        .maybeSingle();
      if (data?.value) {
        providerName = data.value.trim().toLowerCase();
      }
    } catch (e: any) {
      console.error('[propose-routine] Error querying server_runtime_config:', e?.message || e);
    }
  }

  if (providerName === 'fixture') {
    return new FixtureRoutineProvider();
  }

  if (providerName === 'gemini') {
    return new GeminiRoutineProvider();
  }

  // Production provider selection remains OPEN / DEFERRED.
  // Return null when unconfigured so caller fails closed with MODEL_UNAVAILABLE.
  return null;
}
