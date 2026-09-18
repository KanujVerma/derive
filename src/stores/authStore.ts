import { create } from 'zustand';

export type AuthStatus = 'INITIALIZING' | 'SIGNED_OUT' | 'SIGNED_IN';

export interface AuthState {
  status: AuthStatus;
  sessionUserId: string | null;
  sessionEmail: string | null;

  // Actions
  setSession: (userId: string | null, email: string | null) => void;
  setSignedOut: () => void;
  setInitializing: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'INITIALIZING',
  sessionUserId: null,
  sessionEmail: null,

  setSession: (userId: string | null, email: string | null) =>
    set({
      status: userId ? 'SIGNED_IN' : 'SIGNED_OUT',
      sessionUserId: userId,
      sessionEmail: email,
    }),

  setSignedOut: () =>
    set({
      status: 'SIGNED_OUT',
      sessionUserId: null,
      sessionEmail: null,
    }),

  setInitializing: () =>
    set({
      status: 'INITIALIZING',
      sessionUserId: null,
      sessionEmail: null,
    }),
}));
