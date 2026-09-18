import { create } from 'zustand';

export interface UserState {
  userId: string;
  email: string;
  fullName: string;
  membershipStatus: 'active' | 'trial' | 'none';
  tier: string;
  isFounderMode: boolean;

  // Actions
  setUser: (userId: string, email: string, fullName?: string) => void;
  setRemoteSessionUser: (userId: string, email?: string) => void;
  toggleFounderMode: () => void;
  logout: () => void;
  loadArthurDemoUser: () => void;
  resetToDefault: () => void;
}

const DEFAULT_USER_STATE = {
  userId: 'usr_beta_member',
  email: 'member@derive.skin',
  fullName: 'Beta Member',
  membershipStatus: 'active' as const,
  tier: 'Founding Beta',
  isFounderMode: false,
};

const ARTHUR_DEMO_USER = {
  userId: 'usr_beta_001',
  email: 'arthur@derive.skin',
  fullName: 'Arthur Pendelton',
  membershipStatus: 'active' as const,
  tier: 'Founding Beta',
  isFounderMode: false,
};

export const useUserStore = create<UserState>((set) => ({
  ...DEFAULT_USER_STATE,

  setUser: (userId, email, fullName = 'Beta Member') =>
    set({ userId, email, fullName, membershipStatus: 'active' }),

  setRemoteSessionUser: (userId, email = '') =>
    set({
      userId,
      email,
      fullName: '',
      membershipStatus: 'none',
      tier: '',
      isFounderMode: false,
    }),

  toggleFounderMode: () =>
    set((state) => ({ isFounderMode: !state.isFounderMode })),

  logout: () =>
    set({
      userId: '',
      email: '',
      fullName: '',
      membershipStatus: 'none',
      tier: 'none',
      isFounderMode: false,
    }),

  loadArthurDemoUser: () => set({ ...ARTHUR_DEMO_USER }),

  resetToDefault: () => set({ ...DEFAULT_USER_STATE }),
}));
