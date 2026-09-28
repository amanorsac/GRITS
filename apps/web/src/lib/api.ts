import { sb } from './supabase';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Calls the Worker as the signed-in user. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await sb().auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`);
  return json;
}
