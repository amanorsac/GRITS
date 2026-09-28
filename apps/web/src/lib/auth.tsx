import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb } from './supabase';
import type { Profile } from './types';

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await sb().from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    sb().auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = sb().auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: Supabase warns against awaiting queries inside this callback.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: AuthState = {
    loading,
    session,
    profile,
    refresh: () => loadProfile(session),
    signOut: async () => {
      await sb().auth.signOut();
      setProfile(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

export const STAFF = ['mentor', 'moderator', 'admin', 'owner'] as const;
export const isStaff = (p: Profile | null) => !!p && (STAFF as readonly string[]).includes(p.role);
export const isModerator = (p: Profile | null) => !!p && ['moderator', 'admin', 'owner'].includes(p.role);
export const isAdmin = (p: Profile | null) => !!p && ['admin', 'owner'].includes(p.role);

/** Where each role lands after signing in. */
export function homeFor(p: Profile | null) {
  if (!p) return '/login';
  if (p.role === 'parent') return '/gate';
  if (p.role === 'member') return '/app';
  return '/palace';
}
