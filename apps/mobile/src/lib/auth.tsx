import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  /** True until the stored session has been read. */
  initialising: boolean;
  session: Session | null;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type Loaded = { userId: string; profile: Profile | null; error: string | null };

async function fetchProfile(userId: string): Promise<Loaded> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, display_name, username, crown_level, circle_id, data_saver, created_at')
    .eq('id', userId)
    .maybeSingle();
  return {
    userId,
    profile: (data as Profile | null) ?? null,
    error: error ? error.message : data ? null : 'We could not find your profile yet.',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialising, setInitialising] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  // The loaded profile is keyed by user id, so a different (or no) user never sees a stale one.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setInitialising(false);
      });
    // Keep this callback synchronous: Supabase warns against awaiting inside it.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchProfile(userId).then((r) => {
      if (!cancelled) setLoaded(r);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = loaded && loaded.userId === userId ? loaded : null;
  const profile = current?.profile ?? null;
  const profileError = current?.error ?? null;
  const profileLoading = !!userId && (!current || reloading);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setReloading(true);
    const r = await fetchProfile(userId);
    setLoaded(r);
    setReloading(false);
  }, [userId]);

  const setProfile = useCallback((p: Profile) => {
    setLoaded((l) => (l && l.userId === p.id ? { ...l, profile: p } : l));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ initialising, session, profile, profileLoading, profileError, refreshProfile, setProfile, signOut }),
    [initialising, session, profile, profileLoading, profileError, refreshProfile, setProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Used only for the render in which a signed-in screen is being torn down (e.g. right after sign-out).
const SIGNED_OUT: Profile = {
  id: '00000000-0000-0000-0000-000000000000',
  role: 'member',
  full_name: '',
  display_name: '',
  username: null,
  crown_level: 1,
  circle_id: null,
  data_saver: true,
  created_at: new Date(0).toISOString(),
};

/** For screens behind the auth guard, where a profile is present. Never throws. */
export function useMe(): Profile {
  const { profile } = useAuth();
  return profile ?? SIGNED_OUT;
}
