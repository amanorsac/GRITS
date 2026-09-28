import type { AgeBand, ValueKey } from './types';

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function valueLabel(v: ValueKey | null | undefined): string {
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** "IN 40 MINUTES", "IN 3 HOURS", "NOW". */
export function untilLabel(iso: string, now = Date.now()): string {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'NOW';
  if (mins < 60) return `IN ${mins} ${mins === 1 ? 'MINUTE' : 'MINUTES'}`;
  const h = Math.round(mins / 60);
  return `IN ${h} ${h === 1 ? 'HOUR' : 'HOURS'}`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dayAndTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${clockTime(iso)}`;
}

/** "Unlocks Fri" within a week, "Unlocks 3 Nov" beyond. */
export function unlockLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const days = (d.getTime() - now) / 86400000;
  if (days < 7) return `Unlocks ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
  return `Unlocks ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export function isFuture(iso: string | null | undefined, now = Date.now()): boolean {
  return !!iso && new Date(iso).getTime() > now;
}

/**
 * The Court is read-only 21:00–06:00 Africa/Accra. Accra is GMT all year (UTC+0, no DST),
 * so UTC hours are Accra hours.
 */
export function isQuietHours(date = new Date()): boolean {
  const h = date.getUTCHours();
  return h >= 21 || h < 6;
}

export function monthName(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long' });
}

/** The G.I.R.L.S. values, each with the Academy's one-line meaning. */
export const VALUE_LINE: Record<ValueKey, string> = {
  gracefulness: 'She carries strength with softness',
  integrity: 'She does what is right — even when it costs',
  resilience: 'She falls, she feels, she rises',
  leadership: 'She does not wait for permission',
  spirituality: 'She is rooted — in God, in truth, in purpose',
};

export function valueLine(v: ValueKey | null | undefined): string {
  return v ? VALUE_LINE[v] : '';
}

/** "Ages 8–12". Handles the current bands and the older ones still on some rows. */
export function ageBandLabel(band: AgeBand | string | null | undefined): string {
  if (!band) return '';
  if (band === '18+') return 'Ages 18+';
  const [from, to] = band.split('-');
  return from && to ? `Ages ${from}–${to}` : band;
}

/** Chat time: "14:05" today, "Mon" this week, "3 Oct" beyond. */
export function threadTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return clockTime(iso);
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Day separator in a chat: "Today", "Yesterday", "Monday 3 October". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
