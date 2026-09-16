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
  toggleFounderMode: () => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: 'usr_beta_001',
  email: 'arthur@derive.skin',
  fullName: 'Arthur Pendelton',
  membershipStatus: 'active',
  tier: 'Founding Beta ($129/mo)',
  isFounderMode: false,

  setUser: (userId, email, fullName = 'Beta Member') =>
    set({ userId, email, fullName, membershipStatus: 'active' }),

  toggleFounderMode: () =>
    set((state) => ({ isFounderMode: !state.isFounderMode })),

  logout: () =>
    set({
      userId: '',
      email: '',
      fullName: '',
      membershipStatus: 'none',
    }),
}));
