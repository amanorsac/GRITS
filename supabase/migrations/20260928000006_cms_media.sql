-- Everything the Academy edits after handover lives here, so nobody has to change code:
-- site copy, journal articles, gallery, course covers and workbooks, and uploaded media.

-- ─────────────────────────────────────────────────────────── website copy
-- One JSON document per section (hero, founder, values…). The web app ships defaults and
-- overlays whatever is stored here.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────── journal (blog)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  tag text not null default '',
  excerpt text not null default '',
  body text not null default '',          -- plain text with blank-line paragraphs; "## " for headings
  cover_url text,
  author text not null default 'Grace Abibath Nikoi',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.articles enable row level security;
create policy articles_read on public.articles for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy articles_admin on public.articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.articles (slug, title, tag, excerpt, status, published_at) values
  ('the-blueprint-was-written-before-the-throne', 'The Blueprint Was Written Before the Throne', 'Identity & Leadership', 'Before Saul ever sat on the throne, Samuel wrote down the conduct of kingship. Royalty isn’t created by the crown — it’s revealed by behaviour.', 'published', '2026-07-03'),
  ('the-royal-wardrobe', 'The Royal Wardrobe: Beauty, Modesty & Style', 'Modesty & Style', 'In today’s world beauty is defined by changing trends. We must help our girls discover a deeper definition: true beauty begins from within.', 'published', '2026-06-03'),
  ('the-holiday-trap', 'The Holiday Trap: Silent Mistakes Parents Make', 'Parenting', 'Long holidays were meant to be a sacred pause to rest, reset and reconnect as a family. Too often they become a silent trap.', 'published', '2026-04-15'),
  ('self-management', 'Self-Management: The Missing Link to Your Daughter’s Success', 'Personal Growth', 'Every parent wants to see their daughter excel, but intelligence without self-management leads to wasted potential.', 'published', '2026-04-10'),
  ('the-7-royal-codes', 'The 7 Royal Codes for Raising Girls Into Queens', 'Mentorship', 'Instead of “What’s wrong with you?” invite her to share. Curiosity opens her heart; judgment shuts the door.', 'published', '2026-04-05'),
  ('red-flags-were-missing', 'Parents: The Red Flags We’re Missing', 'Parenting', 'I work with teenage girls daily. Here are signs we dismiss as “just a phase” that are actually cries for help.', 'published', '2026-04-01')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────── gallery
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'image' check (kind in ('image', 'video')),
  url text not null,                      -- image URL, or a YouTube link for videos
  caption text not null default '',
  category text not null default 'Summits & Events',  -- Summits & Events | Mentoring | The Inner Court | Father & Daughter
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.gallery_items enable row level security;
create policy gallery_read on public.gallery_items for select to anon, authenticated using (true);
create policy gallery_admin on public.gallery_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────── covers & course files
alter table public.modules add column if not exists cover_url text;
alter table public.programs add column if not exists cover_url text;
alter table public.events add column if not exists cover_url text;
alter table public.lessons add column if not exists video_status text;   -- uploading | processing | ready | failed

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  path text not null,                     -- object path in the private "course" bucket
  size_bytes bigint,
  created_at timestamptz not null default now()
);
alter table public.lesson_resources enable row level security;
create policy resources_read on public.lesson_resources for select to authenticated using (public.has_content_access());
create policy resources_admin on public.lesson_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Recordings: a finished live session can point at a lesson or a replay link.
alter table public.live_sessions add column if not exists recording_url text;

-- Announcements show on the member home until they expire.
alter table public.announcements add column if not exists audience text not null default 'members'; -- members | parents | everyone
alter table public.announcements add column if not exists expires_at timestamptz;

-- ─────────────────────────────────────────────────────────── storage buckets
-- "media": public site images (hero, founder, gallery, covers). "course": private workbooks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('course', 'course', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/aac'])
on conflict (id) do nothing;

create policy media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy media_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

create policy course_read on storage.objects for select to authenticated using (bucket_id = 'course' and public.has_content_access());
create policy course_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'course' and public.is_admin());
create policy course_admin_update on storage.objects for update to authenticated using (bucket_id = 'course' and public.is_admin());
create policy course_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'course' and public.is_admin());

-- ─────────────────────────────────────────────────────────── demo data switch
-- Demo people use the demo.gritandgrace.app email domain and cannot sign in (no password).
-- Removing them cascades through profiles to every row they own.
create or replace function public.demo_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'people', (select count(*) from auth.users where email like '%@demo.gritandgrace.app'),
    'circles', (select count(*) from public.circles where name like '%(demo)%' or cohort = 'demo'),
    'sessions', (select count(*) from public.live_sessions where title like '%·%' and host_name like '%(demo)%')
  ) where public.is_admin()
$$;

create or replace function public.purge_demo() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.live_sessions where circle_id in (select id from public.circles where cohort = 'demo') or host_name like '%(demo)%';
  delete from public.circles where cohort = 'demo';
  delete from public.contact_messages where email like '%@demo.gritandgrace.app';
  delete from public.announcements where title like '[Demo]%';
  update public.profiles set circle_id = null where circle_id is not null and circle_id not in (select id from public.circles);
  delete from auth.users where email like '%@demo.gritandgrace.app';
  get diagnostics n = row_count;
  return jsonb_build_object('removed_people', n);
end $$;
