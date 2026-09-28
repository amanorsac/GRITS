export type Role = 'member' | 'parent' | 'mentor' | 'moderator' | 'admin' | 'owner';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  display_name: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  age_band: '8-12' | '13-17' | '18+' | '10-12' | '13-15' | '16-18' | null;
  crown_level: number;
  circle_id: string | null;
  data_saver: boolean;
  created_at: string;
};

export type Program = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  summary: string;
  duration_label: string;
  price_pesewas: number | null;
  instalments: number;
  is_open: boolean;
  audience: string;
  pro_rata: boolean;
  cohort_start: string | null;
  cohort_end: string | null;
  inclusions: string[];
  position: number;
};

export type AcademyEvent = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  starts_at: string | null;
  ends_at: string | null;
  date_label: string | null;
  venue: string | null;
  program_slug: string | null;
  register_url: string | null;
};

export type Module = {
  id: string;
  course_id: string;
  month_no: number;
  value: string | null;
  title: string;
  summary: string;
  unlock_at: string | null;
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
  bunny_video_id: string | null;
  size_mb_480p: number | null;
  unlock_at: string | null;
};

export type Progress = { lesson_id: string; position_seconds: number; completed_at: string | null; updated_at: string };

export type Space = { id: string; slug: string; name: string; circle_id: string | null; position: number };

export type Post = {
  id: string;
  space_id: string;
  author_id: string;
  kind: 'general' | 'win' | 'prayer' | 'books' | 'scripture';
  body: string;
  status: 'pending' | 'approved' | 'removed';
  queue_reason: 'safety' | 'first_post' | 'reported' | 'flagged' | null;
  created_at: string;
};

export type LiveSession = {
  id: string;
  title: string;
  kind: 'broadcast' | 'interactive';
  circle_id: string | null;
  host_id: string | null;
  host_name: string | null;
  starts_at: string;
  ends_at: string | null;
  youtube_id: string | null;
  jaas_room: string | null;
  is_live: boolean;
};

export type Payment = {
  id: string;
  reference: string;
  amount_pesewas: number;
  currency: string;
  channel: string | null;
  instalment_no: number;
  status: 'pending' | 'success' | 'failed' | 'abandoned' | 'refunded';
  due_at: string | null;
  paid_at: string | null;
  enrolment_id: string | null;
};

export const VALUE_LABEL: Record<string, string> = {
  gracefulness: 'Gracefulness',
  integrity: 'Integrity',
  resilience: 'Resilience',
  leadership: 'Leadership',
  spirituality: 'Spirituality',
};

export const KIND_LABEL: Record<Post['kind'], string> = {
  general: '',
  win: 'WIN OF THE WEEK',
  prayer: 'PRAYER REQUEST',
  books: 'BOOKS',
  scripture: 'SCRIPTURE',
};
