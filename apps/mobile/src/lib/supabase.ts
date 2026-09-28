import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { API_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Session storage in the device keychain / keystore. SecureStore values are limited to ~2 KB,
 * and a Supabase session is larger, so values are split into chunks.
 */
const CHUNK_SIZE = 1800;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count) {
      for (let i = 0; i < Number(count); i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    }
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

let client: SupabaseClient | null = null;

/**
 * Everything imports `supabase`; it forwards to the real client once `initSupabase` has run.
 * The root layout awaits that before rendering any screen that touches it.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!client) throw new Error('Supabase used before initSupabase()');
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * The anon key is public. A build may carry it (EXPO_PUBLIC_SUPABASE_ANON_KEY); otherwise the
 * app asks the Worker (/api/config), so setting the key once on the Worker configures web and app
 * without a rebuild. Returns false when neither source has it yet.
 */
export async function initSupabase(): Promise<boolean> {
  if (client) return true;
  let url = SUPABASE_URL;
  let key = SUPABASE_ANON_KEY;
  if (!url || key.length < 20) {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const cfg = (await res.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
        url = url || (cfg.supabaseUrl ?? '');
        key = key.length >= 20 ? key : (cfg.supabaseAnonKey ?? '');
      }
    } catch {
      // Offline or Worker unreachable — handled by the caller.
    }
  }
  if (!url.startsWith('https://') || key.length < 20) return false;
  client = createClient(url, key, {
    auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  // Only refresh tokens while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client?.auth.startAutoRefresh();
    else client?.auth.stopAutoRefresh();
  });
  return true;
}

/** Unwraps a Supabase result, throwing its error. */
export function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
