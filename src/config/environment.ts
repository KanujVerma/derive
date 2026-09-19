export interface PublicEnvironmentInput {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  legacySupabaseAnonKey?: string;
  useRemoteService?: string;
}

export interface PublicEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseKeySource: 'publishable' | 'legacy_anon' | 'missing';
  useRemoteService: boolean;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function parseBooleanFlag(name: string, value: string | undefined): boolean {
  const normalized = clean(value).toLowerCase();

  if (normalized === '' || normalized === 'false') return false;
  if (normalized === 'true') return true;

  throw new Error(`${name} must be either "true" or "false".`);
}

function validateSupabaseUrl(value: string): void {
  if (!value) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a valid absolute URL.');
  }

  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost)) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must use HTTPS, except for a local Supabase URL.',
    );
  }
}

function validateSupabaseKeys(publishableKey: string, legacyAnonKey: string): void {
  if (publishableKey.startsWith('sb_secret_') || legacyAnonKey.startsWith('sb_secret_')) {
    throw new Error('Supabase secret keys must never be embedded in the Expo client.');
  }

  if (publishableKey && !publishableKey.startsWith('sb_publishable_')) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.',
    );
  }

  if (legacyAnonKey) {
    try {
      const payloadSegment = legacyAnonKey.split('.')[1];
      if (payloadSegment) {
        const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const payload = JSON.parse(atob(padded)) as { role?: unknown };
        if (payload.role === 'service_role') {
          throw new Error('Supabase service-role keys must never be embedded in the Expo client.');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('service-role')) throw error;
      // Opaque legacy anon keys remain supported during the naming transition.
    }
  }
}

export function resolvePublicEnvironment(
  input: PublicEnvironmentInput,
): PublicEnvironment {
  const supabaseUrl = clean(input.supabaseUrl);
  const publishableKey = clean(input.supabasePublishableKey);
  const legacyAnonKey = clean(input.legacySupabaseAnonKey);
  const useRemoteService = parseBooleanFlag(
    'EXPO_PUBLIC_USE_REMOTE_SERVICE',
    input.useRemoteService,
  );

  validateSupabaseUrl(supabaseUrl);
  validateSupabaseKeys(publishableKey, legacyAnonKey);

  const supabasePublishableKey = publishableKey || legacyAnonKey;
  const supabaseKeySource = publishableKey
    ? 'publishable'
    : legacyAnonKey
      ? 'legacy_anon'
      : 'missing';

  if (useRemoteService && (!supabaseUrl || !supabasePublishableKey)) {
    throw new Error(
      'Remote mode requires EXPO_PUBLIC_SUPABASE_URL and '
        + 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return Object.freeze({
    supabaseUrl,
    supabasePublishableKey,
    supabaseKeySource,
    useRemoteService,
  });
}

export const publicEnvironment = resolvePublicEnvironment({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  legacySupabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  useRemoteService: process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE,
});
