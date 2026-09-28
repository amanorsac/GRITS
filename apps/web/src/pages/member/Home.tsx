import { Link } from 'react-router';
import { Crown, Empty, ErrorBox, Icon, Loading, Status } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { greeting, timeAgo, unlockLabel, when } from '../../lib/format';
import { useLoad } from '../../lib/hooks';
import { sb } from '../../lib/supabase';
import { VALUE_LABEL, type LiveSession, type Post } from '../../lib/types';
import { lessonState, loadJourney } from './data';

type Badge = { slug: string; name: string };

export default function Home() {
  const { profile } = useAuth();
  const me = profile!;
  const { data, error, loading, reload } = useLoad(async () => {
    const [journey, streak, badges, live, spaces] = await Promise.all([
      loadJourney(me.id),
      sb().rpc('member_streak'),
      sb().from('member_badges').select('badges(slug, name)').eq('member_id', me.id),
      sb().from('live_sessions').select('*').gte('starts_at', new Date(Date.now() - 2 * 3600_000).toISOString()).order('starts_at').limit(1),
      sb().from('spaces').select('id, name, circle_id').not('circle_id', 'is', null).limit(1),
    ]);
    const circleSpace = (spaces.data ?? [])[0] as { id: string; name: string } | undefined;
    let posts: (Post & { author: string })[] = [];
    if (circleSpace) {
      const { data: ps } = await sb().from('posts').select('*').eq('space_id', circleSpace.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(2);
      const ids = [...new Set((ps ?? []).map((p) => p.author_id))];
      const { data: people } = ids.length ? await sb().from('public_profiles').select('id, display_name').in('id', ids) : { data: [] };
      const names = new Map((people ?? []).map((p) => [p.id, p.display_name]));
      posts = ((ps ?? []) as Post[]).map((p) => ({ ...p, author: names.get(p.author_id) ?? 'A member' }));
    }
    return {
      journey,
      streak: (streak.data as number) ?? 0,
      badges: ((badges.data ?? []) as unknown as { badges: Badge }[]).map((b) => b.badges),
      live: ((live.data ?? []) as LiveSession[])[0] ?? null,
      circle: circleSpace ?? null,
      posts,
    };
  }, [me.id]);

  if (loading) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  const { journey, streak, badges, live, circle, posts } = data;

  if (!journey.modules.length)
    return (
      <Empty>
        <Crown size={48} />
        <h2>Welcome, {me.display_name}</h2>
        <p>Your lessons appear here as soon as your enrolment is active. If your parent has just paid, give it a minute and refresh.</p>
      </Empty>
    );

  const cur = journey.current;
  const doneInMonth = journey.currentLessons.filter((l) => lessonState(l, journey.progress) === 'done').length;
  const valueName = cur?.value ? VALUE_LABEL[cur.value] : cur?.title;
  const r = journey.resume;
  const rp = r ? journey.progress.get(r.id) : undefined;
  const minsLeft = r?.duration_min ? Math.max(1, r.duration_min - Math.round((rp?.position_seconds ?? 0) / 60)) : null;
  const liveSoon = live && new Date(live.starts_at).getTime() - Date.now() < 12 * 3600_000;

  return (
    <div className="two-col">
      <div className="stack" style={{ gap: 20, display: 'flex', flexDirection: 'column' }}>
        <header>
          <h1 style={{ marginBottom: 4 }}>
            {greeting()}, {me.display_name}
          </h1>
          {cur && (
            <p className="muted" style={{ fontSize: '1.1rem' }}>
              Month {cur.month_no} of The Inner Court — {valueName}. {doneInMonth ? `You're ${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][doneInMonth] ?? doneInMonth} lesson${doneInMonth === 1 ? '' : 's'} in.` : 'A fresh month starts here.'}
            </p>
          )}
          <div className="row" style={{ gap: 24 }}>
            <div>
              <span className="stat">{streak}</span> <span className="stat-label">day streak</span>
            </div>
            <div>
              <span className="stat">{badges.length}</span> <span className="stat-label">badges</span>
            </div>
          </div>
        </header>

        {r && (
          <section className="card card-maroon">
            <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
              Continue where you left off
            </p>
            <h2 style={{ color: '#fff' }}>
              Lesson {r.position} · {r.title}
            </h2>
            <p className="muted">
              {minsLeft ? `${minsLeft} minutes left` : r.kind === 'devotional' ? 'Devotional + journal' : r.kind === 'assignment' ? 'Assignment · mentor reviews it' : 'Ready when you are'}
              {r.size_mb_480p && me.data_saver ? ` · 480p, about ${r.size_mb_480p} MB on mobile data` : ''}
            </p>
            {r.duration_min && (
              <div className="bar" style={{ margin: '12px 0 16px' }}>
                <i style={{ width: `${Math.min(100, Math.round(((rp?.position_seconds ?? 0) / 60 / r.duration_min) * 100))}%` }} />
              </div>
            )}
            <Link to={`/app/lesson/${r.id}`} className="btn btn-on-dark">
              <Icon name="play" size={18} /> Resume
            </Link>
          </section>
        )}

        {cur && (
          <section className="card">
            <div className="spread">
              <h3>This month — {valueName}</h3>
              <span className="muted">
                {doneInMonth} of {journey.currentLessons.length} lessons ·{' '}
                <Link to={`/app/academy/${cur.id}`}>See all</Link>
              </span>
            </div>
            <ul className="list">
              {journey.currentLessons.map((l) => {
                const st = lessonState(l, journey.progress);
                return (
                  <li key={l.id}>
                    <Link className="rowlink" to={st === 'locked' ? '#' : `/app/lesson/${l.id}`} aria-disabled={st === 'locked'}>
                      <div style={{ flex: 1 }}>
                        <strong>{l.title}</strong>
                        <div className="muted">
                          {l.kind === 'video' ? `Video · ${l.duration_min ?? '–'} min` : l.kind === 'devotional' ? 'Devotional + journal' : l.kind === 'assignment' ? 'Assignment · mentor reviews it' : 'Live session'}
                        </div>
                      </div>
                      {st === 'done' && <Status kind="complete">Done</Status>}
                      {st === 'progress' && <Status kind="progress">In progress</Status>}
                      {st === 'locked' && <Status kind="locked">{unlockLabel(l.unlock_at!)}</Status>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {circle && (
          <section className="card">
            <div className="spread">
              <h3>New in {circle.name}</h3>
              <Link to="/app/court">Open the Court</Link>
            </div>
            {posts.length === 0 ? (
              <p className="muted">Nothing new yet. Why not share a Win of the Week?</p>
            ) : (
              <ul className="list">
                {posts.map((p) => (
                  <li key={p.id}>
                    <div className="avatar">{p.author[0]}</div>
                    <div>
                      <strong>{p.author}</strong> {p.kind === 'win' ? 'shared a Win of the Week' : p.kind === 'prayer' ? 'posted a prayer request' : 'posted'}
                      <div className="muted">“{p.body.length > 120 ? p.body.slice(0, 120) + '…' : p.body}” · {timeAgo(p.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {live && (
          <section className="card card-soft">
            <p className="eyebrow">{live.is_live ? 'Live now' : liveSoon ? 'Live soon' : 'Next live session'}</p>
            <h3>{live.title}</h3>
            <p className="muted">
              {when(live.starts_at)} GMT{live.host_name ? ` · with ${live.host_name}` : ''}
            </p>
            <Link to={`/app/live/${live.id}`} className="btn btn-primary btn-block">
              Join the room
            </Link>
          </section>
        )}
        <section className="card" style={{ textAlign: 'center' }}>
          <h3>Your crown</h3>
          <div className="ring" style={{ ['--p' as string]: journey.journeyPct, margin: '12px auto' }}>
            <div>{journey.journeyPct}%</div>
          </div>
          <p className="muted">Through the 12-month journey. Crown Level {me.crown_level}.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            {badges.slice(0, 3).map((b) => (
              <span key={b.slug} className="chip">
                {b.name}
              </span>
            ))}
            {badges.length > 3 && <span className="chip">+{badges.length - 3} more</span>}
            {badges.length === 0 && <span className="muted">Your first badge comes with your first finished month.</span>}
          </div>
        </section>
      </aside>
    </div>
  );
}
