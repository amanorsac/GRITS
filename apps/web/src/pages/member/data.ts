import { sb } from '../../lib/supabase';
import type { Lesson, Module, Progress } from '../../lib/types';

export type Journey = {
  modules: Module[];
  lessons: Lesson[];
  progress: Map<string, Progress>;
  current: Module | null;
  currentLessons: Lesson[];
  resume: Lesson | null;
  journeyPct: number;
};

export type LessonState = 'done' | 'progress' | 'locked' | 'open';

export function lessonState(l: Lesson, progress: Map<string, Progress>): LessonState {
  const p = progress.get(l.id);
  if (p?.completed_at) return 'done';
  if (l.unlock_at && new Date(l.unlock_at) > new Date()) return 'locked';
  if (p) return 'progress';
  return 'open';
}

export function moduleLocked(m: Module) {
  return !!m.unlock_at && new Date(m.unlock_at) > new Date();
}

/** Everything the member home and Academy need, in three queries. */
export async function loadJourney(memberId: string): Promise<Journey> {
  const [mods, less, prog] = await Promise.all([
    sb().from('modules').select('*').order('month_no'),
    sb().from('lessons').select('*').order('position'),
    sb().from('lesson_progress').select('*').eq('member_id', memberId),
  ]);
  if (mods.error) throw new Error(mods.error.message);
  const modules = (mods.data ?? []) as Module[];
  const lessons = (less.data ?? []) as Lesson[];
  const progress = new Map(((prog.data ?? []) as Progress[]).map((p) => [p.lesson_id, p]));

  // The current month is the first unlocked module that is not finished.
  const byModule = (id: string) => lessons.filter((l) => l.module_id === id);
  const current =
    modules.find((m) => !moduleLocked(m) && byModule(m.id).some((l) => !progress.get(l.id)?.completed_at)) ?? modules.find((m) => !moduleLocked(m)) ?? null;
  const currentLessons = current ? byModule(current.id) : [];

  const inProgress = [...progress.values()]
    .filter((p) => !p.completed_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((p) => lessons.find((l) => l.id === p.lesson_id))
    .find(Boolean);
  const resume = inProgress ?? currentLessons.find((l) => lessonState(l, progress) === 'open') ?? null;

  const done = lessons.filter((l) => progress.get(l.id)?.completed_at).length;
  return { modules, lessons, progress, current, currentLessons, resume, journeyPct: lessons.length ? Math.round((100 * done) / lessons.length) : 0 };
}
