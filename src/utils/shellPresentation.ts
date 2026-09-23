import type { BuildFlavor } from '../config/environment.ts';
import type { ShopAudience } from '../commerce/types.ts';

/** Client presentation only. This is not an access or membership decision. */
export type ShellPresentation = 'legacy' | 'scanner_first_preview';
export type FutureShellAudience = 'free' | 'managed';

export const TARGET_ROOT_TABS = ['check', 'my-stuff', 'plan', 'shop'] as const;
export const LEGACY_ROOT_TABS = ['index', 'plan', 'shop', 'ask', 'progress'] as const;

export function resolveShellPresentation(input: {
  buildFlavor: BuildFlavor;
  remoteEnabled: boolean;
}): ShellPresentation {
  return input.buildFlavor === 'development' && !input.remoteEnabled
    ? 'scanner_first_preview'
    : 'legacy';
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
