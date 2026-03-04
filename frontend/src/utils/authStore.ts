import { create } from 'zustand';
import { User, UserRole } from '../types';
import apiService from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  hasRole: (role: UserRole) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('authToken'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.login(email, password);
      localStorage.setItem('authUser', JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    apiService.logout();
    localStorage.removeItem('authUser');
    set({ user: null, token: null });
  },

  setUser: (user: User) => {
    localStorage.setItem('authUser', JSON.stringify(user));
    set({ user });
  },

  hasRole: (role: UserRole) => {
    const { user } = get();
    return user?.role === role;
  },
}));
