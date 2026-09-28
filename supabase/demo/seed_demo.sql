-- Demo data so the platform looks lived-in for presentations.
-- Run: npx supabase db query --linked -f supabase/demo/seed_demo.sql
-- Remove: The Palace → Overview → "Remove demo data" (calls public.purge_demo()).
--
-- Demo people use @demo.gritandgrace.app and have NO password — nobody can sign in as them.
-- Every existing admin/owner account is placed in "Circle 4" and linked as Ama's parent,
-- so the owner can preview the member view and the parent view with real-looking data.

do $$
declare
  now_ts timestamptz := now();
  c4 uuid; c2 uuid;
  adjoa uuid; esi_m uuid; kafui uuid;
  ama uuid; efua uuid; naa uuid; akosua uuid; abena uuid; yaa uuid; akua uuid; adwoa uuid; esiq uuid; nana uuid;
  mum uuid; dad2 uuid; mum3 uuid; mum4 uuid;
  ic uuid; enr uuid; s_c4 uuid; s_c2 uuid; s_hall uuid; s_prayer uuid; s_wins uuid; s_books uuid;
  p_win uuid; p_prayer uuid; p_books uuid; p_hall uuid; p_safety uuid; p_first uuid; p_rep uuid;
  live_tonight uuid; live_past uuid; live_bcast uuid;
  thread uuid; staff record; girl uuid; i int;
  m1 uuid; m2 uuid; m3 uuid; les record;
  price int;
begin
  if exists (select 1 from auth.users where email = 'ama@demo.gritandgrace.app') then
    raise notice 'Demo data already present — run purge_demo() first to reseed.';
    return;
  end if;

  -- ── people ────────────────────────────────────────────────────────────────────
  create temp table _mk (key text primary key, id uuid) on commit drop;
  insert into _mk
  select key, gen_random_uuid() from unnest(array[
    'adjoa','esi_m','kafui','ama','efua','naa','akosua','abena','yaa','akua','adwoa','esiq','nana','mum','dad2','mum3','mum4']) key;

  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', m.id, 'authenticated', 'authenticated',
         p.email, now_ts, p.app::jsonb, p.usr::jsonb, now_ts - (p.joined || ' days')::interval, now_ts, '', '', '', ''
  from _mk m join (values
    ('adjoa',  'adjoa@demo.gritandgrace.app',  '{"role":"mentor"}',   '{"full_name":"Adjoa Mensah","display_name":"Adjoa"}', 240),
    ('esi_m',  'esi.o@demo.gritandgrace.app',  '{"role":"mentor"}',   '{"full_name":"Esi Owusu","display_name":"Esi"}', 230),
    ('kafui',  'kafui@demo.gritandgrace.app',  '{"role":"moderator"}','{"full_name":"Kafui Agbeko","display_name":"Kafui"}', 220),
    ('ama',    'ama@demo.gritandgrace.app',    '{"role":"member","username":"ama.b","age_band":"8-12","birth_year":"2014"}', '{"full_name":"Ama Boateng","display_name":"Ama"}', 240),
    ('efua',   'efua@demo.gritandgrace.app',   '{"role":"member","username":"efua.a","age_band":"13-17","birth_year":"2012"}','{"full_name":"Efua Asante","display_name":"Efua"}', 238),
    ('naa',    'naa@demo.gritandgrace.app',    '{"role":"member","username":"naadede","age_band":"13-17","birth_year":"2011"}','{"full_name":"Naa Dede Lamptey","display_name":"Naa Dede"}', 236),
    ('akosua', 'akosua@demo.gritandgrace.app', '{"role":"member","username":"akosua.b","age_band":"13-17","birth_year":"2010"}','{"full_name":"Akosua Boakye","display_name":"Akosua"}', 230),
    ('abena',  'abena@demo.gritandgrace.app',  '{"role":"member","username":"abena.k","age_band":"13-17","birth_year":"2011"}','{"full_name":"Abena Kyei","display_name":"Abena"}', 225),
    ('yaa',    'yaa@demo.gritandgrace.app',    '{"role":"member","username":"yaa.o","age_band":"8-12","birth_year":"2015"}',  '{"full_name":"Yaa Owusu","display_name":"Yaa"}', 5),
    ('akua',   'akua@demo.gritandgrace.app',   '{"role":"member","username":"akua.m","age_band":"13-17","birth_year":"2012"}','{"full_name":"Akua Mensah","display_name":"Akua"}', 200),
    ('adwoa',  'adwoa@demo.gritandgrace.app',  '{"role":"member","username":"adwoa.d","age_band":"8-12","birth_year":"2015"}','{"full_name":"Adwoa Darko","display_name":"Adwoa"}', 190),
    ('esiq',   'esiq@demo.gritandgrace.app',   '{"role":"member","username":"esi.q","age_band":"13-17","birth_year":"2010"}', '{"full_name":"Esi Quaye","display_name":"Esi"}', 180),
    ('nana',   'nana@demo.gritandgrace.app',   '{"role":"member","username":"nana.ama","age_band":"8-12","birth_year":"2016"}','{"full_name":"Nana Ama Ofori","display_name":"Nana Ama"}', 60),
    ('mum',    'esi.boateng@demo.gritandgrace.app', '{}', '{"full_name":"Esi Boateng","phone":"+233 24 000 0001"}', 241),
    ('dad2',   'kwame.asante@demo.gritandgrace.app', '{}', '{"full_name":"Kwame Asante","phone":"+233 24 000 0002"}', 239),
    ('mum3',   'dzifa.lamptey@demo.gritandgrace.app', '{}', '{"full_name":"Dzifa Lamptey","phone":"+233 24 000 0003"}', 237),
    ('mum4',   'afia.owusu@demo.gritandgrace.app', '{}', '{"full_name":"Afia Owusu","phone":"+233 24 000 0004"}', 6)
  ) as p(key, email, app, usr, joined) on p.key = m.key;

  select id into adjoa from _mk where key='adjoa'; select id into esi_m from _mk where key='esi_m'; select id into kafui from _mk where key='kafui';
  select id into ama from _mk where key='ama'; select id into efua from _mk where key='efua'; select id into naa from _mk where key='naa';
  select id into akosua from _mk where key='akosua'; select id into abena from _mk where key='abena'; select id into yaa from _mk where key='yaa';
  select id into akua from _mk where key='akua'; select id into adwoa from _mk where key='adwoa'; select id into esiq from _mk where key='esiq';
  select id into nana from _mk where key='nana';
  select id into mum from _mk where key='mum'; select id into dad2 from _mk where key='dad2'; select id into mum3 from _mk where key='mum3'; select id into mum4 from _mk where key='mum4';

  -- ── circles (each gets its own private space via trigger) ───────────────────────────────
  insert into public.circles (name, mentor_id, cohort) values ('Circle 4', adjoa, 'demo') returning id into c4;
  insert into public.circles (name, mentor_id, cohort) values ('Circle 2', esi_m, 'demo') returning id into c2;
  select id into s_c4 from public.spaces where circle_id = c4;
  select id into s_c2 from public.spaces where circle_id = c2;
  select id into s_hall from public.spaces where slug = 'great-hall';
  select id into s_prayer from public.spaces where slug = 'prayer';
  select id into s_wins from public.spaces where slug = 'wins';
  select id into s_books from public.spaces where slug = 'books';

  update public.profiles set circle_id = c4, crown_level = 3 where id = ama;
  update public.profiles set circle_id = c4, crown_level = 3 where id in (efua, naa, abena, yaa);
  update public.profiles set circle_id = c4, crown_level = 1 where id = yaa;
  update public.profiles set circle_id = c2, crown_level = 2 where id in (akosua, akua, adwoa, esiq, nana);
  update public.profiles set crown_level = 3 where id = efua;

  -- Staff accounts preview Circle 4 and "parent" Ama.
  for staff in select id from public.profiles where role in ('admin', 'owner') loop
    update public.profiles set circle_id = c4 where id = staff.id;
    insert into public.parent_links (parent_id, child_id, relationship) values (staff.id, ama, 'preview') on conflict do nothing;
  end loop;

  insert into public.parent_links (parent_id, child_id) values (mum, ama), (dad2, efua), (mum3, naa), (mum4, yaa);

  -- Permissions: community on for most; Yaa (8) and Nana Ama (10) still locked by their parents.
  insert into public.member_permissions (member_id, circle, court, mentor_dm, updated_by)
  select id, true, id not in (yaa, nana), true, mum from (values (ama),(efua),(naa),(akosua),(abena),(yaa),(akua),(adwoa),(esiq),(nana)) v(id);

  insert into public.consents (parent_id, child_id, scope, granted, created_at) values
    (mum, ama, 'data_processing', true, now_ts - interval '240 days'),
    (mum, ama, 'circle', true, now_ts - interval '240 days'),
    (mum, ama, 'court', false, now_ts - interval '240 days'),
    (mum, ama, 'court', true, now_ts - interval '120 days'),
    (mum, ama, 'mentor_dm', true, now_ts - interval '240 days'),
    (mum, ama, 'weekly_digest', true, now_ts - interval '240 days');

  -- ── enrolments & payments ───────────────────────────────────────────────────────────
  select id, price_pesewas into ic, price from public.programs where slug = 'inner-court';
  for girl in select unnest(array[ama, efua, naa, akosua, abena, yaa, akua, adwoa, esiq, nana]) loop
    insert into public.enrolments (parent_id, member_id, program_id, cohort, status, plan, started_at)
    values (coalesce((select parent_id from public.parent_links where child_id = girl and relationship = 'parent' limit 1), mum),
            girl, ic, '2026-27', 'active', case when girl in (ama, akua) then 'instalments' else 'full' end,
            now_ts - ((select extract(day from now_ts - created_at) from auth.users where id = girl) || ' days')::interval)
    returning id into enr;
    insert into public.payments (parent_id, enrolment_id, reference, amount_pesewas, channel, instalment_no, status, paid_at, due_at)
    select e.parent_id, enr, 'DEMO-' || substr(enr::text, 1, 8) || '-1', coalesce(price, 299900), 'mobile_money', 1, 'success', e.started_at, e.started_at
    from public.enrolments e where e.id = enr;
  end loop;
  -- A failed instalment and one due soon, for the recovery queue.
  insert into public.payments (parent_id, enrolment_id, reference, amount_pesewas, channel, instalment_no, status, due_at, created_at)
  select parent_id, id, 'DEMO-FAIL-' || substr(id::text, 1, 6), 100000, 'mobile_money', 2, 'failed', now_ts - interval '2 days', now_ts - interval '1 day'
  from public.enrolments where member_id = akua;
  insert into public.payments (parent_id, enrolment_id, reference, amount_pesewas, instalment_no, status, due_at)
  select parent_id, id, 'DEMO-DUE-' || substr(id::text, 1, 6), 100000, 2, 'pending', now_ts + interval '5 days'
  from public.enrolments where member_id = ama;

  -- ── progress: Months 1–2 done, Month 3 lessons 1–3 done, lesson 4 in progress ───────────────
  select id into m1 from public.modules where month_no = 1;
  select id into m2 from public.modules where month_no = 2;
  select id into m3 from public.modules where month_no = 3;

  -- Everyone who joined early finished months 1–2 (each has one opener lesson).
  insert into public.lesson_progress (member_id, lesson_id, completed_at, updated_at)
  select g, l.id, now_ts - interval '60 days', now_ts - interval '60 days'
  from unnest(array[ama, efua, naa, akosua, abena, akua, adwoa, esiq]) g
  cross join public.lessons l where l.module_id in (m1, m2);

  -- Month 3 funnel: most girls finish L1–L3, fewer L4+ (the drop-off the Palace chart shows).
  for les in select id, position from public.lessons where module_id = m3 order by position loop
    insert into public.lesson_progress (member_id, lesson_id, completed_at, updated_at)
    select g, les.id, now_ts - ((7 - les.position) || ' days')::interval, now_ts - ((7 - les.position) || ' days')::interval
    from unnest(case
      when les.position <= 2 then array[ama, efua, naa, akosua, abena, akua, adwoa, esiq]
      when les.position = 3 then array[ama, efua, naa, akosua, abena, akua, esiq]
      when les.position = 4 then array[efua, naa, akua]
      when les.position = 5 then array[efua]
      else array[]::uuid[] end) g;
  end loop;
  -- Ama is 8 minutes into lesson 4 (so "Continue where you left off" shows it).
  insert into public.lesson_progress (member_id, lesson_id, position_seconds, updated_at)
  select ama, id, 480, now_ts - interval '3 hours' from public.lessons where module_id = m3 and position = 4;
  -- A streak: activity on each of the last 11 days.
  insert into public.journal_entries (member_id, lesson_id, prompt, body, created_at)
  select ama, null, 'Daily reflection', 'Today I chose to be kind even when it was hard.', now_ts - (d || ' days')::interval
  from generate_series(0, 10) d;
  insert into public.journal_entries (member_id, prompt, body, shared_with_mentor, created_at) values
    (ama, 'Where did honesty cost you something this week?', 'I told my teacher I had not finished the reading. It was embarrassing, but I felt lighter.', true, now_ts - interval '1 day');

  -- Staff preview accounts get the same journey as Ama so the member view looks real.
  for staff in select id from public.profiles where role in ('admin', 'owner') loop
    insert into public.lesson_progress (member_id, lesson_id, completed_at, updated_at, position_seconds)
    select staff.id, lesson_id, completed_at, updated_at, position_seconds from public.lesson_progress where member_id = ama
    on conflict do nothing;
    insert into public.journal_entries (member_id, prompt, body, created_at)
    select staff.id, prompt, body, created_at from public.journal_entries where member_id = ama;
    update public.profiles set crown_level = 3 where id = staff.id;
  end loop;

  -- Badges & certificates.
  insert into public.member_badges (member_id, badge_id, earned_at)
  select g, b.id, now_ts - interval '60 days'
  from unnest(array[ama, efua, naa, akosua, abena, akua, adwoa, esiq]) g
  join public.badges b on b.slug in ('gracefulness', 'resilience');
  insert into public.member_badges (member_id, badge_id)
  select g, id from unnest(array[ama, efua]) g, public.badges where slug = 'first-testimony';
  insert into public.certificates (code, member_id, module_id, title, issued_at) values
    ('GG-3F82', ama, m1, 'Gracefulness', now_ts - interval '180 days'),
    ('GG-4B19', ama, m2, 'Resilience', now_ts - interval '150 days');
  insert into public.certificates (member_id, module_id, title, issued_at)
  select g, m, t, now_ts - interval '150 days'
  from unnest(array[efua, naa, akosua, abena, akua, adwoa, esiq]) g,
       (values (m1, 'Gracefulness'), (m2, 'Resilience')) v(m, t);
  for staff in select id from public.profiles where role in ('admin', 'owner') loop
    insert into public.member_badges (member_id, badge_id)
    select staff.id, badge_id from public.member_badges where member_id = ama on conflict do nothing;
    insert into public.certificates (member_id, module_id, title, issued_at)
    select staff.id, module_id, title, issued_at from public.certificates where member_id = ama;
  end loop;

  -- Intake and mid-point assessments (the before/after chart in The Gate).
  insert into public.assessments (member_id, phase, scores, taken_at) values
    (ama, 'intake', '{"gracefulness":48,"integrity":52,"resilience":44,"leadership":40,"spirituality":58,"confidence":38}', now_ts - interval '235 days'),
    (ama, 'mid',    '{"gracefulness":67,"integrity":75,"resilience":68,"leadership":61,"spirituality":77,"confidence":67}', now_ts - interval '20 days');

  -- ── community ────────────────────────────────────────────────────────────────────
  insert into public.posts (space_id, author_id, kind, body, status, approved_at, created_at) values
    (s_c4, efua, 'win', 'I told the truth about the test even though nobody would have known. It felt small and enormous at the same time.', 'approved', now_ts - interval '2 hours', now_ts - interval '2 hours')
    returning id into p_win;
  insert into public.posts (space_id, author_id, kind, body, status, approved_at, created_at) values
    (s_c4, adjoa, 'prayer', 'Circle 4 — I am praying over each of you by name this week. Reply with one word for what you need carried.', 'approved', now_ts - interval '5 hours', now_ts - interval '5 hours')
    returning id into p_prayer;
  insert into public.posts (space_id, author_id, kind, body, status, approved_at, created_at) values
    (s_c4, naa, 'books', 'Finished the book Mummy gave me at the drive. The chapter on choosing friends is the one I keep going back to.', 'approved', now_ts - interval '1 day', now_ts - interval '1 day')
    returning id into p_books;
  insert into public.posts (space_id, author_id, kind, body, status, approved_at, created_at) values
    (s_hall, adjoa, 'scripture', '“She is clothed with strength and dignity; she can laugh at the days to come.” — Proverbs 31:25. Which word in that verse is yours this week?', 'approved', now_ts - interval '3 hours', now_ts - interval '3 hours')
    returning id into p_hall;
  insert into public.posts (space_id, author_id, kind, body, status, approved_at, created_at) values
    (s_wins, abena, 'win', 'I led the prayer at assembly this morning. My hands were shaking but I did it!', 'approved', now_ts - interval '26 hours', now_ts - interval '26 hours'),
    (s_prayer, akua, 'prayer', 'Please pray for my grandmother. She is in the hospital in Kumasi.', 'approved', now_ts - interval '30 hours', now_ts - interval '30 hours'),
    (s_books, efua, 'books', 'Starting “The Hiding Place” by Corrie ten Boom this week. Anyone want to read along?', 'approved', now_ts - interval '3 days', now_ts - interval '3 days'),
    (s_c2, esi_m, 'general', 'Circle 2, our next mentor hour is Thursday. Bring one question you are afraid to ask out loud.', 'approved', now_ts - interval '8 hours', now_ts - interval '8 hours');

  -- The moderation queue from the designs.
  insert into public.posts (space_id, author_id, kind, body, status, queue_reason, moderation, created_at) values
    (s_c2, akosua, 'general', 'I don’t want to be here anymore, none of this is working and I am tired of all of it', 'pending', 'safety',
     '{"safety":true,"flagged":false,"categories":["self-harm (rules)"],"source":"rules"}', now_ts - interval '40 minutes')
    returning id into p_safety;
  insert into public.posts (space_id, author_id, kind, body, status, queue_reason, moderation, created_at) values
    (s_hall, yaa, 'general', 'Hi everyone! I just joined this week and I am a bit nervous but excited to be here.', 'pending', 'first_post',
     '{"safety":false,"flagged":false,"categories":[],"source":"rules"}', now_ts - interval '1 hour')
    returning id into p_first;
  insert into public.posts (space_id, author_id, kind, body, status, queue_reason, moderation, created_at, approved_at) values
    (s_wins, abena, 'general', 'Some of you are only here because your parents made you come. Just saying.', 'approved', null,
     '{"safety":false,"flagged":false,"categories":[],"source":"rules"}', now_ts - interval '3 hours', now_ts - interval '3 hours')
    returning id into p_rep;
  insert into public.reports (post_id, reporter_id, reason) values (p_rep, efua, 'unkind'), (p_rep, naa, 'unkind');   -- trigger moves it to the queue

  -- Reactions and replies.
  insert into public.reactions (post_id, user_id, kind)
  select p_win, u, 'crown' from unnest(array[ama, naa, abena, yaa, adjoa, akosua, akua, adwoa, esiq, nana, kafui, esi_m, mum, dad2]) u
  on conflict do nothing;
  insert into public.reactions (post_id, user_id, kind) values (p_win, ama, 'amen'), (p_win, naa, 'heart'), (p_prayer, ama, 'praying'), (p_prayer, efua, 'praying'), (p_prayer, naa, 'amen');
  insert into public.reactions (post_id, user_id, kind)
  select p_prayer, u, 'crown' from unnest(array[ama, efua, naa, abena, yaa, akua, adwoa, esiq, nana]) u on conflict do nothing;
  insert into public.reactions (post_id, user_id, kind)
  select p_books, u, 'crown' from unnest(array[ama, efua, abena, adjoa, akua, esiq]) u on conflict do nothing;
  insert into public.reactions (post_id, user_id, kind)
  select p_hall, u, 'heart' from unnest(array[ama, efua, naa, akua, esiq]) u on conflict do nothing;

  insert into public.replies (post_id, author_id, body, status, created_at) values
    (p_win, ama, 'This is so brave, Efua!', 'approved', now_ts - interval '100 minutes'),
    (p_win, adjoa, 'So proud of you. That is integrity when nobody is watching.', 'approved', now_ts - interval '90 minutes'),
    (p_win, naa, 'Amen to that!', 'approved', now_ts - interval '80 minutes'),
    (p_win, abena, 'Needed to read this today.', 'approved', now_ts - interval '70 minutes'),
    (p_win, yaa, 'Wow 👑', 'approved', now_ts - interval '60 minutes'),
    (p_prayer, ama, 'Courage', 'approved', now_ts - interval '4 hours'),
    (p_prayer, efua, 'Focus', 'approved', now_ts - interval '4 hours'),
    (p_prayer, naa, 'Peace', 'approved', now_ts - interval '3 hours'),
    (p_prayer, abena, 'Patience', 'approved', now_ts - interval '3 hours'),
    (p_prayer, akua, 'Healing', 'approved', now_ts - interval '2 hours'),
    (p_books, efua, 'Which book was it?', 'approved', now_ts - interval '20 hours'),
    (p_books, naa, '“Boundaries for Teens” — I recommend it!', 'approved', now_ts - interval '19 hours');

  -- A moderation history entry so the audit trail isn't empty.
  insert into public.moderation_actions (post_id, subject_id, moderator_id, action, note, created_at)
  values (p_win, efua, kafui, 'approve', 'First post — kind and on topic.', now_ts - interval '2 hours');

  -- ── live sessions ─────────────────────────────────────────────────────────────────
  insert into public.live_sessions (title, kind, circle_id, host_id, host_name, starts_at, jaas_room)
  values ('Circle 4 · Mentor hour', 'interactive', c4, adjoa, 'Adjoa Mensah (demo)',
          date_trunc('day', now_ts) + interval '19 hours' + case when extract(hour from now_ts) >= 20 then interval '1 day' else interval '0' end, 'gg-demo-circle-4')
  returning id into live_tonight;
  insert into public.live_sessions (title, kind, host_name, starts_at, youtube_id)
  values ('Dream Big speaker series', 'broadcast', 'Grace Nikoi (demo)', date_trunc('week', now_ts) + interval '5 days 16 hours'
          + case when now_ts > date_trunc('week', now_ts) + interval '5 days 16 hours' then interval '7 days' else interval '0' end, null)
  returning id into live_bcast;
  insert into public.live_sessions (title, kind, circle_id, host_id, host_name, starts_at, ends_at, jaas_room)
  values ('Circle 4 · Mentor hour', 'interactive', c4, adjoa, 'Adjoa Mensah (demo)', now_ts - interval '7 days', now_ts - interval '7 days' + interval '1 hour', 'gg-demo-circle-4-past')
  returning id into live_past;
  insert into public.live_sessions (title, kind, circle_id, host_id, host_name, starts_at, ends_at)
  values ('Circle 2 · Mentor hour', 'interactive', c2, esi_m, 'Esi Owusu (demo)', now_ts + interval '3 days' , null);
  insert into public.attendance (session_id, member_id, audio_only)
  select live_past, g, g in (akosua, yaa) from unnest(array[ama, efua, naa, abena, yaa]) g;
  -- Ten past sessions for the attendance line in The Gate (Ama attended 10 of 12).
  for i in 1..11 loop
    insert into public.live_sessions (title, kind, circle_id, host_name, starts_at, ends_at)
    values ('Circle 4 · Mentor hour', 'interactive', c4, 'Adjoa Mensah (demo)', now_ts - ((7 + i * 14) || ' days')::interval, now_ts - ((7 + i * 14) || ' days')::interval + interval '1 hour')
    returning id into live_past;
    if i not in (3, 4) then
      insert into public.attendance (session_id, member_id) values (live_past, ama);
    end if;
    insert into public.attendance (session_id, member_id) select live_past, g from unnest(array[efua, naa]) g;
  end loop;

  -- ── mentor messages ───────────────────────────────────────────────────────────────
  insert into public.dm_threads (member_id, mentor_id, created_at) values (ama, adjoa, now_ts - interval '10 days') returning id into thread;
  insert into public.dm_messages (thread_id, sender_id, body, created_at) values
    (thread, ama, 'Hi Aunty Adjoa, can I ask you something about the integrity lesson?', now_ts - interval '2 days 3 hours'),
    (thread, adjoa, 'Of course, Ama. Ask me anything.', now_ts - interval '2 days 2 hours'),
    (thread, ama, 'What if telling the truth makes my friend angry with me?', now_ts - interval '2 days 2 hours' + interval '3 minutes'),
    (thread, adjoa, 'That is a brave question. A real friend can be angry for a moment and still respect you. Let''s talk about it at mentor hour tonight?', now_ts - interval '2 days 1 hour'),
    (thread, ama, 'Okay. Thank you 🙏', now_ts - interval '2 days 58 minutes');

  -- ── inbox items ───────────────────────────────────────────────────────────────────
  insert into public.help_requests (member_id, body, status, created_at) values
    (naa, 'Some girls at school keep sending me messages at night and I don''t know what to do.', 'open', now_ts - interval '5 hours');
  insert into public.help_requests (member_id, body, status, handled_by, created_at) values
    (efua, 'I was feeling very anxious before exams.', 'closed', kafui, now_ts - interval '12 days');

  insert into public.contact_messages (name, email, phone, topic, subject, message, created_at) values
    ('Mrs Akosua Frimpong', 'akosua.frimpong@demo.gritandgrace.app', '+233 20 000 0011', 'inner-court', 'Enrolling twins', 'Good afternoon. I have twin daughters aged 11. Is there a discount for siblings, and can they be in the same Circle?', now_ts - interval '6 hours'),
    ('Pastor Emmanuel Tetteh', 'e.tetteh@demo.gritandgrace.app', null, 'crown-council', 'Crown Council 2027', 'Our church would like to bring 20 parents to the Crown Council. How do we book as a group?', now_ts - interval '2 days'),
    ('Maame Serwaa', 'maame.serwaa@demo.gritandgrace.app', '+233 55 000 0022', 'counselling', 'Counselling session', 'I would like to book a one-on-one session for my 15-year-old in Accra.', now_ts - interval '4 days');

  insert into public.announcements (author_id, title, body, audience, created_at) values
    (kafui, '[Demo] Month 3 — Integrity is live', 'Lesson 5, “Your integrity inventory”, unlocks on Friday. Bring it to your Circle''s mentor hour.', 'members', now_ts - interval '1 day');
end $$;
