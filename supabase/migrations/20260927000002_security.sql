-- Grit & Grace — row-level security, helper functions and RPCs.
-- Rule of thumb: clients read through RLS; anything that creates trust
-- (approving a post, granting a permission, marking a payment) is a function
-- that checks the caller, or the Worker with the service role.

-- ─────────────────────────────────────────────────────────── helpers
create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('mentor','moderator','admin','owner') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('moderator','admin','owner') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','owner') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_parent_of(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parent_links where parent_id = auth.uid() and child_id = p_child)
$$;

create or replace function public.is_mentor_of(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.circles c on c.id = p.circle_id
    where p.id = p_member and c.mentor_id = auth.uid()
  )
$$;

create or replace function public.has_active_enrolment(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments where member_id = p_member and status = 'active')
$$;

-- Lessons: enrolled girls, their parents, and staff.
create or replace function public.has_content_access() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or public.has_active_enrolment(auth.uid())
      or exists (
        select 1 from public.parent_links l join public.enrolments e on e.member_id = l.child_id
        where l.parent_id = auth.uid() and e.status = 'active'
      )
$$;

-- Spaces: circle spaces need the circle permission and membership; the open
-- Court needs the court permission. Parents are not in the community at all.
create or replace function public.can_access_space(p_space uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_moderator() then true
    else exists (
      select 1
      from public.spaces s
      join public.profiles me on me.id = auth.uid()
      left join public.member_permissions mp on mp.member_id = me.id
      left join public.circles c on c.id = s.circle_id
      where s.id = p_space and (
        (s.circle_id is not null and (
            c.mentor_id = me.id
            or (me.circle_id = s.circle_id and coalesce(mp.circle, false))
        ))
        or (s.circle_id is null and (
            me.role = 'mentor'
            or (me.role = 'member' and coalesce(mp.court, false))
        ))
      )
    )
  end
$$;

create or replace function public.is_blocked(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_author)
$$;

-- ─────────────────────────────────────────────────────────── new users
-- Role comes from app_metadata, which only the service role can set.
-- A self sign-up is always a parent.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, display_name, username, phone, email, age_band, birth_year)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'parent'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
    nullif(new.raw_app_meta_data ->> 'username', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    new.email,
    nullif(new.raw_app_meta_data ->> 'age_band', '')::public.age_band,
    nullif(new.raw_app_meta_data ->> 'birth_year', '')::int
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Safe public projection of a person for feeds and rosters.
create view public.public_profiles as
  select id, display_name, role, crown_level, circle_id from public.profiles;
grant select on public.public_profiles to authenticated;

-- ─────────────────────────────────────────────────────────── enable RLS
do $$
declare t text;
begin
  foreach t in array array[
    'circles','profiles','parent_links','join_codes','member_permissions','consents',
    'programs','enrolments','payments','waitlist','courses','modules','lessons',
    'lesson_progress','journal_entries','badges','member_badges','certificates','assessments',
    'spaces','posts','replies','reactions','reports','moderation_actions','blocks',
    'help_requests','dm_threads','dm_messages','live_sessions','attendance','announcements',
    'account_deletion_requests','keepalive'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────── policies
-- circles
create policy circles_read on public.circles for select to authenticated
  using (public.is_staff() or id = (select circle_id from public.profiles where id = auth.uid())
         or exists (select 1 from public.parent_links l join public.profiles p on p.id = l.child_id
                    where l.parent_id = auth.uid() and p.circle_id = circles.id));
create policy circles_admin on public.circles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_self on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.is_parent_of(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.profiles from authenticated;
grant update (display_name, data_saver, push_token) on public.profiles to authenticated;
grant update (role, circle_id, crown_level, timed_out_until, full_name) on public.profiles to authenticated; -- gated by profiles_admin
-- The self policy would otherwise let anyone change these columns on themselves:
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null and (
       new.role is distinct from old.role or new.circle_id is distinct from old.circle_id
    or new.crown_level is distinct from old.crown_level or new.timed_out_until is distinct from old.timed_out_until
    or new.full_name is distinct from old.full_name) then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- parent_links
create policy parent_links_read on public.parent_links for select to authenticated
  using (parent_id = auth.uid() or child_id = auth.uid() or public.is_staff());

-- join_codes
create policy join_codes_read on public.join_codes for select to authenticated
  using (parent_id = auth.uid() or public.is_admin());

-- member_permissions
create policy perms_read on public.member_permissions for select to authenticated
  using (member_id = auth.uid() or public.is_parent_of(member_id) or public.is_staff());

-- consents (append-only, written by RPC / Worker)
create policy consents_read on public.consents for select to authenticated
  using (parent_id = auth.uid() or public.is_admin());

-- programs are public
create policy programs_read on public.programs for select to anon, authenticated using (true);
create policy programs_admin on public.programs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- enrolments & payments
create policy enrolments_read on public.enrolments for select to authenticated
  using (parent_id = auth.uid() or member_id = auth.uid() or public.is_admin());
create policy payments_read on public.payments for select to authenticated
  using (parent_id = auth.uid() or public.is_admin());

-- waitlist: anyone may join, only admins read
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);
create policy waitlist_read on public.waitlist for select to authenticated using (public.is_admin());

-- teaching content
create policy courses_read on public.courses for select to authenticated using (public.has_content_access());
create policy modules_read on public.modules for select to authenticated using (public.has_content_access());
create policy lessons_read on public.lessons for select to authenticated using (public.has_content_access());
create policy courses_admin on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy modules_admin on public.modules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lessons_admin on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- progress
create policy progress_own on public.lesson_progress for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy progress_watchers on public.lesson_progress for select to authenticated
  using (public.is_parent_of(member_id) or public.is_mentor_of(member_id) or public.is_admin());

-- journal: hers alone; her mentor only when she shares. Parents never.
create policy journal_own on public.journal_entries for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy journal_mentor on public.journal_entries for select to authenticated
  using (shared_with_mentor and public.is_mentor_of(member_id));

-- badges & certificates
create policy badges_read on public.badges for select to authenticated using (true);
create policy member_badges_read on public.member_badges for select to authenticated using (true);
create policy certificates_read on public.certificates for select to authenticated
  using (member_id = auth.uid() or public.is_parent_of(member_id) or public.is_staff());
create policy assessments_read on public.assessments for select to authenticated
  using (member_id = auth.uid() or public.is_parent_of(member_id) or public.is_staff());
create policy assessments_staff on public.assessments for insert to authenticated with check (public.is_staff());

-- community
create policy spaces_read on public.spaces for select to authenticated using (public.can_access_space(id));
create policy spaces_admin on public.spaces for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy posts_read on public.posts for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_moderator()
    or (status = 'approved' and public.can_access_space(space_id) and not public.is_blocked(author_id))
  );
-- No insert/update policy: posts are written by the Worker after moderation.

create policy replies_read on public.replies for select to authenticated
  using (
    author_id = auth.uid() or public.is_moderator()
    or (status = 'approved' and exists (select 1 from public.posts p where p.id = post_id and p.status = 'approved' and public.can_access_space(p.space_id)))
  );

create policy reactions_read on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.can_access_space(p.space_id)));
create policy reactions_write on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.status = 'approved' and public.can_access_space(p.space_id)));
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select to authenticated using (public.is_moderator());

create policy mod_actions_read on public.moderation_actions for select to authenticated using (public.is_moderator());

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy help_insert on public.help_requests for insert to authenticated with check (member_id = auth.uid());
create policy help_read on public.help_requests for select to authenticated using (member_id = auth.uid() or public.is_moderator());
create policy help_update on public.help_requests for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- mentor DMs: she starts it, only with her own Circle's mentor, only if her parent allows it
create policy dm_threads_read on public.dm_threads for select to authenticated
  using (member_id = auth.uid() or mentor_id = auth.uid() or public.is_admin());
create policy dm_threads_start on public.dm_threads for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (select 1 from public.member_permissions mp where mp.member_id = auth.uid() and mp.mentor_dm)
    and exists (select 1 from public.profiles p join public.circles c on c.id = p.circle_id
                where p.id = auth.uid() and c.mentor_id = dm_threads.mentor_id)
  );
create policy dm_messages_read on public.dm_messages for select to authenticated
  using (exists (select 1 from public.dm_threads t where t.id = thread_id and (t.member_id = auth.uid() or t.mentor_id = auth.uid()))
         or public.is_admin());
create policy dm_messages_send on public.dm_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from public.dm_threads t where t.id = thread_id and (t.member_id = auth.uid() or t.mentor_id = auth.uid())));

-- live
create policy live_read on public.live_sessions for select to authenticated
  using (
    public.is_staff()
    or (kind = 'broadcast' and public.has_active_enrolment(auth.uid()))
    or (circle_id is not null and circle_id = (select circle_id from public.profiles where id = auth.uid()))
    or (circle_id is null and public.has_active_enrolment(auth.uid()))
  );
create policy live_staff on public.live_sessions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy attendance_own on public.attendance for insert to authenticated with check (member_id = auth.uid());
create policy attendance_read on public.attendance for select to authenticated
  using (member_id = auth.uid() or public.is_parent_of(member_id) or public.is_staff());

create policy announcements_read on public.announcements for select to authenticated using (true);
create policy announcements_admin on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy deletion_own on public.account_deletion_requests for insert to authenticated with check (user_id = auth.uid());
create policy deletion_read on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────── RPCs
-- A parent switches one of her daughter's permissions. Always ledgered.
create or replace function public.set_member_permission(p_child uuid, p_scope text, p_granted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(p_child) then raise exception 'not your child'; end if;
  if p_scope not in ('circle', 'court', 'mentor_dm') then raise exception 'unknown scope'; end if;
  insert into public.member_permissions (member_id) values (p_child) on conflict do nothing;
  execute format('update public.member_permissions set %I = $1, updated_by = $2, updated_at = now() where member_id = $3', p_scope)
    using p_granted, auth.uid(), p_child;
  insert into public.consents (parent_id, child_id, scope, granted) values (auth.uid(), p_child, p_scope, p_granted);
end $$;

-- Every moderation action needs a note. Safety items can only leave the
-- queue through a documented approve/remove/escalate.
create or replace function public.moderate_post(p_post uuid, p_action public.mod_action, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if not public.is_moderator() then raise exception 'moderators only'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 3 then raise exception 'a note is required'; end if;
  select author_id into v_author from public.posts where id = p_post;
  if v_author is null then raise exception 'post not found'; end if;

  insert into public.moderation_actions (post_id, subject_id, moderator_id, action, note)
  values (p_post, v_author, auth.uid(), p_action, p_note);

  if p_action = 'approve' then
    update public.posts set status = 'approved', approved_at = now(), queue_reason = null where id = p_post;
  elsif p_action = 'remove' then
    update public.posts set status = 'removed', queue_reason = null where id = p_post;
  elsif p_action = 'timeout' then
    update public.posts set status = 'removed', queue_reason = null where id = p_post;
    update public.profiles set timed_out_until = now() + interval '24 hours' where id = v_author;
  elsif p_action = 'escalate' then
    update public.posts set queue_reason = 'safety' where id = p_post;
    insert into public.help_requests (member_id, body, status)
    values (v_author, 'Escalated from moderation: ' || p_note, 'escalated');
  end if;
  -- 'warn' records the action and leaves the post where it is.
end $$;

-- Mark a lesson done; award the module badge and certificate when the month is complete.
create or replace function public.complete_lesson(p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_module uuid; v_value public.value_key; v_title text; v_total int; v_done int; v_cert text; v_badge uuid;
begin
  if not public.has_active_enrolment(auth.uid()) then raise exception 'not enrolled'; end if;
  insert into public.lesson_progress (member_id, lesson_id, completed_at, updated_at)
  values (auth.uid(), p_lesson, now(), now())
  on conflict (member_id, lesson_id) do update set completed_at = coalesce(lesson_progress.completed_at, now()), updated_at = now();

  select l.module_id, m.value, m.title into v_module, v_value, v_title
  from public.lessons l join public.modules m on m.id = l.module_id where l.id = p_lesson;
  select count(*) into v_total from public.lessons where module_id = v_module;
  select count(*) into v_done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.member_id = auth.uid() and l.module_id = v_module and lp.completed_at is not null;

  if v_total > 0 and v_done = v_total then
    select id into v_badge from public.badges where slug = v_value::text;
    if v_badge is not null then
      insert into public.member_badges (member_id, badge_id) values (auth.uid(), v_badge) on conflict do nothing;
    end if;
    insert into public.certificates (member_id, module_id, title)
    select auth.uid(), v_module, v_title
    where not exists (select 1 from public.certificates where member_id = auth.uid() and module_id = v_module)
    returning code into v_cert;
    update public.profiles set crown_level = 1 + (select count(*) from public.certificates where member_id = auth.uid())
      where id = auth.uid();
  end if;
  return jsonb_build_object('done', v_done, 'total', v_total, 'certificate', v_cert);
end $$;

-- Parents may know that her journal exists, never what is in it.
create or replace function public.journal_count(p_child uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_parent_of(p_child) or p_child = auth.uid()
    then (select count(*)::int from public.journal_entries where member_id = p_child) else 0 end
$$;

-- Anyone can check a certificate code.
create or replace function public.verify_certificate(p_code text)
returns table (title text, member_name text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.title, p.full_name, c.issued_at from public.certificates c
  join public.profiles p on p.id = c.member_id where c.code = upper(p_code)
$$;
grant execute on function public.verify_certificate(text) to anon;

-- Streak = consecutive days (up to today) with any lesson activity. Shown to her, never ranked.
create or replace function public.member_streak(p_member uuid default null) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_member uuid := coalesce(p_member, auth.uid()); n int := 0; d date := current_date;
begin
  if not (v_member = auth.uid() or public.is_parent_of(v_member) or public.is_staff()) then return 0; end if;
  -- Today without activity yet does not break the streak.
  if not exists (select 1 from public.lesson_progress where member_id = v_member and updated_at::date = d)
     and not exists (select 1 from public.journal_entries where member_id = v_member and created_at::date = d) then
    d := d - 1;
  end if;
  while exists (select 1 from public.lesson_progress where member_id = v_member and updated_at::date = d)
     or exists (select 1 from public.journal_entries where member_id = v_member and created_at::date = d) loop
    n := n + 1; d := d - 1;
  end loop;
  return n;
end $$;

-- The Palace overview in one round trip.
create or replace function public.palace_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select jsonb_build_object(
    'active_members', (select count(*) from public.enrolments where status = 'active'),
    'new_this_week', (select count(*) from public.enrolments where status = 'active' and started_at > now() - interval '7 days'),
    'awaiting_moderation', (select count(*) from public.posts where status = 'pending'),
    'oldest_pending_minutes', (select coalesce(extract(epoch from now() - min(created_at)) / 60, 0)::int from public.posts where status = 'pending'),
    'safety_open', (select count(*) from public.posts where status = 'pending' and queue_reason = 'safety'),
    'quiet_14_days', (select count(*) from public.enrolments e where e.status = 'active' and not exists (
        select 1 from public.lesson_progress lp where lp.member_id = e.member_id and lp.updated_at > now() - interval '14 days')),
    'failed_payments', (select count(*) from public.payments where status = 'failed' and created_at > date_trunc('month', now())),
    'collected_pesewas', (select coalesce(sum(amount_pesewas), 0) from public.payments where status = 'success' and paid_at > date_trunc('month', now())),
    'due_pesewas', (select coalesce(sum(amount_pesewas), 0) from public.payments where status = 'pending' and due_at is not null),
    'open_help', (select count(*) from public.help_requests where status in ('open', 'escalated')),
    'consent_pending', (select count(*) from public.join_codes where used_by is null and expires_at > now()),
    'live_attendance_pct', (
      select case when count(distinct s.id) = 0 then null else round(100.0 * count(a.member_id) /
        nullif(count(distinct s.id) * greatest((select count(*) from public.enrolments where status = 'active'), 1), 0))::int end
      from public.live_sessions s left join public.attendance a on a.session_id = s.id
      where s.starts_at between now() - interval '30 days' and now())
  ) into r;
  return r;
end $$;

-- Completion by lesson for a module — where girls are dropping off.
create or replace function public.module_funnel(p_module uuid)
returns table (lesson_position int, title text, pct int)
language sql stable security definer set search_path = public as $$
  select l.position, l.title,
    case when (select count(*) from public.enrolments where status = 'active') = 0 then 0 else
      round(100.0 * count(lp.completed_at) / (select count(*) from public.enrolments where status = 'active'))::int end
  from public.lessons l left join public.lesson_progress lp on lp.lesson_id = l.id and lp.completed_at is not null
  where l.module_id = p_module and public.is_staff()
  group by l.id order by l.position
$$;

-- Realtime for the feed and mentor messages.
do $$ begin
  alter publication supabase_realtime add table public.posts, public.dm_messages;
exception when others then null; end $$;
