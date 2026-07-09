'use client';

/** Sessão via Context (só tema/sessão usam Context — ARCHITECTURE §6). */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthSession, SafeUser } from '@finances/shared';
import { api, getToken, setToken } from './api-client';

interface SessionContextValue {
  user: SafeUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getToken() === null) {
      setLoading(false);
      return;
    }
    api<SafeUser>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api<AuthSession>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const session = await api<AuthSession>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) throw new Error('useSession fora do SessionProvider');
  return context;
}

/** Redireciona para /login quando não autenticado (guarda de página). */
export function useRequireSession(): SessionContextValue {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!session.loading && session.user === null) router.replace('/login');
  }, [session.loading, session.user, router]);
  return session;
}
