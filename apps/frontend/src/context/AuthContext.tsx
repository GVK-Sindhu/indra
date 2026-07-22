import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ENGINEER' | 'MANAGER' | 'ADMIN';
  experienceLevel: 'SENIOR' | 'JUNIOR' | 'UNKNOWN';
  feedbackWeight: number;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerUser: (
    email: string,
    name: string,
    password: string,
    role: string,
    experienceLevel: string
  ) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Attempt to restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem('indra_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        setToken(savedToken);
        // Call auth/me endpoint to load profile
        const res = await api.get<{ user: UserProfile }>('/api/v1/auth/me');
        setUser(res.user);
      } catch (err: any) {
        console.warn('Failed to restore session:', err.message);
        // Clean up invalid session state
        localStorage.removeItem('indra_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: UserProfile }>('/api/v1/auth/login', {
        email,
        password,
      });

      localStorage.setItem('indra_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (
    email: string,
    name: string,
    password: string,
    role: string,
    experienceLevel: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: UserProfile }>('/api/v1/auth/register', {
        email,
        name,
        password,
        role,
        experienceLevel,
      });

      localStorage.setItem('indra_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('indra_token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    registerUser,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
