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

export interface PasswordAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export interface PasswordSignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthSignUpRequest {
  email: string;
  password: string;
  options?: { data?: Record<string, string> };
}

export interface AuthPasswordRequest {
  email: string;
  password: string;
}

export interface AuthAdapter {
  signInWithOtp(email: string): Promise<{ data: any; error: any }>;
  verifyOtp(email: string, token: string): Promise<{ data: { session: any; user: any }; error: any }>;
  signUp?(input: AuthSignUpRequest): Promise<{ data: { session: any; user: any }; error: any }>;
  signInWithPassword?(input: AuthPasswordRequest): Promise<{ data: { session: any; user: any }; error: any }>;
  signInAnonymously?(): Promise<{ data: { session: any; user: any }; error: any }>;
  getSession(): Promise<{ data: { session: any }; error: any }>;
  signOut(options?: SignOutOptions): Promise<{ error: any }>;
  onAuthStateChange(callback: (event: string, session: any) => void): {
    data: { subscription: { unsubscribe: () => void } };
  };
}

export const MAX_PERSON_NAME_LENGTH = 80;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

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

export function isValidPersonName(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_PERSON_NAME_LENGTH;
}

export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

export function composeFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`;
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

  async signUp(input) {
    if (!supabase) {
      return { data: { session: null, user: null }, error: new Error('Supabase client not configured') };
    }
    return supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: input.options,
    });
  },

  async signInWithPassword(input) {
    if (!supabase) {
      return { data: { session: null, user: null }, error: new Error('Supabase client not configured') };
    }
    return supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
  },

  async signInAnonymously() {
    if (!supabase) {
      return { data: { session: null, user: null }, error: new Error('Supabase client not configured') };
    }
    return supabase.auth.signInAnonymously();
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

function projectAuthenticatedSession(user: { id: string; email?: string | null }): string {
  const userId = user.id;
  const sessionEmail = user.email || null;
  const currentUserId = useAuthStore.getState().sessionUserId;
  if (currentUserId && currentUserId !== userId) {
    resetCustomerSessionData();
  }
  useAuthStore.getState().setSession(userId, sessionEmail);
  useUserStore.getState().setRemoteSessionUser(userId, sessionEmail || '');
  return userId;
}

let anonymousStart: Promise<string> | null = null;

/** Local-only caller: preserve the persisted session; create a guest only when none exists. */
export function ensureLocalAnonymousSession(): Promise<string> {
  if (anonymousStart) return anonymousStart;
  anonymousStart = (async () => {
    const existing = await activeAdapter.getSession();
    if (existing.error) throw new Error('Auth session could not be checked');
    if (existing.data?.session?.user?.id) return projectAuthenticatedSession(existing.data.session.user);
    if (!activeAdapter.signInAnonymously) throw new Error('Anonymous Auth is unavailable');
    const created = await activeAdapter.signInAnonymously();
    if (created.error || !created.data?.session?.user?.id || !created.data?.user?.id
      || created.data.session.user.id !== created.data.user.id) {
      throw new Error('Anonymous Auth could not be established');
    }
    return projectAuthenticatedSession(created.data.user);
  })().finally(() => { anonymousStart = null; });
  return anonymousStart;
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

    const userId = projectAuthenticatedSession({
      id: data.user.id,
      email: data.user.email || normalizedEmail,
    });

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

export async function createPasswordAccount(
  input: PasswordSignUpInput
): Promise<PasswordAuthResult> {
  const firstName = (input.firstName || '').trim();
  const lastName = (input.lastName || '').trim();
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  const password = input.password;

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_name'),
    };
  }

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_email'),
    };
  }

  if (!isValidPassword(password)) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_invalid_password'),
    };
  }

  const fullName = composeFullName(firstName, lastName);

  try {
    if (!activeAdapter.signUp) {
      console.warn('createPasswordAccount backend error: signup_unavailable');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_signup'),
      };
    }

    const { data, error } = await activeAdapter.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error || !data?.user) {
      console.warn('createPasswordAccount backend error:', error?.name || 'signup_failed');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_signup'),
      };
    }

    if (!data.session) {
      console.warn('createPasswordAccount backend error: missing_session');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_signup_unconfirmed'),
      };
    }

    const userId = projectAuthenticatedSession({
      id: data.user.id,
      email: data.user.email || normalizedEmail,
    });

    return {
      success: true,
      userId,
    };
  } catch (err: any) {
    console.warn('createPasswordAccount exception:', err?.name || 'unknown_error');
    return {
      success: false,
      error: getCustomerErrorMessage('auth_signup'),
    };
  }
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<PasswordAuthResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!isValidEmail(normalizedEmail) || typeof password !== 'string' || password.length === 0) {
    return {
      success: false,
      error: getCustomerErrorMessage('auth_password_signin'),
    };
  }

  try {
    if (!activeAdapter.signInWithPassword) {
      console.warn('signInWithPassword backend error: password_signin_unavailable');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_password_signin'),
      };
    }

    const { data, error } = await activeAdapter.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data?.user || !data.session) {
      console.warn('signInWithPassword backend error:', error?.name || 'signin_failed');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_password_signin'),
      };
    }

    const userId = projectAuthenticatedSession({
      id: data.user.id,
      email: data.user.email || normalizedEmail,
    });

    return {
      success: true,
      userId,
    };
  } catch (err: any) {
    console.warn('signInWithPassword exception:', err?.name || 'unknown_error');
    return {
      success: false,
      error: getCustomerErrorMessage('auth_password_signin'),
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
    const userId = projectAuthenticatedSession(user);
    const email = user.email || null;
    return { userId, email };
  } catch (err: any) {
    console.warn('getCurrentSession exception:', err?.name || 'unknown_error');
    resetCustomerSessionData();
    return { userId: null, email: null };
  }
}

/**
 * Signs out the active customer session on this device (scope: local).
 * Only purges state and claims success when provider sign-out succeeds
 * or session is confirmed absent through verification.
 * Fails closed on uncertainty (if verification fails, throws, or session remains active).
 */
export async function signOutSession(): Promise<{ success: boolean; error?: string }> {
  let signOutError: any = null;
  let signOutThrew = false;

  try {
    const result = await activeAdapter.signOut({ scope: 'local' });
    if (result && result.error) {
      signOutError = result.error;
    }
  } catch (err: any) {
    signOutThrew = true;
    signOutError = err;
  }

  // CASE A: signOut succeeded cleanly without error or exception
  if (!signOutError && !signOutThrew) {
    resetCustomerSessionData();
    return { success: true };
  }

  // When signOut errored or threw, verify provider session state.
  // We must fail closed on uncertainty (verification error/exception or active session).
  try {
    const { data: sessionData, error: getSessionError } = await activeAdapter.getSession();

    // CASE D / G: Verification returned an error -> state unknown -> fail closed
    if (getSessionError) {
      console.warn('signOut verification error:', getSessionError.name || 'lookup_failed');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_signout'),
      };
    }

    // CASE C / F: Session remains active in provider -> fail closed
    if (sessionData?.session?.user) {
      console.warn('signOut failed: session remains active in provider');
      return {
        success: false,
        error: getCustomerErrorMessage('auth_signout'),
      };
    }

    // CASE B / E: Verification succeeded and session is confirmed absent
    resetCustomerSessionData();
    return { success: true };
  } catch (verifyErr: any) {
    // CASE G: Verification threw an exception -> state unknown -> fail closed
    console.warn('signOut verification exception:', verifyErr?.name || 'unknown');
    return {
      success: false,
      error: getCustomerErrorMessage('auth_signout'),
    };
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
      projectAuthenticatedSession(session.user);
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
