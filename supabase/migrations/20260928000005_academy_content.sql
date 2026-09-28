-- Real Academy details from gritgracegirlsacademy.com (September 2026):
-- Inner Court GHS 2,999/year, pro-rata by remaining months; age groups 8-12 and 13-17;
-- HerShift is for women 18+, GHS 699; events and services; a contact inbox.

alter type public.age_band add value if not exists '8-12';
alter type public.age_band add value if not exists '13-17';
alter type public.age_band add value if not exists '18+';

alter table public.programs
  add column if not exists audience text not null default '',
  add column if not exists pro_rata boolean not null default false,
  add column if not exists cohort_start date,
  add column if not exists cohort_end date,
  add column if not exists inclusions text[] not null default '{}',
  add column if not exists position int not null default 0;

update public.programs set
  price_pesewas = 299900, instalments = 1, pro_rata = true,
  cohort_start = '2026-02-01', cohort_end = '2027-01-31',
  audience = 'Girls 8–12 and 13–17', duration_label = '12 months', position = 1,
  summary = 'This is not a Zoom call. It is a royal summons. A 12-month transformational mentoring journey through Gracefulness, Integrity, Resilience, Leadership and Spirituality — a circle of girls being shaped not by culture, but by calling.',
  inclusions = array[
    'Monthly live mentoring sessions',
    'Weekly Royal Wisdom — mentor voice notes',
    'The Parents Power Circle',
    '12 carefully selected books',
    '52 affirmation flashcards (Queen Words)',
    'Family Connection Guide',
    'A priceless lifetime experience']
where slug = 'inner-court';

update public.programs set
  price_pesewas = 69900, kind = 'intensive', is_open = false, position = 2,
  audience = 'Women 18 and above', duration_label = '3 months',
  summary = 'The rite of passage for women. A 3-month transformation for women stepping into the next level — because becoming doesn''t stop at girlhood. It continues into leadership, motherhood, nation-building.',
  inclusions = array['Covers the full 3-month experience', 'Limited spaces', 'New cohort date to be announced']
where slug = 'hershift';

update public.programs set
  position = 3, audience = 'Fathers and daughters', duration_label = 'One evening',
  summary = 'A night where fathers rise and daughters receive. No speeches. No clichés. A father looking his daughter in the eye and saying, "I see you. I know your worth. You are my royalty."',
  inclusions = array['3-course dinner', 'Framed portrait', 'Signature gift', 'Red carpet arrival']
where slug = 'royal-table';

insert into public.programs (slug, name, kind, summary, duration_label, audience, is_open, position, inclusions) values
  ('summits', 'Grit & Grace Summits', 'event',
   'Three times a year, we gather — not for entertainment, for affirmation. Identity-anchored workshops on the Five Pillars, guest mentors, panel discussions and sacred sisterhood. This is not a conference. It is a coronation.',
   '3× per year', 'Girls in the Academy', true, 4,
   array['Identity-anchored workshops (the Five Pillars)', 'Inspiring guest mentors and role models', 'Hands-on growth activities and panels', 'A safe, faith-driven space']),
  ('counselling', 'One-on-One Counselling', 'service',
   'A private audience with wisdom. Personalised, professional and prayerfully led — where struggles are not shamed, they are sacred.',
   '1 hour', 'Girls and families', true, 5,
   array['Virtual or in person in Accra', 'Led by a Licensed Practising Counsellor']),
  ('crown-council', 'The Crown Council', 'event',
   'Where leaders convene to build tomorrow''s queens. A movement, not just a meeting — for parents, educators, counsellors, school leaders, NGOs and policy makers.',
   'Half day', 'Parents, educators and leaders', true, 6,
   array['Keynote: Beyond the Academic — Raising the Whole Girl', 'Expert session: Child Safety Online', 'Panel: Raising the Whole Girl in Today''s World', 'A collective commitment moment'])
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────── events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  tagline text not null default '',
  description text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  date_label text,                 -- e.g. 'Coming 2027' when there is no exact date yet
  venue text,
  program_slug text references public.programs (slug) on delete set null,
  register_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy events_read on public.events for select to anon, authenticated using (is_published or public.is_admin());
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.events (slug, title, tagline, description, starts_at, ends_at, venue, program_slug) values
  ('royal-table-2026', 'The Royal Table', 'A Night of Legacy & Love',
   'Fathers hold the key to their daughters'' identity. Red carpet arrivals, formal dining, and guided moments of legacy declaration — a milestone that will echo in her heart for a lifetime. Seating is strictly limited.',
   '2026-08-29 17:00:00+00', '2026-08-29 21:00:00+00', 'Airport View Hotel, Accra', 'royal-table')
on conflict (slug) do nothing;
insert into public.events (slug, title, tagline, description, date_label, venue, program_slug) values
  ('crown-council-2027', 'The Crown Council', 'Where Leaders Convene to Build Tomorrow''s Queens',
   'Together, we ensure every girl in Ghana grows up whole, not just accomplished. 8:00 AM – 1:00 PM.',
   'Coming 2027', 'Airport View Hotel, Accra', 'crown-council')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────── contact inbox
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text,
  subject text not null default '' check (char_length(subject) <= 200),
  message text not null check (char_length(message) between 1 and 4000),
  topic text,                     -- 'enquiry' | 'counselling' | 'summits' | 'royal-table' | 'crown-council'
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- Written by the Worker (rate-limited, email alert); only admins read.
create policy contact_read on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_update on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
