// EXPO_PUBLIC_* values are inlined at build time, so they must be read with static property access.
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://grits.amanorsac.workers.dev')
  .trim()
  .replace(/\/+$/, '');

/** False when the build is missing its Supabase settings; the app then shows a "not configured" screen. */
export const isConfigured = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

/** Girls sign in with a username; the auth email is derived from it. */
export const MEMBER_EMAIL_DOMAIN = 'members.gritandgrace.app';

export function loginToEmail(login: string): string {
  const value = login.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${MEMBER_EMAIL_DOMAIN}`;
}
