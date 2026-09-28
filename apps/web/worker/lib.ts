import { createClient } from '@supabase/supabase-js';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv, Env, Profile, Role } from './env';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function adminClient(env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, 'Server is not configured (SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(env: Env, token: string) {
  if (!env.SUPABASE_ANON_KEY) throw new HttpError(503, 'Server is not configured (SUPABASE_ANON_KEY)');
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Verifies the Supabase JWT and loads the caller's profile. */
export function requireUser(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Sign in first');
    const admin = adminClient(c.env);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Your session has expired — sign in again');
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, full_name, display_name, email, circle_id, timed_out_until')
      .eq('id', data.user.id)
      .single<Profile>();
    if (!profile) throw new HttpError(403, 'No profile for this account');
    if (roles.length && !roles.includes(profile.role)) throw new HttpError(403, 'Not allowed');
    c.set('admin', admin);
    c.set('user', data.user);
    c.set('profile', profile);
    c.set('asUser', userClient(c.env, token));
    await next();
  };
}

export async function body<T>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, 'Expected a JSON body');
  }
}

export function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

export async function hmacSha512Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Codes a parent can read out over the phone: no 0/O, 1/I. */
export function joinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `QUEEN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Ghana is GMT all year, so Accra time is UTC. */
export function isQuietHours(now = new Date()) {
  const h = now.getUTCHours();
  return h >= 21 || h < 6;
}

export async function sendEmail(env: Env, to: string | string[], subject: string, html: string) {
  if (!env.RESEND_API_KEY) {
    console.log('[email skipped — RESEND_API_KEY not set]', subject);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) console.error('Resend failed', res.status, await res.text());
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

type Priced = { price_pesewas: number | null; pro_rata?: boolean; cohort_start?: string | null; cohort_end?: string | null };

/**
 * "Join at any time": the annual price is scaled by the months left in the cohort,
 * counting the current month. Keep in sync with apps/web/src/lib/format.ts → priceFor().
 */
export function priceFor(p: Priced, now = new Date()): number | null {
  if (p.price_pesewas == null) return null;
  if (!p.pro_rata || !p.cohort_end) return p.price_pesewas;
  const end = new Date(p.cohort_end + 'T00:00:00Z');
  const start = p.cohort_start ? new Date(p.cohort_start + 'T00:00:00Z') : null;
  const from = start && now < start ? start : now;
  const months = (end.getUTCFullYear() - from.getUTCFullYear()) * 12 + (end.getUTCMonth() - from.getUTCMonth()) + 1;
  const remaining = Math.min(12, Math.max(1, months));
  return Math.round((p.price_pesewas * remaining) / 12);
}
