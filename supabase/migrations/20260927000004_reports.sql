-- A report puts the post in front of a moderator; a second report hides it
-- until a person has looked. Reporters stay anonymous to the author.
create or replace function public.on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.post_id is null then return new; end if;
  select count(distinct reporter_id) into n from public.reports where post_id = new.post_id;
  update public.posts
     set queue_reason = case when queue_reason = 'safety' then 'safety'::public.queue_reason else 'reported'::public.queue_reason end,
         status = case when n >= 2 and status = 'approved' then 'pending'::public.post_status else status end
   where id = new.post_id and status <> 'removed';
  return new;
end $$;

create trigger reports_queue after insert on public.reports
  for each row execute function public.on_report();

-- The queue is everything pending, plus approved posts someone has reported.
create or replace view public.moderation_queue with (security_invoker = true) as
  select p.*, s.name as space_name, a.display_name as author_name, a.full_name as author_full_name,
         (select count(*) from public.reports r where r.post_id = p.id) as report_count
  from public.posts p
  join public.spaces s on s.id = p.space_id
  join public.profiles a on a.id = p.author_id
  where p.status = 'pending' or (p.status = 'approved' and p.queue_reason is not null);
grant select on public.moderation_queue to authenticated;

-- Parents may see the schedule their daughter is invited to (for the attendance line in The Gate).
create policy live_parent on public.live_sessions for select to authenticated
  using (exists (
    select 1 from public.parent_links l join public.profiles p on p.id = l.child_id
    where l.parent_id = auth.uid() and (live_sessions.circle_id is null or live_sessions.circle_id = p.circle_id)
  ));
