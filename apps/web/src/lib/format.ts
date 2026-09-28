export function ghs(pesewas: number | null | undefined) {
  if (pesewas == null) return 'GHS [PRICE]';
  return `GHS ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Accra' });
  if (d.toDateString() === today.toDateString()) return `Tonight ${time}`.replace('Tonight', d.getHours() < 17 ? 'Today' : 'Tonight');
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Accra' })} · ${time}`;
}

export function unlockLabel(iso: string) {
  const d = new Date(iso);
  const days = (d.getTime() - Date.now()) / 86_400_000;
  if (days < 7) return `Unlocks ${d.toLocaleDateString('en-GB', { weekday: 'short' })}`;
  return `Unlocks ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '·';
}

export function isQuietHours(now = new Date()) {
  const h = now.getUTCHours(); // Accra is GMT
  return h >= 21 || h < 6;
}

/** Pro-rata price — keep in sync with apps/web/worker/lib.ts → priceFor(). */
export function priceFor(p: { price_pesewas: number | null; pro_rata?: boolean; cohort_start?: string | null; cohort_end?: string | null }, now = new Date()) {
  if (p.price_pesewas == null) return null;
  if (!p.pro_rata || !p.cohort_end) return p.price_pesewas;
  const end = new Date(p.cohort_end + 'T00:00:00Z');
  const start = p.cohort_start ? new Date(p.cohort_start + 'T00:00:00Z') : null;
  const from = start && now < start ? start : now;
  const months = (end.getUTCFullYear() - from.getUTCFullYear()) * 12 + (end.getUTCMonth() - from.getUTCMonth()) + 1;
  return Math.round((p.price_pesewas * Math.min(12, Math.max(1, months))) / 12);
}

/** Months left in a pro-rata cohort, counting this one. */
export function monthsLeft(cohortEnd: string | null, now = new Date()) {
  if (!cohortEnd) return 12;
  const end = new Date(cohortEnd + 'T00:00:00Z');
  return Math.min(12, Math.max(1, (end.getUTCFullYear() - now.getUTCFullYear()) * 12 + (end.getUTCMonth() - now.getUTCMonth()) + 1));
}
