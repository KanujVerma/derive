import { create } from 'zustand';
import type { CustomerBootstrapState } from '../domain/types.ts';

export type ProfileResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVING'
  | 'NEEDS_ONBOARDING'
  | 'READY'
  | 'ERROR';

export interface BootstrapState {
  status: ProfileResolutionStatus;
  bootstrapState: CustomerBootstrapState | null;
  errorMessage: string | null;
  resolvedUserId: string | null;

  // Actions
  setResolving: (userId: string) => void;
  setResolved: (state: CustomerBootstrapState) => void;
  setError: (message: string) => void;
  resetBootstrap: () => void;
}

export const useBootstrapStore = create<BootstrapState>((set) => ({
  status: 'UNRESOLVED',
  bootstrapState: null,
  errorMessage: null,
  resolvedUserId: null,

  setResolving: (userId: string) =>
    set({
      status: 'RESOLVING',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: userId,
    }),

  setResolved: (state: CustomerBootstrapState) => {
    let status: ProfileResolutionStatus = 'ERROR';
    if (!state.profileExists) {
      status = 'ERROR';
    } else if (!state.onboardingCompleted) {
      status = 'NEEDS_ONBOARDING';
    } else {
      status = 'READY';
    }
    return set({
      status,
      bootstrapState: state,
      errorMessage: null,
      resolvedUserId: state.userId,
    });
  },

  setError: (message: string) =>
    set({
      status: 'ERROR',
      errorMessage: message,
    }),

  resetBootstrap: () =>
    set({
      status: 'UNRESOLVED',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: null,
    }),
}));
