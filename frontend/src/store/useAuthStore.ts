import { create } from 'zustand';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  checkAuth: () => {
    const token = localStorage.getItem('token');
    set({ token, isAuthenticated: !!token });
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      
      const token = response.data.token;
      localStorage.setItem('token', token);
      set({ token, isAuthenticated: true, loading: false, error: null });
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.error || 
        error.message || 
        'Erreur de connexion. Vérifiez vos identifiants ou la connexion au serveur.';
      set({ 
        error: errorMessage, 
        loading: false, 
        isAuthenticated: false,
        token: null 
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, isAuthenticated: false, error: null });
  },
}));
