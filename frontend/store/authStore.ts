import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

// Auth tokens are never held here (or anywhere in JS) — the backend sets
// them as httpOnly cookies on login/refresh, so this store only tracks who
// is logged in for UI gating (withAuth), not how the requests authenticate.
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
