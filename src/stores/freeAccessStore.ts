import { create } from 'zustand';
import type { FreeAccessState } from '../contracts/FreeAccess.ts';

type Status = 'UNRESOLVED' | 'RESOLVING' | 'READY' | 'ERROR';

interface FreeAccessProjection {
  status: Status;
  userId: string | null;
  access: FreeAccessState | null;
  attempt: number;
  start: (userId: string) => number;
  ready: (access: FreeAccessState, attempt: number) => boolean;
  fail: (userId: string, attempt: number) => boolean;
  reset: () => void;
}

export const useFreeAccessStore = create<FreeAccessProjection>((set, get) => ({
  status: 'UNRESOLVED', userId: null, access: null, attempt: 0,
  start: (userId) => {
    const state = get();
    if (state.userId === userId && (state.status === 'READY' || state.status === 'RESOLVING')) return state.attempt;
    const attempt = state.attempt + 1;
    set({ status: 'RESOLVING', userId, access: null, attempt });
    return attempt;
  },
  ready: (access, attempt) => {
    const state = get();
    if (state.attempt !== attempt || state.userId !== access.userId || state.status !== 'RESOLVING') return false;
    set({ status: 'READY', access });
    return true;
  },
  fail: (userId, attempt) => {
    const state = get();
    if (state.attempt !== attempt || state.userId !== userId) return false;
    set({ status: 'ERROR', access: null });
    return true;
  },
  reset: () => set((state) => ({ status: 'UNRESOLVED', userId: null, access: null, attempt: state.attempt + 1 })),
}));
