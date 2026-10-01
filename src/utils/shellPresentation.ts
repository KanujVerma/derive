import type { BuildFlavor } from '../config/environment.ts';
import { publicEnvironment } from '../config/environment.ts';
import { isApprovedDevelopmentLanBackend } from '../config/localDevelopmentBackend.ts';
import type { ShopAudience } from '../commerce/types.ts';

/** Client presentation only. This is not an access or membership decision. */
export type ShellPresentation = 'legacy' | 'scanner_first_preview' | 'local_free_integration' | 'hosted_free_integration';
export function isFreeIntegrationShell(shell: ShellPresentation): boolean {
  return shell === 'local_free_integration' || shell === 'hosted_free_integration';
}
export type FutureShellAudience = 'free' | 'managed';

export const TARGET_ROOT_TABS = ['check', 'my-stuff', 'plan', 'shop'] as const;
export const LEGACY_ROOT_TABS = ['index', 'plan', 'shop', 'ask', 'progress'] as const;

export function resolveShellPresentation(input: {
  buildFlavor: BuildFlavor;
  remoteEnabled: boolean;
  supabaseUrl?: string;
  developmentLanUrl?: string;
  developmentRuntime?: boolean;
  scannerReleaseEnabled?: boolean;
  /** Development-only hosted testing; never an entitlement or public activation. */
  privateUpcTestEnabled?: boolean;
}): ShellPresentation {
  if ((input.scannerReleaseEnabled ?? publicEnvironment.scannerReleaseEnabled) === true
    && input.buildFlavor === 'production' && input.remoteEnabled
    && input.supabaseUrl === 'https://snojlbqovlawewwqbviz.supabase.co') return 'hosted_free_integration';
  if (input.buildFlavor !== 'development') return 'legacy';
  if (!input.remoteEnabled) return 'scanner_first_preview';
  if ((input.developmentRuntime ?? (typeof __DEV__ !== 'undefined' && __DEV__)) === true
    && (input.privateUpcTestEnabled ?? publicEnvironment.privateUpcTestEnabled) === true
    && input.supabaseUrl === 'https://snojlbqovlawewwqbviz.supabase.co') return 'hosted_free_integration';
  if (isApprovedDevelopmentLanBackend({
    supabaseUrl: input.supabaseUrl ?? '',
    developmentLanUrl: input.developmentLanUrl ?? publicEnvironment.developmentSupabaseLanUrl,
    buildFlavor: input.buildFlavor,
    developmentRuntime: input.developmentRuntime ?? (typeof __DEV__ !== 'undefined' && __DEV__),
  })) return 'local_free_integration';
  try {
    const url = new URL(input.supabaseUrl ?? '');
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && (url.protocol === 'http:' || url.protocol === 'https:')
      && !url.username && !url.password) return 'local_free_integration';
  } catch { /* A missing or malformed URL never enables guest Auth. */ }
  return 'legacy';
}

/** The later free-access integration replaces the preview activation, not the tab structure. */
export function resolveShellLanding(
  presentation: ShellPresentation,
  audience: FutureShellAudience,
): '/(tabs)' | '/(tabs)/check' | '/(tabs)/plan' {
  if (presentation === 'legacy') return '/(tabs)';
  return audience === 'free' ? '/(tabs)/check' : '/(tabs)/plan';
}

/** Prevent the development Mock member fixture from appearing as a free-preview member. */
export function resolveShellShopAudience(
  presentation: ShellPresentation,
  audience: ShopAudience,
): ShopAudience {
  return presentation === 'scanner_first_preview' ? 'non_member' : audience;
}
