import { API_URL } from './env';
import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean };

/** Calls the grits Worker. Errors come back as `{ error }` with a 4xx/5xx status. */
export async function api<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('We could not reach the Academy. Check your connection and try again.', 0);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body.
  }
  if (!res.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `Something went wrong (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return json as T;
}

// ── Worker endpoints (docs/API.md) ──────────────────────────────────────────
export type PostKind = 'general' | 'win' | 'prayer' | 'books' | 'scripture';

export const joinWithCode = (body: { code: string; username: string; password: string; display_name: string }) =>
  api<{ ok: true; email: string }>('/api/join', { method: 'POST', body, auth: false });

export const createPost = (body: { space_id: string; kind: PostKind; body: string }) =>
  api<{ id: string; status: 'approved' | 'pending'; reason?: string }>('/api/posts', { method: 'POST', body });

export const createReply = (body: { post_id: string; body: string }) =>
  api<{ id: string; status: 'approved' | 'pending' }>('/api/replies', { method: 'POST', body });

export const lessonPlayback = (lessonId: string, saver: boolean) =>
  api<{ embed_url: string | null; expires_at?: string }>(
    `/api/lessons/${encodeURIComponent(lessonId)}/play?saver=${saver ? 1 : 0}`,
  );

export const joinLive = (sessionId: string, audioOnly: boolean) =>
  api<{ provider: 'jaas' | 'youtube'; url: string }>(`/api/live/${encodeURIComponent(sessionId)}/join`, {
    method: 'POST',
    body: { audio_only: audioOnly },
  });

export const sendHelp = (body: string) => api<{ ok: true }>('/api/help', { method: 'POST', body: { body } });
