import type { FreeAccessState } from '../contracts/FreeAccess.ts';

const FREE_TABS = new Set(['check', 'my-stuff', 'plan', 'shop']);
const MANAGED_ROUTES = new Set(['(tabs)', 'profile', 'orders', 'insights', 'shop', 'check-in', 'refill', '(onboarding)']);

/** Route visibility is a client projection of the server access state. */
export function resolveLocalAccessRoute(
  segments: readonly string[], access: FreeAccessState,
): '/(tabs)/check' | '/(tabs)/plan' | null {
  const landing = access.managedAccess ? '/(tabs)/plan' : '/(tabs)/check';
  const root = segments[0];
  if (!root || root === 'index') return landing;
  if (access.managedAccess) return MANAGED_ROUTES.has(root) ? null : landing;
  if (root === 'profile') return null;
  if (root === 'shop' && segments[1] === 'scan') return null;
  if (root === '(tabs)' && FREE_TABS.has(segments[1] ?? '')) return null;
  return landing;
}
