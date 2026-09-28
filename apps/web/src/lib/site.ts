import { useSyncExternalStore } from 'react';
import {
  CONTACT,
  FAQ,
  FOUNDER,
  FOUNDRY,
  HOW_IT_WORKS,
  INNER_COURT,
  MISSION,
  PILLARS,
  SCRIPTURE,
  SYLLABUS,
  TAGLINES,
  VALUES,
  VISION,
} from '../content/academy';
import { sb } from './supabase';
import type { AcademyEvent, Program } from './types';

// The public site's words and pictures. academy.ts holds the defaults; whatever the Academy
// saves in The Palace (site_settings, one JSON document per key) is laid over the top.

export type WithCover = { cover_url?: string | null };
export type SiteProgram = Program & WithCover;
export type SiteEvent = AcademyEvent & WithCover & { is_published?: boolean };

export type Article = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  author: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GalleryItem = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  caption: string;
  category: string;
  position: number;
  created_at: string;
};

export const GALLERY_CATEGORIES = ['Summits & Events', 'Mentoring', 'The Inner Court', 'Father & Daughter'] as const;

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const DEFAULTS = {
  announcement_bar: { enabled: false, text: '', linkLabel: '', link: '' },
  hero: {
    eyebrow: 'Welcome home',
    line1: 'We don’t just raise girls.',
    line2: 'We raise',
    emphasis: 'Queens.',
    lead: TAGLINES.welcome,
    sublead: 'Faith-based mentoring for girls 8–17 — intellectually sharp, emotionally grounded, spiritually wise, socially confident.',
    primaryCta: 'Secure her crown today',
    secondaryCta: 'Explore the programs',
    image: '',
  },
  scripture: { eyebrow: 'A royal priesthood · Chosen & beloved', text: SCRIPTURE.text, ref: SCRIPTURE.ref },
  foundry: { ...copy(FOUNDRY), closeTag: 'This is the foundry.', cta: 'Discover our story' },
  vision: copy(VISION),
  mission: copy(MISSION),
  values: copy(VALUES) as unknown as { letter: string; name: string; sub: string; lines: string[] }[],
  pillars: copy(PILLARS) as unknown as { n: string; name: string; sub: string; text: string }[],
  founder: { ...copy(FOUNDER), portrait: '', portraitAlt: 'Grace Abibath Nikoi, founder of Grit & Grace Girls Academy' },
  inner_court: { ...copy(INNER_COURT), statAges: '8–12 · 13–17', statAgesNote: 'two age groups', format: 'Online', formatNote: '+ in-person summits' },
  syllabus: copy(SYLLABUS),
  how_it_works: copy(HOW_IT_WORKS),
  faq: copy(FAQ),
  contact: { email: CONTACT.email, phones: copy(CONTACT.phones), instagram: copy(CONTACT.instagram), location: CONTACT.location },
  taglines: copy(TAGLINES),
  home: {
    valuesEyebrow: 'The Inner Court · The golden pillars',
    valuesTitle: 'G.I.R.L.S. — the essence of who she becomes',
    valuesText: 'A 12-month transformational mentoring journey designed to nurture confident, purpose-driven, emotionally intelligent young queens.',
    programsEyebrow: 'Programs',
    programsTitle: 'Where she becomes who she is',
    programsText: 'There is a gap between what school teaches and what home provides. We fill it with wisdom, values and life skills.',
    parentsEyebrow: 'For parents',
    parentsTitle: 'Watch her grow, week by week',
    parentsText:
      'Her progress, her attendance, her certificates, and a measured before-and-after across all five values — in your own parent portal. Plus the Parents Power Circle. Not a mystery. Not a WhatsApp group.',
    journalEyebrow: 'Stories & insights',
    journalTitle: 'Wisdom for raising Queens',
    ctaEyebrow: 'Ready to join the movement?',
    ctaTitle: 'Because when leaders unite, daughters rise.',
    ctaText: 'Secure her crown today and connect with a network dedicated to making a generational impact.',
  },
  pages: {
    programsTitle: 'Programs & services',
    programsText: 'From a year-long journey for girls to a rite of passage for women — every program is built on the Five Pillars and the G.I.R.L.S. values.',
    eventsEyebrow: 'Grit & Grace Academy presents',
    eventsTitle: 'Events',
    eventsText: 'Summits three times a year, the father–daughter Royal Table, and the Crown Council for everyone raising Ghana’s daughters.',
    journalEyebrow: 'Stories & insights',
    journalTitle: 'Wisdom for raising Queens',
    journalText: 'Practical articles on mentoring, parenting, faith, and empowering the next generation of purpose-driven girls.',
    galleryEyebrow: 'Moments of grace',
    galleryTitle: 'Our gallery',
    galleryText: 'Summits, mentoring circles, the Inner Court and nights at the Royal Table.',
    contactEyebrow: 'Get in touch',
    contactTitle: 'We’d love to hear from you',
    contactText: 'Questions about our mentoring programs, upcoming summits, counselling, or how you can support the Academy — our team is ready to connect.',
  },
  seo: {
    title: 'Grit & Grace Girls Academy — We raise Queens',
    description:
      'Faith-based mentoring for preteen and teenage girls in Accra, Ghana and online — intellectually sharp, emotionally grounded, spiritually wise, socially confident.',
  },
};

export type Defaults = typeof DEFAULTS;
export type SettingKey = keyof Defaults;

// ─────────────────────────────────────────────────────────── merge

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** An empty value with the same shape: strings become '', lists [], flags false. */
export function blankOf<T>(template: T): T {
  if (typeof template === 'string') return '' as T;
  if (typeof template === 'number') return 0 as T;
  if (typeof template === 'boolean') return false as T;
  if (Array.isArray(template)) return [] as T;
  if (isObj(template)) return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, blankOf(v)])) as T;
  return template;
}

/**
 * Stored values win, but only where they have the right shape — a broken row can never crash the site.
 * Lists replace the default list; each item is filled out from the shape of the first default item.
 */
export function deepMerge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(over)) return base;
    const tpl = base[0];
    if (tpl === undefined) return over as T;
    return over.map((item) => deepMerge(blankOf(tpl), item)) as T;
  }
  if (isObj(base)) {
    if (!isObj(over)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(base)) out[k] = deepMerge(base[k], over[k]);
    return out as T;
  }
  if (typeof base === 'number') return (typeof over === 'number' ? over : Number(over) || base) as T;
  if (typeof base === 'string') return (typeof over === 'string' || typeof over === 'number' ? String(over) : base) as T;
  if (typeof base === 'boolean') return (typeof over === 'boolean' ? over : base) as T;
  return over as T;
}

// ─────────────────────────────────────────────────────────── store (one query per page load)

type Row = { key: string; value: unknown; updated_at: string };
let rows: Record<string, Row> = {};
let loaded = false;
let loading: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export function loadSettings(force = false) {
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const { data, error } = await sb().from('site_settings').select('key, value, updated_at');
      if (!error && data) rows = Object.fromEntries((data as Row[]).map((r) => [r.key, r]));
    } catch {
      /* offline: defaults are fine */
    }
    loaded = true;
    emit();
  })();
  return loading;
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!loading) void loadSettings();
  return () => listeners.delete(l);
}

const merged = new Map<string, { v: number; value: unknown }>();

export function getSetting<T>(key: string, defaultValue: T): T {
  const hit = merged.get(key);
  if (hit && hit.v === version) return hit.value as T;
  const value = deepMerge(defaultValue, rows[key]?.value);
  merged.set(key, { v: version, value });
  return value;
}

/** A section of site copy: the saved version laid over the default. */
export function useSetting<T>(key: string, defaultValue: T): T {
  useSyncExternalStore(subscribe, () => version);
  return getSetting(key, defaultValue);
}

export function useSite<K extends SettingKey>(key: K): Defaults[K] {
  return useSetting(key, DEFAULTS[key]);
}

export function useSettingsLoaded() {
  useSyncExternalStore(subscribe, () => version);
  return loaded;
}

export function settingUpdatedAt(key: string) {
  return rows[key]?.updated_at ?? null;
}

export function hasSaved(key: string) {
  return key in rows;
}

export async function saveSetting(key: string, value: unknown) {
  const { data: u } = await sb().auth.getUser();
  const updated_at = new Date().toISOString();
  const { error } = await sb()
    .from('site_settings')
    .upsert({ key, value, updated_at, updated_by: u.user?.id ?? null }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  rows = { ...rows, [key]: { key, value, updated_at } };
  emit();
}

/** Back to the words in academy.ts. */
export async function resetSetting(key: string) {
  const { error } = await sb().from('site_settings').delete().eq('key', key);
  if (error) throw new Error(error.message);
  const next = { ...rows };
  delete next[key];
  rows = next;
  emit();
}

// ─────────────────────────────────────────────────────────── helpers

export function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function longDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' });
}

/** Published articles whose date has come, newest first. */
export async function loadPublishedArticles(limit?: number): Promise<Article[]> {
  let q = sb().from('articles').select('*').eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false });
  if (limit) q = q.limit(limit + 5);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const now = Date.now();
  const list = ((data ?? []) as Article[]).filter((a) => !a.published_at || new Date(a.published_at).getTime() <= now);
  return limit ? list.slice(0, limit) : list;
}
