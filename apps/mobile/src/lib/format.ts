import type { ValueKey } from './types';

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
