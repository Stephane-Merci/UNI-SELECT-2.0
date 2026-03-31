import { create } from 'zustand';
import apiClient from '../api/client';
import { Manager } from '../types';

interface AuthState {
  token: string | null;
  user: Manager | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  checkAuth: () => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    const user = userJson ? JSON.parse(userJson) : null;
    set({ token, user, isAuthenticated: !!token });
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      
      const { token, manager } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(manager));
      
      set({ 
        token, 
        user: manager, 
        isAuthenticated: true, 
        loading: false, 
        error: null 
      });
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.error || 
        error.message || 
        'Erreur de connexion. Vérifiez vos identifiants ou la connexion au serveur.';
      set({ 
        error: errorMessage, 
        loading: false, 
        isAuthenticated: false,
        token: null,
        user: null
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },
}));
