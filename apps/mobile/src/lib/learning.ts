import { isFuture, unlockLabel } from './format';
import type { StatusKind } from './theme';
import { must, supabase } from './supabase';
import type { Lesson, LessonProgress, Module } from './types';

export type LessonSummary = Pick<
  Lesson,
  'id' | 'module_id' | 'position' | 'kind' | 'title' | 'duration_min' | 'size_mb_480p' | 'unlock_at'
>;
export type ModuleWithLessons = Module & { lessons: LessonSummary[] };
export type Course = { modules: ModuleWithLessons[]; progress: Map<string, LessonProgress> };

const LESSON_COLS = 'id, module_id, position, kind, title, duration_min, size_mb_480p, unlock_at';

export async function loadCourse(memberId: string): Promise<Course> {
  const [modules, progress] = await Promise.all([
    supabase
      .from('modules')
      .select(`id, month_no, value, title, summary, unlock_at, lessons (${LESSON_COLS})`)
      .order('month_no'),
    supabase
      .from('lesson_progress')
      .select('lesson_id, position_seconds, completed_at, updated_at')
      .eq('member_id', memberId),
  ]);
  const mods = must(modules) as ModuleWithLessons[];
  for (const m of mods) m.lessons = [...(m.lessons ?? [])].sort((a, b) => a.position - b.position);
  const map = new Map<string, LessonProgress>();
  for (const p of must(progress) as LessonProgress[]) map.set(p.lesson_id, p);
  return { modules: mods, progress: map };
}

export function moduleLocked(m: Pick<Module, 'unlock_at'>): boolean {
  return isFuture(m.unlock_at);
}

export function doneCount(m: ModuleWithLessons, progress: Map<string, LessonProgress>): number {
  return m.lessons.filter((l) => progress.get(l.id)?.completed_at).length;
}

export type LessonState = { status: StatusKind | 'open'; label: string; open: boolean };

export function lessonState(
  lesson: Pick<Lesson, 'id' | 'unlock_at'>,
  module: Pick<Module, 'unlock_at'>,
  progress: Map<string, LessonProgress>,
): LessonState {
  const p = progress.get(lesson.id);
  if (p?.completed_at) return { status: 'complete', label: 'Done', open: true };
  if (moduleLocked(module)) return { status: 'locked', label: 'Locked', open: false };
  if (isFuture(lesson.unlock_at)) return { status: 'locked', label: unlockLabel(lesson.unlock_at!), open: false };
  if (p) return { status: 'progress', label: 'In progress', open: true };
  return { status: 'open', label: 'Ready', open: true };
}

/** The month she is in: the first unlocked module that is not finished (else the last unlocked). */
export function currentModule(course: Course): ModuleWithLessons | null {
  const unlocked = course.modules.filter((m) => !moduleLocked(m) && m.lessons.length > 0);
  return unlocked.find((m) => doneCount(m, course.progress) < m.lessons.length) ?? unlocked.at(-1) ?? null;
}

/** First lesson in a module that is open and not done. */
export function nextLesson(m: ModuleWithLessons, progress: Map<string, LessonProgress>): LessonSummary | null {
  return m.lessons.find((l) => !progress.get(l.id)?.completed_at && lessonState(l, m, progress).open) ?? null;
}

export function minutesLeft(lesson: Pick<Lesson, 'duration_min'>, p?: LessonProgress): number | null {
  if (!lesson.duration_min) return null;
  const watched = Math.floor((p?.position_seconds ?? 0) / 60);
  return Math.max(1, lesson.duration_min - watched);
}

export function fraction(lesson: Pick<Lesson, 'duration_min'>, p?: LessonProgress): number {
  if (!lesson.duration_min || !p) return 0;
  return Math.min(1, p.position_seconds / (lesson.duration_min * 60));
}

/** Marks a lesson as started (touches updated_at without clearing completion). */
export async function markStarted(memberId: string, lessonId: string, positionSeconds?: number) {
  const row: Record<string, unknown> = { member_id: memberId, lesson_id: lessonId, updated_at: new Date().toISOString() };
  if (positionSeconds != null) row.position_seconds = positionSeconds;
  await supabase.from('lesson_progress').upsert(row, { onConflict: 'member_id,lesson_id' });
}

export const KIND_LABEL: Record<Lesson['kind'], string> = {
  video: 'Video',
  devotional: 'Devotional',
  assignment: 'Assignment',
  live: 'Live session',
};
