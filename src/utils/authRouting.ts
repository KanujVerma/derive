export type AuthRouteType =
  | 'MOCK_TABS'
  | 'MOCK_ONBOARDING'
  | 'AUTH_LOADING'
  | 'AUTH_LOGIN'
  | 'REMOTE_HOLDING'
  | 'REMOTE_ONBOARDING'
  | 'REMOTE_TABS';

export interface AuthRouteDestination {
  type: AuthRouteType;
  route: '/(tabs)' | '/(onboarding)/1-welcome' | '/(auth)/login' | '/holding' | null;
}

export type ProfileResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVING'
  | 'NEEDS_ONBOARDING'
  | 'READY'
  | 'ERROR';

export interface ResolveRouteOptions {
  remoteEnabled: boolean;
  authStatus: 'INITIALIZING' | 'SIGNED_OUT' | 'SIGNED_IN';
  isOnboardingCompleted?: boolean;
  profileResolution?: ProfileResolutionStatus;
}

/**
 * Pure production routing decision helper.
 * 
 * Rules:
 * 1. In Mock Mode (remoteEnabled === false):
 *    Authentication is completely bypassed. The app routes based on local onboarding completion:
 *    - isOnboardingCompleted === true  -> /(tabs)
 *    - isOnboardingCompleted === false -> /(onboarding)/1-welcome
 * 
 * 2. In Remote Mode (remoteEnabled === true):
 *    - authStatus === 'INITIALIZING' -> AUTH_LOADING (null route / show loading canvas)
 *    - authStatus === 'SIGNED_OUT'   -> /(auth)/login
 *    - authStatus === 'SIGNED_IN'    ->
 *        - profileResolution === 'NEEDS_ONBOARDING' -> REMOTE_ONBOARDING (/(onboarding)/1-welcome)
 *        - profileResolution === 'READY'            -> REMOTE_TABS (/(tabs))
 *        - UNRESOLVED, RESOLVING, or ERROR          -> REMOTE_HOLDING (/holding)
 *    CRITICAL: Remote signed-in state MUST NOT inspect local isOnboardingCompleted!
 *    Canonical onboarding and membership status belong strictly to canonical remote bootstrap resolution (I1-A2).
 */
export function resolveAuthRoute(options: ResolveRouteOptions): AuthRouteDestination {
  const {
    remoteEnabled,
    authStatus,
    isOnboardingCompleted = false,
    profileResolution = 'UNRESOLVED',
  } = options;

  if (!remoteEnabled) {
    return isOnboardingCompleted
      ? { type: 'MOCK_TABS', route: '/(tabs)' }
      : { type: 'MOCK_ONBOARDING', route: '/(onboarding)/1-welcome' };
  }

  if (authStatus === 'INITIALIZING') {
    return { type: 'AUTH_LOADING', route: null };
  }

  if (authStatus === 'SIGNED_OUT') {
    return { type: 'AUTH_LOGIN', route: '/(auth)/login' };
  }

  // authStatus === 'SIGNED_IN' in Remote Mode
  if (profileResolution === 'NEEDS_ONBOARDING') {
    return { type: 'REMOTE_ONBOARDING', route: '/(onboarding)/1-welcome' };
  }

  if (profileResolution === 'READY') {
    return { type: 'REMOTE_TABS', route: '/(tabs)' };
  }

  // UNRESOLVED, RESOLVING, or ERROR: route to /holding
  return { type: 'REMOTE_HOLDING', route: '/holding' };
}

/**
 * Evaluates whether the current navigation route satisfies the resolved auth destination.
 * Returns the redirection route string if a redirect is required, or null if the current
 * route already satisfies the destination (avoiding redirect loops).
 *
 * Current route can be specified as a segments array (e.g. from useSegments()) or a pathname string.
 */
export function getAuthRedirectRoute(
  currentRoute: string[] | string,
  destination: AuthRouteDestination
): string | null {
  if (!destination.route) {
    return null;
  }

  const segment0 = Array.isArray(currentRoute)
    ? currentRoute.length > 0 ? currentRoute[0] : ''
    : currentRoute.replace(/^\//, '').split('/')[0];

  if (destination.type === 'AUTH_LOGIN') {
    // In Remote mode when signed out:
    // Any route outside the (auth) group must redirect to /(auth)/login.
    // If already inside (auth), return null to avoid redirect loops.
    const inAuthGroup = segment0 === '(auth)';
    return inAuthGroup ? null : destination.route;
  }

  if (destination.type === 'REMOTE_HOLDING') {
    // In Remote mode when signed in and profile resolution is unresolved/resolving/error:
    // All routes other than /holding must redirect to /holding.
    // If already on holding, return null to avoid redirect loops.
    const onHolding = segment0 === 'holding';
    return onHolding ? null : destination.route;
  }

  if (destination.type === 'REMOTE_ONBOARDING') {
    // In Remote mode when signed in and profile resolution is NEEDS_ONBOARDING:
    // Any route outside the (onboarding) group must redirect to /(onboarding)/1-welcome.
    // If already inside (onboarding), return null to avoid redirect loops while navigating onboarding.
    const inOnboarding = segment0 === '(onboarding)';
    return inOnboarding ? null : destination.route;
  }

  if (destination.type === 'REMOTE_TABS') {
    // In Remote mode when signed in and profile resolution is READY:
    // User is an active member. They should not be on holding or auth or onboarding.
    // If currently on holding or (auth) or (onboarding) or root, redirect to /(tabs).
    // If already on (tabs) or standard member screens (profile, orders, check-in, refill, founder, insights), return null.
    const onHoldingOrAuthOrOnboardingOrRoot =
      segment0 === '' || segment0 === 'holding' || segment0 === '(auth)' || segment0 === '(onboarding)';
    return onHoldingOrAuthOrOnboardingOrRoot ? destination.route : null;
  }

  return null;
}
