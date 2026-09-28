-- Grit & Grace — reference data. Prices stay null until the Academy supplies them;
-- the UI shows [PRICE] and checkout refuses to start without one.

-- Every Circle gets its own private space.
create or replace function public.circle_space() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.spaces (slug, name, circle_id, position)
  values ('circle-' || substr(new.id::text, 1, 8), new.name, new.id, 0);
  return new;
end $$;
create trigger circles_space after insert on public.circles
  for each row execute function public.circle_space();

insert into public.programs (slug, name, kind, summary, duration_label, instalments) values
  ('inner-court', 'The Inner Court', 'mentoring',
   'A year-long transformational mentoring journey through Gracefulness, Integrity, Resilience, Leadership and Spirituality. Monthly modules, live sessions, and a Circle of her own.',
   '12 months', 3),
  ('hershift', 'HerShift', 'intensive',
   'A shorter, intensive shift for girls at a turning point. Join the waitlist and be first to hear when the next cohort opens.',
   'Intensive', 1),
  ('royal-table', 'The Royal Table', 'event',
   'A father–daughter evening. One ticket covers them both — dinner, a keynote, and a conversation most families never quite get to.',
   'One evening', 1);
update public.programs set is_open = false where slug = 'hershift';

insert into public.spaces (slug, name, position) values
  ('great-hall', 'The Great Hall', 1),
  ('prayer', 'Prayer & Devotion', 2),
  ('wins', 'Wins & Testimonies', 3),
  ('books', 'Books We''re Reading', 4);

insert into public.badges (slug, name, description) values
  ('gracefulness', 'Gracefulness', 'Completed the Gracefulness month'),
  ('integrity', 'Integrity', 'Completed the Integrity month'),
  ('resilience', 'Resilience', 'Completed the Resilience month'),
  ('leadership', 'Leadership', 'Completed the Leadership month'),
  ('spirituality', 'Spirituality', 'Completed the Spirituality month'),
  ('first-testimony', 'First Testimony', 'Shared a first Win of the Week'),
  ('streak-30', '30-day streak', 'Showed up thirty days running');

with c as (
  insert into public.courses (program_id, slug, title, summary)
  select id, 'inner-court', 'The Inner Court', 'Twelve months. Five values. One Circle.'
  from public.programs where slug = 'inner-court'
  returning id
)
insert into public.modules (course_id, month_no, value, title, summary)
select c.id, m.month_no, m.value::public.value_key, m.title, m.summary from c, (values
  (1,  'gracefulness', 'Gracefulness',              'Carrying herself well — posture, speech, presence.'),
  (2,  'resilience',   'Resilience',                'Getting back up — failure, feedback and starting again.'),
  (3,  'integrity',    'Integrity',                 'Who she is unwatched.'),
  (4,  'leadership',   'Leadership',                'Going first — in class, at home, among friends.'),
  (5,  'spirituality', 'Spirituality',              'Rooted in who God says she is.'),
  (6,  'integrity',    'Friendship & Discernment',  'Choosing friends, filtering wisely.'),
  (7,  'resilience',   'Emotions & Self-worth',     'Naming what she feels without being ruled by it.'),
  (8,  'leadership',   'Voice & Confidence',        'Speaking up, and speaking well.'),
  (9,  'spirituality', 'Purpose & Calling',         'What she is here to build.'),
  (10, 'leadership',   'Stewardship',               'Time, money and gifts.'),
  (11, 'integrity',    'Digital Wisdom',            'Discernment online is a survival skill.'),
  (12, 'gracefulness', 'Crowned',                   'Commissioning — the year gathered up.')
) as m(month_no, value, title, summary);

-- Month 3 carries the full lesson set from the designs; the rest get a
-- placeholder opener the Academy replaces as content is filmed.
insert into public.lessons (module_id, position, kind, title, summary, journal_prompt, duration_min, size_mb_480p)
select m.id, l.position, l.kind::public.lesson_kind, l.title, l.summary, l.prompt, l.duration, l.size
from public.modules m
join public.courses c on c.id = m.course_id and c.slug = 'inner-court'
cross join (values
  (1, 'video',      'What integrity actually costs',  'Why the honest choice is rarely free — and why that is the point.', 'When did telling the truth cost you something?', 16, 14),
  (2, 'devotional', 'The parable of the ten virgins', 'A devotional on readiness, and on the oil nobody can lend you.', 'What are you preparing for that nobody else can prepare for you?', null, null),
  (3, 'video',      'Small lies, big cracks',         'How the little untruths add up.', 'Is there a small lie you tell often?', 12, 10),
  (4, 'video',      'When nobody is watching',        'Integrity is not what you do when the room is full. Grace walks through three moments from her own week where the honest choice cost her something small — and why that mattered more than the thing she gave up.', 'Where did honesty cost you something this week?', 22, 18),
  (5, 'assignment', 'Your integrity inventory',       'An honest look at your week. Your mentor reviews it.', 'List three places you were tempted to cut a corner.', null, null),
  (6, 'live',       'Circle mentor hour',             'Bring your inventory. We talk it through together.', null, 60, null)
) as l(position, kind, title, summary, prompt, duration, size)
where m.month_no = 3;

insert into public.lessons (module_id, position, kind, title, summary, journal_prompt, duration_min)
select m.id, 1, 'video', 'Welcome to ' || m.title, '[CONTENT] Opening lesson for Month ' || m.month_no || '. Replace with the filmed lesson.', 'What do you hope this month changes in you?', 10
from public.modules m join public.courses c on c.id = m.course_id and c.slug = 'inner-court'
where m.month_no <> 3;
