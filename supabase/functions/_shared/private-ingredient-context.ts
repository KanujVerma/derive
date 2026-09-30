import {
  cosmeticContextFromFreeProfile, cosmeticContextFromPersonalProfile,
  type IngredientCosmeticContext,
} from '../../../src/domain/ingredient-context.ts';

interface ContextQuery {
  eq(column: string, value: string): ContextQuery;
  order(column: string, options: { ascending: boolean }): ContextQuery;
  limit(count: number): ContextQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}

/** Trusted server client only. Identity must come from the authenticated JWT. */
export interface PrivateIngredientContextAdmin {
  from(table: string): { select(columns: string): ContextQuery };
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function revision(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value;
  throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
}

async function version(context: IngredientCosmeticContext, source: string, anchor: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ source, anchor, context }));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Project only minimum cosmetic fields. Modern context takes precedence even
 * when every answer is unknown/withheld; DB failures never trigger fallback.
 * Raw rows, reproductive/treatment/history fields and owner IDs never escape.
 */
export async function loadPrivateIngredientContext(admin: PrivateIngredientContextAdmin, userId: string):
Promise<{ context: IngredientCosmeticContext; version: string } | null> {
  try {
    if (typeof userId !== 'string' || !userId.trim() || userId !== userId.trim()) {
      throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
    }
    const modern = await admin.from('personal_context_revisions').select('revision,payload')
      .eq('user_id', userId).eq('section', 'profile').order('revision', { ascending: false }).limit(1).maybeSingle();
    if (modern.error) throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
    if (modern.data !== null) {
      if (!record(modern.data)) throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
      const context = cosmeticContextFromPersonalProfile(modern.data.payload);
      if (!context) throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
      return { context, version: await version(context, 'personal_context_profile', revision(modern.data.revision)) };
    }
    const legacy = await admin.from('free_skin_profiles').select('goals,skin_behavior,reactivity,updated_at')
      .eq('user_id', userId).maybeSingle();
    if (legacy.error) throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
    if (legacy.data === null) return null;
    if (!record(legacy.data) || typeof legacy.data.updated_at !== 'string'
      || !legacy.data.updated_at || !Number.isFinite(Date.parse(legacy.data.updated_at))) {
      throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
    }
    const context = cosmeticContextFromFreeProfile({
      goals: legacy.data.goals, skinBehavior: legacy.data.skin_behavior, reactivity: legacy.data.reactivity,
    });
    if (!context) throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
    return { context, version: await version(context, 'free_skin_profile', legacy.data.updated_at) };
  } catch {
    // Do not attach provider/DB errors: they may contain sensitive row/query text.
    throw new Error('INGREDIENT_CONTEXT_UNAVAILABLE');
  }
}
