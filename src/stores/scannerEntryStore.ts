import { create } from 'zustand';
/** Session-only routing state; no answers, persistent tracking or entitlement. */
export const useScannerEntryStore = create<{
  ownerId: string | null; profileIntroHandled: boolean;
  setOwner(ownerId: string | null): void;
  markProfileIntroHandled(ownerId: string): void;
}>((set) => ({
  ownerId: null, profileIntroHandled: false,
  setOwner: ownerId => set(state => state.ownerId === ownerId ? state : { ownerId, profileIntroHandled: false }),
  markProfileIntroHandled: ownerId => set(state => state.ownerId === ownerId
    ? { profileIntroHandled: true } : state),
}));
