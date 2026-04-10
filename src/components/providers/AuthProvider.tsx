'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginAsGuest: () => Promise<User | null>;
  logout: () => Promise<void>;
  withdraw: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      api.get<User>(`/api/auth/me?userId=${userId}`)
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('userId');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    try {
      const res = await api.post<User>('/api/auth/guest');
      setUser(res.data);
      localStorage.setItem('userId', String(res.data.id));
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('userId');
    setUser(null);
  }, []);

  const withdraw = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try { await api.delete(`/api/auth/withdraw?userId=${userId}`); } catch { /* ignore */ }
    localStorage.removeItem('userId');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginAsGuest, logout, withdraw }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
