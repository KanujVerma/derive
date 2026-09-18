import { supabase } from './supabase.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { useUserStore } from '../stores/userStore.ts';
import { resetCustomerSessionData } from './sessionReset.ts';
import { getCustomerErrorMessage } from '../utils/customerErrors.ts';

export interface AuthSessionUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: AuthSessionUser;
  access_token?: string;
  refresh_token?: string;
}

export interface SignOutOptions {
  scope?: 'global' | 'local' | 'others';
}

export interface VerifyOtpResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export interface AuthAdapter {
  signInWithOtp(email: string): Promise<{ data: any; error: any }>;
  verifyOtp(email: string, token: string): Promise<{ data: { session: any; user: any }; error: any }>;
  getSession(): Promise<{ data: { session: any }; error: any }>;
  signOut(options?: SignOutOptions): Promise<{ error: any }>;
  onAuthStateChange(callback: (event: string, session: any) => void): {
    data: { subscription: { unsubscribe: () => void } };
  };
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export function isValidOtpToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  return /^\d{6}$/.test(trimmed);
}

const defaultSupabaseAdapter: AuthAdapter = {
  async signInWithOtp(email: string) {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not configured') };
    }
    return supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
  },

  async verifyOtp(email: string, token: string) {
    if (!supabase) {
      return { data: { session: null, user: null }, error: new Error('Supabase client not configured') };
    }
    return supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
  },

  async getSession() {
    if (!supabase) {
      return { data: { session: null }, error: null };
    }
    return supabase.auth.getSession();
  },

  async signOut(options: SignOutOptions = { scope: 'local' }) {
    if (!supabase) {
      return { error: null };
    }
    return supabase.auth.signOut(options);
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!supabase) {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    }
    return supabase.auth.onAuthStateChange(callback);
  },
};

let activeAdapter: AuthAdapter = defaultSupabaseAdapter;

export function setAuthAdapter(adapter: AuthAdapter): void {
  activeAdapter = adapter;
}

export function resetAuthAdapter(): void {
  activeAdapter = defaultSupabaseAdapter;
}

/**
 * Sends a 6-digit access code to the specified email address.
 * Validates format client-side and maps any backend failures to customer-safe copy.
 */
export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_email'),
    };
  }

  try {
    const { error } = await activeAdapter.signInWithOtp(normalizedEmail);
    if (error) {
      console.warn('sendEmailOtp backend error:', error.name || 'send_failed');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_send_code'),
      };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('sendEmailOtp exception:', err?.name || 'unknown_error');
    return {
      success: false,
      error: getCustomerErrorMessage('auth_send_code'),
    };
  }
}

/**
 * Verifies a 6-digit email OTP token.
 * On success, updates the auth store session and sets the user store identity projection.
 * Minimizes return surface: does NOT leak access or refresh tokens to caller UI.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<VerifyOtpResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedToken = (token || '').trim();

  if (!isValidEmail(normalizedEmail) || !isValidOtpToken(normalizedToken)) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_otp'),
    };
  }

  try {
    const { data, error } = await activeAdapter.verifyOtp(normalizedEmail, normalizedToken);
    if (error || !data?.user) {
      console.warn('verifyEmailOtp backend error:', error?.name || 'verification_failed');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_invalid_otp'),
      };
    }

    const userId = data.user.id;
    const sessionEmail = data.user.email || normalizedEmail;

    // If changing authenticated customer, purge previous customer caches first
    const currentUserId = useAuthStore.getState().sessionUserId;
    if (currentUserId && currentUserId !== userId) {
      resetCustomerSessionData();
    }

    // Project established identity into client stores
    useAuthStore.getState().setSession(userId, sessionEmail);
    useUserStore.getState().setRemoteSessionUser(userId, sessionEmail);

    return {
      success: true,
      userId,
    };
  } catch (err: any) {
    console.warn('verifyEmailOtp exception:', err?.name || 'unknown_error');
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_otp'),
    };
  }
}

/**
 * Retrieves the current session from the auth provider and synchronizes the client stores.
 * When no session is found, purges any residual customer caches.
 */
export async function getCurrentSession(): Promise<{ userId: string | null; email: string | null }> {
  try {
    const { data, error } = await activeAdapter.getSession();
    if (error || !data?.session?.user) {
      resetCustomerSessionData();
      return { userId: null, email: null };
    }

    const user = data.session.user;
    const userId = user.id;
    const email = user.email || null;

    const currentUserId = useAuthStore.getState().sessionUserId;
    if (currentUserId && currentUserId !== userId) {
      resetCustomerSessionData();
    }

    useAuthStore.getState().setSession(userId, email);
    useUserStore.getState().setRemoteSessionUser(userId, email || '');

    return { userId, email };
  } catch (err: any) {
    console.warn('getCurrentSession exception:', err?.name || 'unknown_error');
    resetCustomerSessionData();
    return { userId: null, email: null };
  }
}

/**
 * Signs out the active customer session on this device (scope: local).
 * Only purges state and claims success when provider sign-out succeeds or session is confirmed gone.
 */
export async function signOutSession(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await activeAdapter.signOut({ scope: 'local' });
    if (error) {
      // Check if session remains active in provider
      const { data: sessionData } = await activeAdapter.getSession();
      if (sessionData?.session?.user) {
        console.warn('signOut failed: session remains active');
        return {
          success: false,
          error: getCustomerErrorMessage('auth_signout'),
        };
      }
    }

    // Session successfully terminated or confirmed absent
    resetCustomerSessionData();
    return { success: true };
  } catch (err: any) {
    try {
      const { data: sessionData } = await activeAdapter.getSession();
      if (sessionData?.session?.user) {
        console.warn('signOut exception: session remains active');
        return {
          success: false,
          error: getCustomerErrorMessage('auth_signout'),
        };
      }
    } catch {}

    resetCustomerSessionData();
    return { success: true };
  }
}

/**
 * Subscribes to auth state changes from the active provider.
 * Automatically synchronizes store projections on session transitions.
 * Purges prior customer caches when switching authenticated user UUIDs (A -> B),
 * while preserving valid user caches across same-user token refreshes (A -> A).
 */
export function subscribeToAuth(
  callback?: (event: string, session: any) => void
): { unsubscribe: () => void } {
  const { data } = activeAdapter.onAuthStateChange((event, session) => {
    if (session?.user) {
      const user = session.user;
      const currentUserId = useAuthStore.getState().sessionUserId;

      if (currentUserId && currentUserId !== user.id) {
        resetCustomerSessionData();
      }

      useAuthStore.getState().setSession(user.id, user.email || null);
      useUserStore.getState().setRemoteSessionUser(user.id, user.email || '');
    } else if (event === 'SIGNED_OUT' || !session) {
      resetCustomerSessionData();
    }

    if (callback) {
      callback(event, session);
    }
  });

  return {
    unsubscribe: () => {
      data.subscription.unsubscribe();
    },
  };
}

