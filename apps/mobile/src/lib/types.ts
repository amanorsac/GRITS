// Row shapes from supabase/migrations (only the columns the app reads).
import type { PostKind } from './api';

export type Role = 'member' | 'parent' | 'mentor' | 'moderator' | 'admin' | 'owner';
export type ValueKey = 'gracefulness' | 'integrity' | 'resilience' | 'leadership' | 'spirituality';
export type ReactionKind = 'crown' | 'heart' | 'praying' | 'amen';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  display_name: string;
  username: string | null;
  crown_level: number;
  circle_id: string | null;
  data_saver: boolean;
  created_at: string;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  role: Role;
  crown_level: number;
  circle_id: string | null;
};

export type Lesson = {
  id: string;
  module_id: string;
  position: number;
  kind: 'video' | 'devotional' | 'assignment' | 'live';
  title: string;
  summary: string;
  body: string;
  journal_prompt: string | null;
  duration_min: number | null;
  size_mb_480p: number | null;
  unlock_at: string | null;
};

export type Module = {
  id: string;
  month_no: number;
  value: ValueKey | null;
  title: string;
  summary: string;
  unlock_at: string | null;
};

export type LessonProgress = {
  lesson_id: string;
  position_seconds: number;
  completed_at: string | null;
  updated_at: string;
};

export type Space = { id: string; slug: string; name: string; circle_id: string | null; position: number };

export type Post = {
  id: string;
  space_id: string;
  author_id: string;
  kind: PostKind;
  body: string;
  status: 'pending' | 'approved' | 'removed';
  created_at: string;
};

export type Reply = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  status: 'pending' | 'approved' | 'removed';
  created_at: string;
};

export type LiveSession = {
  id: string;
  title: string;
  kind: 'broadcast' | 'interactive';
  circle_id: string | null;
  host_name: string | null;
  starts_at: string;
  ends_at: string | null;
  youtube_id: string | null;
  is_live: boolean;
  recording_lesson_id: string | null;
  circle?: { name: string } | null;
};

export type Badge = { id: string; slug: string; name: string; description: string };
export type Certificate = { id: string; code: string; title: string; issued_at: string };
export type JournalEntry = { id: string; prompt: string | null; body: string; created_at: string; lesson_id: string | null };

/** Old bands ('10-12', '13-15', '16-18') still exist on older rows; new rows use '8-12' / '13-17'. */
export type AgeBand = '8-12' | '13-17' | '18+' | '10-12' | '13-15' | '16-18';

export type Circle = { id: string; name: string; mentor_id: string | null };

export type DmThread = { id: string; member_id: string; mentor_id: string; created_at: string };
export type DmMessage = { id: string; thread_id: string; sender_id: string; body: string; created_at: string };
