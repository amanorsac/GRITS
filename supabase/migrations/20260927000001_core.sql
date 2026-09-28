-- Grit & Grace — core schema
-- Parent-first enrolment, consent ledger, courses, community, live, safeguarding.
-- Every table has RLS enabled. Anything that must be trusted (payments, post
-- approval, account creation for girls) goes through the Worker with the
-- service role, or through SECURITY DEFINER functions that check the caller.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────── enums
create type public.user_role as enum ('member', 'parent', 'mentor', 'moderator', 'admin', 'owner');
create type public.age_band as enum ('10-12', '13-15', '16-18');
create type public.value_key as enum ('gracefulness', 'integrity', 'resilience', 'leadership', 'spirituality');
create type public.lesson_kind as enum ('video', 'devotional', 'assignment', 'live');
create type public.post_kind as enum ('general', 'win', 'prayer', 'books', 'scripture');
create type public.post_status as enum ('pending', 'approved', 'removed');
create type public.reaction_kind as enum ('crown', 'heart', 'praying', 'amen');
create type public.payment_status as enum ('pending', 'success', 'failed', 'abandoned', 'refunded');
create type public.enrolment_status as enum ('pending_payment', 'active', 'paused', 'completed', 'cancelled');
create type public.live_kind as enum ('broadcast', 'interactive');
create type public.mod_action as enum ('approve', 'remove', 'warn', 'timeout', 'escalate');
create type public.queue_reason as enum ('safety', 'first_post', 'reported', 'flagged');

-- ─────────────────────────────────────────────────────────── people
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mentor_id uuid,
  cohort text not null default '2026-27',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'parent',
  full_name text not null default '',
  display_name text not null default '',
  username text unique,
  phone text,
  email text,
  age_band public.age_band,
  birth_year int,
  crown_level int not null default 1,
  circle_id uuid references public.circles (id) on delete set null,
  data_saver boolean not null default true,
  push_token text,
  timed_out_until timestamptz,
  created_at timestamptz not null default now()
);

alter table public.circles
  add constraint circles_mentor_fk foreign key (mentor_id) references public.profiles (id) on delete set null;

create table public.parent_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid not null references public.profiles (id) on delete cascade,
  relationship text not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id)
);

-- A child's account does not exist until her parent has paid and she redeems a code.
create table public.join_codes (
  code text primary key,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_name text not null,
  age_band public.age_band not null,
  birth_year int,
  enrolment_id uuid,
  permissions jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default now() + interval '30 days',
  used_by uuid references public.profiles (id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- What she can reach. Community is off by default under 13.
create table public.member_permissions (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  circle boolean not null default true,
  court boolean not null default false,
  mentor_dm boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Append-only consent ledger. Never updated, never deleted.
create table public.consents (
  id bigint generated always as identity primary key,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid references public.profiles (id) on delete cascade,
  join_code text,
  scope text not null,          -- 'data_processing' | 'circle' | 'court' | 'mentor_dm' | 'weekly_digest'
  granted boolean not null,
  policy_version text not null default '2026-09',
  user_agent text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── commerce
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  kind text not null,                   -- 'mentoring' | 'intensive' | 'event'
  summary text not null default '',
  duration_label text not null default '',
  price_pesewas int,                    -- null until the Academy supplies it
  instalments int not null default 1,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id),
  cohort text not null default '2026-27',
  status public.enrolment_status not null default 'pending_payment',
  plan text not null default 'full',    -- 'full' | 'instalments'
  started_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.join_codes
  add constraint join_codes_enrolment_fk foreign key (enrolment_id) references public.enrolments (id) on delete set null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  enrolment_id uuid references public.enrolments (id) on delete set null,
  reference text unique not null,
  amount_pesewas int not null,
  currency text not null default 'GHS',
  channel text,
  instalment_no int not null default 1,
  status public.payment_status not null default 'pending',
  due_at timestamptz,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table public.waitlist (
  id bigint generated always as identity primary key,
  program_slug text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (program_slug, email)
);

-- ─────────────────────────────────────────────────────────── teaching
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs (id) on delete cascade,
  slug text unique not null,
  title text not null,
  summary text not null default ''
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  month_no int not null,
  value public.value_key,
  title text not null,
  summary text not null default '',
  unlock_at timestamptz,
  unique (course_id, month_no)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  position int not null,
  kind public.lesson_kind not null default 'video',
  title text not null,
  summary text not null default '',
  body text not null default '',
  journal_prompt text,
  duration_min int,
  bunny_video_id text,
  size_mb_480p int,
  unlock_at timestamptz,
  unique (module_id, position)
);

create table public.lesson_progress (
  member_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position_seconds int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);

-- Private to her. Parents can see that entries exist (count), never the text.
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  prompt text,
  body text not null,
  shared_with_mentor boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default ''
);

create table public.member_badges (
  member_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (member_id, badge_id)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('GG-' || upper(substr(md5(gen_random_uuid()::text), 1, 4))),
  member_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  title text not null,
  issued_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null,                  -- 'intake' | 'mid' | 'final'
  scores jsonb not null,                -- { gracefulness: 0-100, ... , confidence: 0-100 }
  taken_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── community
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  circle_id uuid references public.circles (id) on delete cascade,
  position int not null default 0
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.post_kind not null default 'general',
  body text not null check (char_length(body) between 1 and 2000),
  media_url text,
  status public.post_status not null default 'pending',
  queue_reason public.queue_reason,
  moderation jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index posts_space_created on public.posts (space_id, created_at desc);
create index posts_pending on public.posts (status) where status = 'pending';

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status public.post_status not null default 'pending',
  moderation jsonb,
  created_at timestamptz not null default now()
);

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete cascade,
  reply_id uuid references public.replies (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default 'unkind',
  created_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete set null,
  subject_id uuid references public.profiles (id) on delete set null,
  moderator_id uuid not null references public.profiles (id),
  action public.mod_action not null,
  note text not null check (char_length(note) >= 3),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- "Talk to someone" — reaches a real adult. Only staff read these.
create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  status text not null default 'open',
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Mentor DMs. She starts the thread. Every message is logged and staff-visible.
create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_id, mentor_id)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── live
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind public.live_kind not null default 'interactive',
  circle_id uuid references public.circles (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete set null,
  host_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  youtube_id text,
  jaas_room text,
  is_live boolean not null default false,
  recording_lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.attendance (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  audio_only boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (session_id, member_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Touched once a day by the Worker cron so the free project never pauses.
create table public.keepalive (
  id int primary key default 1,
  pinged_at timestamptz not null default now()
);
insert into public.keepalive (id) values (1);
