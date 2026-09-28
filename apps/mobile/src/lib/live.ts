import { must, supabase } from './supabase';
import type { LiveSession } from './types';

export const LIVE_COLS =
  'id, title, kind, circle_id, host_name, starts_at, ends_at, youtube_id, is_live, recording_lesson_id, circle:circles(name)';

const HOUR = 3600_000;

/** Sessions that are live now or still to come, soonest first. */
export async function loadUpcoming(withinHours = 24 * 30): Promise<LiveSession[]> {
  const now = Date.now();
  const rows = must(
    await supabase
      .from('live_sessions')
      .select(LIVE_COLS)
      .gte('starts_at', new Date(now - 6 * HOUR).toISOString())
      .lte('starts_at', new Date(now + withinHours * HOUR).toISOString())
      .order('starts_at')
      .limit(40),
  ) as unknown as LiveSession[];
  return rows.filter((s) => liveState(s, now) !== 'ended');
}

export async function loadSession(id: string): Promise<LiveSession | null> {
  return must(await supabase.from('live_sessions').select(LIVE_COLS).eq('id', id).maybeSingle()) as unknown as LiveSession | null;
}

export type LiveState = 'live' | 'soon' | 'upcoming' | 'ended';

export function liveState(s: LiveSession, now = Date.now()): LiveState {
  const start = new Date(s.starts_at).getTime();
  const end = s.ends_at ? new Date(s.ends_at).getTime() : start + 2 * HOUR;
  if (s.is_live) return 'live';
  if (now > end) return 'ended';
  if (now >= start - 15 * 60_000) return 'soon';
  return 'upcoming';
}

export function sessionLabel(s: LiveSession): string {
  return s.circle?.name ? `${s.circle.name} · ${s.title}` : s.title;
}

export function hasStarted(s: LiveSession, now = Date.now()): boolean {
  return new Date(s.starts_at).getTime() <= now;
}
