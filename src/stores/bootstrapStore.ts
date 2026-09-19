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
  isRefreshing: boolean;

  // Actions
  setResolving: (userId: string) => number;
  setRefreshing: (userId: string) => number;
  setResolved: (state: CustomerBootstrapState, attempt?: number) => boolean;
  setError: (message: string, attempt?: number) => boolean;
  setRefreshError: (message: string, attempt?: number) => boolean;
  resetBootstrap: () => void;
}

export const useBootstrapStore = create<BootstrapState>((set, get) => ({
  status: 'UNRESOLVED',
  bootstrapState: null,
  errorMessage: null,
  resolvedUserId: null,
  resolutionAttempt: 0,
  isRefreshing: false,

  setResolving: (userId: string) => {
    const nextAttempt = get().resolutionAttempt + 1;
    set({
      status: 'RESOLVING',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: userId,
      resolutionAttempt: nextAttempt,
      isRefreshing: false,
    });
    return nextAttempt;
  },

  setRefreshing: (userId: string) => {
    if (get().resolvedUserId !== userId || !get().bootstrapState) {
      return get().setResolving(userId);
    }
    const nextAttempt = get().resolutionAttempt + 1;
    set({ resolutionAttempt: nextAttempt, isRefreshing: true, errorMessage: null });
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
      isRefreshing: false,
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
      isRefreshing: false,
    });
    return true;
  },

  setRefreshError: (message: string, attempt?: number) => {
    if (attempt !== undefined && attempt !== get().resolutionAttempt) return false;
    if (get().bootstrapState?.membershipStatus === 'active') {
      set({ status: 'ERROR', errorMessage: message, isRefreshing: false });
    } else {
      set({ errorMessage: message, isRefreshing: false });
    }
    return true;
  },

  resetBootstrap: () =>
    set((state) => ({
      status: 'UNRESOLVED',
      bootstrapState: null,
      errorMessage: null,
      resolvedUserId: null,
      resolutionAttempt: state.resolutionAttempt + 1,
      isRefreshing: false,
    })),
}));
