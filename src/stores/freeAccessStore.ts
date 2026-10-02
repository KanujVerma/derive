import { create } from 'zustand';
import type { FreeAccessState } from '../contracts/FreeAccess.ts';

type Status = 'UNRESOLVED' | 'RESOLVING' | 'READY' | 'ERROR';

interface FreeAccessProjection {
  status: Status;
  userId: string | null;
  access: FreeAccessState | null;
  attempt: number;
  isRefreshing: boolean;
  start: (userId: string) => number;
  refresh: (userId: string) => number | null;
  ready: (access: FreeAccessState, attempt: number) => boolean;
  fail: (userId: string, attempt: number) => boolean;
  reset: () => void;
}

export const useFreeAccessStore = create<FreeAccessProjection>((set, get) => ({
  status: 'UNRESOLVED', userId: null, access: null, attempt: 0, isRefreshing: false,
  start: (userId) => {
    const state = get();
    if (state.userId === userId && (state.status === 'READY' || state.status === 'RESOLVING')) return state.attempt;
    const attempt = state.attempt + 1;
    set({ status: 'RESOLVING', userId, access: null, attempt, isRefreshing: false });
    return attempt;
  },
  // Revalidate an already verified owner without presenting a false sign-out to the UI.
  // Remote operations still authenticate at the server; this never grants a new owner access.
  refresh: (userId) => {
    const state = get();
    if (!userId || state.status !== 'READY' || state.userId !== userId
      || state.access?.userId !== userId || state.isRefreshing) return null;
    const attempt = state.attempt + 1;
    set({ attempt, isRefreshing: true });
    return attempt;
  },
  ready: (access, attempt) => {
    const state = get();
    if (state.attempt !== attempt || state.userId !== access.userId
      || !(state.status === 'RESOLVING' || (state.status === 'READY' && state.isRefreshing))) return false;
    set({ status: 'READY', access, isRefreshing: false });
    return true;
  },
  fail: (userId, attempt) => {
    const state = get();
    if (state.attempt !== attempt || state.userId !== userId
      || !(state.status === 'RESOLVING' || (state.status === 'READY' && state.isRefreshing))) return false;
    set({ status: 'ERROR', access: null, isRefreshing: false });
    return true;
  },
  reset: () => set((state) => ({ status: 'UNRESOLVED', userId: null, access: null,
    attempt: state.attempt + 1, isRefreshing: false })),
}));
