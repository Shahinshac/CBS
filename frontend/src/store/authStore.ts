import { create } from 'zustand';
import { authAPI } from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_first_login: boolean;
  first_name: string;
  last_name: string;
  branch_id?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: any) => Promise<{ success: boolean; message?: string; role?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authAPI.login(credentials);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      set({ user: data.user, isAuthenticated: true, loading: false });
      return {
        success: true,
        message: 'Login successful!',
        role: data.user?.role || 'customer'
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      set({ error: errorMessage, loading: false });
      return { success: false, message: errorMessage };
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  checkAuth: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const { data } = await authAPI.getMe();
      set({ user: data, isAuthenticated: true });
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        set({ isAuthenticated: false, user: null });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
  },
}));
