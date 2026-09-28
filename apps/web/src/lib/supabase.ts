import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Keys are served by the Worker at runtime (/api/config) so there is one place to set them.
// VITE_* env vars still win when present (local dev without the Worker).
let client: SupabaseClient | null = null;
let configError: string | null = null;

export async function initSupabase(): Promise<SupabaseClient | null> {
  if (client) return client;
  let url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  let key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = (await res.json()) as { supabaseUrl: string; supabaseAnonKey: string };
        url ||= cfg.supabaseUrl;
        key ||= cfg.supabaseAnonKey;
      }
    } catch {
      /* offline or no Worker — handled below */
    }
  }
  if (!url || !key) {
    configError = 'The platform is not fully configured yet (Supabase anon key missing).';
    return null;
  }
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

export function sb(): SupabaseClient {
  if (!client) throw new Error(configError ?? 'Supabase not initialised');
  return client;
}

export function supabaseConfigError() {
  return configError;
}

export const MEMBER_EMAIL_DOMAIN = 'members.gritandgrace.app';

/** A girl signs in with a username; parents and staff with an email. */
export function loginEmail(identifier: string) {
  const id = identifier.trim().toLowerCase();
  return id.includes('@') ? id : `${id}@${MEMBER_EMAIL_DOMAIN}`;
}
