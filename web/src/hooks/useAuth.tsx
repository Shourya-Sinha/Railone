import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

interface MeResponse { user: User; unreadNotifications: number }
interface AuthCtx {
  user: User | null;
  unread: number;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
export const ME_KEY = ['me'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<MeResponse>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
    retry: 1,
  });

  /**
   * After sign-in/registration: drop any cached data from a previous session, then load the
   * new user into the *existing* ['me'] entry so the mounted observer is notified.
   * (qc.clear() would orphan that observer and leave the UI thinking we are signed out.)
   */
  const resetForSession = useCallback(async () => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
    qc.setQueryData(ME_KEY, await api<MeResponse>('/auth/me'));
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: User }>('/auth/login', { body: { email, password } });
    await resetForSession();
    return r.user;
  }, [resetForSession]);

  const register = useCallback(async (data: { name: string; email: string; phone?: string; password: string }) => {
    const r = await api<{ user: User }>('/auth/register', { body: data });
    await resetForSession();
    return r.user;
  }, [resetForSession]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    // Keep the ['me'] cache entry (AuthProvider observes it) and drop everything else.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
    qc.setQueryData(ME_KEY, null);
  }, [qc]);

  const value: AuthCtx = {
    user: me.data?.user ?? null,
    unread: me.data?.unreadNotifications ?? 0,
    loading: me.isPending,
    login,
    register,
    logout,
    refresh: () => void qc.invalidateQueries({ queryKey: ME_KEY }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
