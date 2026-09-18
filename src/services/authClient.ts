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

export interface AuthAdapter {
  signInWithOtp(email: string): Promise<{ data: any; error: any }>;
  verifyOtp(email: string, token: string): Promise<{ data: { session: any; user: any }; error: any }>;
  getSession(): Promise<{ data: { session: any }; error: any }>;
  signOut(): Promise<{ error: any }>;
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

  async signOut() {
    if (!supabase) {
      return { error: null };
    }
    return supabase.auth.signOut();
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
      console.warn('sendEmailOtp backend error:', error.message || error);
      return {
        success: false,
        error: getCustomerErrorMessage('auth_send_code'),
      };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('sendEmailOtp exception:', err.message || err);
    return {
      success: false,
      error: getCustomerErrorMessage('auth_send_code'),
    };
  }
}

/**
 * Verifies a 6-digit email OTP token.
 * On success, updates the auth store session and sets the user store identity projection.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ success: boolean; session?: any; error?: string }> {
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
      console.warn('verifyEmailOtp backend error:', error?.message || error);
      return {
        success: false,
        error: getCustomerErrorMessage('auth_invalid_otp'),
      };
    }

    const userId = data.user.id;
    const sessionEmail = data.user.email || normalizedEmail;

    // Project established identity into client stores
    useAuthStore.getState().setSession(userId, sessionEmail);
    useUserStore.getState().setRemoteSessionUser(userId, sessionEmail);

    return {
      success: true,
      session: data.session,
    };
  } catch (err: any) {
    console.warn('verifyEmailOtp exception:', err.message || err);
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_otp'),
    };
  }
}

/**
 * Retrieves the current session from the auth provider and synchronizes the client stores.
 */
export async function getCurrentSession(): Promise<{ userId: string | null; email: string | null }> {
  try {
    const { data, error } = await activeAdapter.getSession();
    if (error || !data?.session?.user) {
      useAuthStore.getState().setSignedOut();
      return { userId: null, email: null };
    }

    const user = data.session.user;
    const userId = user.id;
    const email = user.email || null;

    useAuthStore.getState().setSession(userId, email);
    useUserStore.getState().setRemoteSessionUser(userId, email || '');

    return { userId, email };
  } catch (err: any) {
    console.warn('getCurrentSession exception:', err.message || err);
    useAuthStore.getState().setSignedOut();
    return { userId: null, email: null };
  }
}

/**
 * Signs out the active customer session, purges client caches and stores via resetCustomerSessionData.
 */
export async function signOutSession(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await activeAdapter.signOut();
    if (error) {
      console.warn('signOut error:', error.message || error);
    }
  } catch (err: any) {
    console.warn('signOut exception:', err.message || err);
  } finally {
    // Always purge local customer data on sign-out request
    resetCustomerSessionData();
  }

  return { success: true };
}

/**
 * Subscribes to auth state changes from the active provider.
 * Automatically synchronizes store projections on session transitions.
 */
export function subscribeToAuth(
  callback?: (event: string, session: any) => void
): { unsubscribe: () => void } {
  const { data } = activeAdapter.onAuthStateChange((event, session) => {
    if (session?.user) {
      const user = session.user;
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
