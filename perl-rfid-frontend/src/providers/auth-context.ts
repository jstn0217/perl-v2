import { createContext, useContext } from 'react';
import type { SessionUser } from '../lib/api';

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface AuthContextValue {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  login: (values: LoginFormValues) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
};
