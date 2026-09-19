'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, getToken, setToken, removeToken, getUser, setUser, removeUser } from '@/lib/api';
import type { User } from '@radiolive/shared';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const savedUser = getUser();
    if (token && savedUser) {
      setUserState(savedUser);
      api('/api/auth/me', { token })
        .then((res) => {
          setUserState(res.data);
          setUser(res.data);
        })
        .catch(() => {
          removeToken();
          removeUser();
          setUserState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(res.data.token);
    setUser(res.data.user);
    setUserState(res.data.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await api('/api/auth/register', { method: 'POST', body: { username, email, password } });
    setToken(res.data.token);
    setUser(res.data.user);
    setUserState(res.data.user);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    removeUser();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
