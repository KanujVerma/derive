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
  resolutionAttempt: number;

  // Actions
  setResolving: (userId: string) => number;
  setResolved: (state: CustomerBootstrapState, attempt?: number) => boolean;
  setError: (message: string, attempt?: number) => boolean;
  resetBootstrap: () => void;
}

export const useBootstrapStore = create<BootstrapState>((set, get) => ({
  status: 'UNRESOLVED',
  bootstrapState: null,
  errorMessage: null,
  resolvedUserId: null,
  resolutionAttempt: 0,

  setResolving: (userId: string) => {
    const nextAttempt = get().resolutionAttempt + 1;
    set({
      status: 'RESOLVING',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: userId,
      resolutionAttempt: nextAttempt,
    });
    return nextAttempt;
  },

  setResolved: (state: CustomerBootstrapState, attempt?: number) => {
    if (attempt !== undefined && attempt !== get().resolutionAttempt) {
      return false;
    }
    let status: ProfileResolutionStatus = 'ERROR';
    if (!state.profileExists) {
      status = 'ERROR';
    } else if (!state.onboardingCompleted) {
      status = 'NEEDS_ONBOARDING';
    } else {
      status = 'READY';
    }
    set({
      status,
      bootstrapState: state,
      errorMessage: null,
      resolvedUserId: state.userId,
    });
    return true;
  },

  setError: (message: string, attempt?: number) => {
    if (attempt !== undefined && attempt !== get().resolutionAttempt) {
      return false;
    }
    set({
      status: 'ERROR',
      errorMessage: message,
    });
    return true;
  },

  resetBootstrap: () =>
    set((state) => ({
      status: 'UNRESOLVED',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: null,
      resolutionAttempt: state.resolutionAttempt + 1,
    })),
}));
