-- Staff can walk through lessons as a member would (preview), including "Mark as done".
create or replace function public.complete_lesson(p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_module uuid; v_value public.value_key; v_title text; v_total int; v_done int; v_cert text; v_badge uuid;
begin
  if not (public.has_active_enrolment(auth.uid()) or public.is_staff()) then raise exception 'not enrolled'; end if;
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

-- Purge also clears preview progress that demo seeding gave to staff accounts.
create or replace function public.purge_demo() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.live_sessions where circle_id in (select id from public.circles where cohort = 'demo') or host_name like '%(demo)%';
  delete from public.circles where cohort = 'demo';
  delete from public.contact_messages where email like '%@demo.gritandgrace.app';
  delete from public.announcements where title like '[Demo]%';
  delete from public.lesson_progress where member_id in (select id from public.profiles where role in ('admin', 'owner'));
  delete from public.journal_entries where member_id in (select id from public.profiles where role in ('admin', 'owner'));
  delete from public.member_badges where member_id in (select id from public.profiles where role in ('admin', 'owner'));
  delete from public.certificates where member_id in (select id from public.profiles where role in ('admin', 'owner'));
  update public.profiles set circle_id = null, crown_level = 1 where role in ('admin', 'owner');
  -- References that deliberately don't cascade (audit trail) — clear them for demo people only.
  delete from public.moderation_actions where moderator_id in (select id from auth.users where email like '%@demo.gritandgrace.app')
                                            or subject_id in (select id from auth.users where email like '%@demo.gritandgrace.app');
  update public.help_requests set handled_by = null where handled_by in (select id from auth.users where email like '%@demo.gritandgrace.app');
  update public.member_permissions set updated_by = null where updated_by in (select id from auth.users where email like '%@demo.gritandgrace.app');
  update public.join_codes set used_by = null where used_by in (select id from auth.users where email like '%@demo.gritandgrace.app');
  delete from auth.users where email like '%@demo.gritandgrace.app';
  get diagnostics n = row_count;
  return jsonb_build_object('removed_people', n);
end $$;
