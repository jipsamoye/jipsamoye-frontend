'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { hasSessionHint, clearSessionHint } from '@/lib/auth';
import { User } from '@/types/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAsGuest: () => Promise<User | null>;
  logout: () => Promise<void>;
  withdraw: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSessionHint();
      setUser(null);
    });

    if (!hasSessionHint()) {
      // 힌트 쿠키 없음 → 비로그인 확정. 마운트 직후 1회 실행이라 cascade 없음.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    api.get<User>('/api/auth/me', { silent: true })
      .then((res) => setUser(res.data))
      .catch(() => {
        clearSessionHint();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loginAsGuest = useCallback(async () => {
    try {
      const res = await api.post<User>('/api/auth/guest');
      setUser(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const withdraw = useCallback(async () => {
    try { await api.delete('/api/auth/withdraw'); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginAsGuest, logout, withdraw, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
