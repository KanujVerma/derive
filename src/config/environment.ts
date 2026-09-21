export interface PublicEnvironmentInput {
  buildFlavor?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  legacySupabaseAnonKey?: string;
  useRemoteService?: string;
}

export type BuildFlavor = 'development' | 'remote-staging' | 'production';

export interface PublicEnvironment {
  buildFlavor: BuildFlavor;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseKeySource: 'publishable' | 'legacy_anon' | 'missing';
  useRemoteService: boolean;
}

export interface StagingBuildDiagnostics {
  buildFlavor: 'Remote Staging';
  serviceMode: 'Remote' | 'Mock';
  backendHost: string;
  backendConfigurationShape: 'Valid' | 'Invalid';
}

/** Safe bundle identity for staging QA; never returns a key or session value. */
export function getBuildDiagnostics(environment: PublicEnvironment): StagingBuildDiagnostics | null {
  if (environment.buildFlavor !== 'remote-staging') return null;
  const backendHost = environment.supabaseUrl ? new URL(environment.supabaseUrl).host : 'Not configured';
  return {
    buildFlavor: 'Remote Staging',
    serviceMode: environment.useRemoteService ? 'Remote' : 'Mock',
    backendHost,
    backendConfigurationShape: environment.useRemoteService && environment.supabaseKeySource === 'publishable' && backendHost !== 'Not configured'
      ? 'Valid' : 'Invalid',
  };
}

function parseBuildFlavor(value: string | undefined): BuildFlavor {
  const flavor = clean(value) || 'development';
  if (flavor === 'development' || flavor === 'remote-staging' || flavor === 'production') return flavor;
  throw new Error('Invalid build flavor: EXPO_PUBLIC_BUILD_FLAVOR must be development, remote-staging, or production.');
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

  if (publishableKey && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
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
  const buildFlavor = parseBuildFlavor(input.buildFlavor);
  const supabaseUrl = clean(input.supabaseUrl);
  const publishableKey = clean(input.supabasePublishableKey);
  const legacyAnonKey = clean(input.legacySupabaseAnonKey);
  const useRemoteService = parseBooleanFlag(
    'EXPO_PUBLIC_USE_REMOTE_SERVICE',
    input.useRemoteService,
  );

  validateSupabaseUrl(supabaseUrl);
  validateSupabaseKeys(publishableKey, legacyAnonKey);

  if (buildFlavor === 'remote-staging') {
    if (!useRemoteService) throw new Error('remote-staging requires Remote mode.');
    if (!supabaseUrl) throw new Error('remote-staging requires EXPO_PUBLIC_SUPABASE_URL.');
    if (!publishableKey) throw new Error('remote-staging requires an EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY publishable key.');
    if (!/^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/.test(publishableKey)) {
      throw new Error('remote-staging requires a correctly shaped Supabase publishable key.');
    }
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('remote-staging requires a hosted HTTPS Supabase URL.');
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(url.hostname) || url.port !== '') {
      throw new Error('remote-staging requires a hosted Supabase host.');
    }
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('remote-staging requires the hosted Supabase base URL without a path, query, or credentials.');
    }
  }

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
    buildFlavor,
    supabaseUrl,
    supabasePublishableKey,
    supabaseKeySource,
    useRemoteService,
  });
}

export const publicEnvironment = resolvePublicEnvironment({
  buildFlavor: process.env.EXPO_PUBLIC_BUILD_FLAVOR,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  legacySupabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  useRemoteService: process.env.EXPO_PUBLIC_USE_REMOTE_SERVICE,
});

export interface PublicLegalLinks {
  privacyUrl: string;
  supportUrl: string;
  privacyChoicesUrl: string;
}

/** Public pages for the external beta. Not secrets, so they are not new EXPO_PUBLIC variables. */
export const PUBLIC_BETA_LINKS: PublicLegalLinks = Object.freeze({
  privacyUrl: 'https://derive-beta-site.vercel.app/privacy',
  supportUrl: 'https://derive-beta-site.vercel.app/support',
  privacyChoicesUrl: 'https://derive-beta-site.vercel.app/privacy-choices',
});

function validatePublicHttpsUrl(name: string, value: string, required: boolean): string {
  const cleaned = value.trim();
  if (!cleaned) {
    if (required) throw new Error(`${name} is required for remote-staging.`);
    return '';
  }
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  return url.toString();
}

/** Remote staging fails closed without public Privacy and Support pages. */
export function resolvePublicLegalLinks(
  buildFlavor: BuildFlavor,
  links: PublicLegalLinks = PUBLIC_BETA_LINKS,
): PublicLegalLinks {
  const required = buildFlavor === 'remote-staging';
  return Object.freeze({
    privacyUrl: validatePublicHttpsUrl('privacy URL', links.privacyUrl, required),
    supportUrl: validatePublicHttpsUrl('support URL', links.supportUrl, required),
    privacyChoicesUrl: validatePublicHttpsUrl('privacy choices URL', links.privacyChoicesUrl, false),
  });
}

export const publicLegalLinks = resolvePublicLegalLinks(publicEnvironment.buildFlavor);
