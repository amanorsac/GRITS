import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Crown, Empty, ErrorBox, Icon, Loading, Status } from '../../components/ui';
import { api } from '../../lib/api';
import { isAdmin, isModerator, useAuth } from '../../lib/auth';
import { ghs, initials, timeAgo, when } from '../../lib/format';
import { must, useLoad } from '../../lib/hooks';
import { sb } from '../../lib/supabase';
import type { Lesson, LiveSession, Module, Payment, Program } from '../../lib/types';

type Overview = {
  active_members: number;
  new_this_week: number;
  awaiting_moderation: number;
  oldest_pending_minutes: number;
  safety_open: number;
  quiet_14_days: number;
  failed_payments: number;
  collected_pesewas: number;
  due_pesewas: number;
  open_help: number;
  consent_pending: number;
  live_attendance_pct: number | null;
};

export function PalaceLayout() {
  const { profile, signOut } = useAuth();
  const { data } = useLoad(async () => must(await sb().rpc('palace_overview')) as Overview);
  const nav: [string, string, string, number?, boolean?][] = [
    ['/palace', 'grid', 'Overview', undefined, true],
    ['/palace/members', 'users', 'Members'],
    ['/palace/content', 'book', 'Course studio'],
    ['/palace/moderation', 'court', 'Community', data?.awaiting_moderation],
    ['/palace/live', 'live', 'Live sessions'],
    ['/palace/commerce', 'money', 'Commerce'],
    ['/palace/help', 'help', 'Inbox', data?.open_help],
    ['/palace/people', 'shield', 'People & access'],
  ];
  const website: [string, string, string][] = [
    ['/palace/website', 'home', 'Website'],
    ['/palace/journal', 'journal', 'Journal'],
    ['/palace/events', 'bell', 'Events'],
    ['/palace/gallery', 'grid', 'Gallery'],
    ['/palace/media', 'file', 'Media library'],
  ];
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Admin">
        <Link to="/palace" className="brand">
          <Crown size={28} /> The Palace
        </Link>
        {nav.map(([to, icon, label, count, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
            <Icon name={icon} /> <span>{label}</span>
            {!!count && <span className="count">{count}</span>}
          </NavLink>
        ))}
        <div className="section">Public site</div>
        {website.map(([to, icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav extra${isActive ? ' active' : ''}`}>
            <Icon name={icon} /> <span>{label}</span>
          </NavLink>
        ))}
        <div className="section">Preview</div>
        <Link to="/app" className="nav extra">
          <Icon name="users" /> <span>Member view</span>
        </Link>
        <Link to="/gate" className="nav extra">
          <Icon name="gate" /> <span>Parent view</span>
        </Link>
        <Link to="/" className="nav extra">
          <Icon name="home" /> <span>Public site</span>
        </Link>
        <div className="foot">
          <div className="avatar gold">{initials(profile?.full_name || profile?.display_name || '')}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{profile?.display_name || profile?.full_name}</div>
            <div style={{ fontSize: '.85rem', color: '#e8bccb', textTransform: 'capitalize' }}>{profile?.role}</div>
          </div>
          <button className="nav" style={{ width: 44, padding: 0, justifyContent: 'center' }} onClick={signOut} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PalaceOverview() {
  const { data, error, loading, reload } = useLoad(async () => {
    const o = must(await sb().rpc('palace_overview')) as Overview;
    const mods = must(await sb().from('modules').select('*').order('month_no')) as Module[];
    const now = new Date();
    const current = mods.find((m) => !m.unlock_at || new Date(m.unlock_at) <= now) ?? mods[0];
    const funnel = current ? ((must(await sb().rpc('module_funnel', { p_module: current.id })) ?? []) as { lesson_position: number; pct: number }[]) : [];
    const next = must(await sb().from('live_sessions').select('*').gte('starts_at', now.toISOString()).order('starts_at').limit(3)) as LiveSession[];
    const empty = must(await sb().from('lessons').select('id, title, unlock_at').eq('kind', 'video').is('bunny_video_id', null).limit(50)) as Pick<Lesson, 'id' | 'title' | 'unlock_at'>[];
    return { o, current, funnel, next, emptyVideos: empty };
  });
  if (loading) return <Loading lines={8} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  const { o, current, funnel, next, emptyVideos } = data;
  const worst = funnel.reduce<{ lesson_position: number; drop: number } | null>((acc, f, i) => {
    const drop = i === 0 ? 0 : funnel[i - 1].pct - f.pct;
    return !acc || drop > acc.drop ? { lesson_position: f.lesson_position, drop } : acc;
  }, null);

  const needs: [string, 'safety' | 'attention' | 'progress', string, string][] = [];
  if (o.safety_open) needs.push(['Safety', 'safety', `${o.safety_open} post${o.safety_open === 1 ? '' : 's'} flagged as possible risk of harm`, '/palace/moderation']);
  if (o.open_help) needs.push(['Talk to someone', 'safety', `${o.open_help} private message${o.open_help === 1 ? '' : 's'} waiting for an adult`, '/palace/help']);
  if (o.failed_payments) needs.push(['Payment', 'attention', `${o.failed_payments} payment${o.failed_payments === 1 ? '' : 's'} failed this month — retry or message`, '/palace/commerce']);
  if (o.consent_pending) needs.push(['Consent', 'attention', `${o.consent_pending} join code${o.consent_pending === 1 ? '' : 's'} not yet redeemed`, '/palace/members']);
  const soonEmpty = emptyVideos.filter((l) => l.unlock_at && new Date(l.unlock_at).getTime() - Date.now() < 7 * 86_400_000);
  if (soonEmpty.length) needs.push(['Content', 'progress', `${soonEmpty.length} lesson${soonEmpty.length === 1 ? '' : 's'} unlock within a week with no video`, '/palace/content']);

  return (
    <>
      <div className="spread">
        <div>
          <h1>Overview</h1>
          <p className="muted">2026–27 cohort</p>
        </div>
        <div className="row">
          <Link className="btn btn-secondary" to="/palace/people#announce">
            New announcement
          </Link>
          <Link className="btn btn-primary" to="/palace/live">
            Go live now
          </Link>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', margin: '16px 0 24px' }}>
        {[
          ['Active members', o.active_members, `+${o.new_this_week} this week`],
          ['Live attendance', o.live_attendance_pct == null ? '—' : `${o.live_attendance_pct}%`, 'last 30 days'],
          ['Quiet 14+ days', o.quiet_14_days, 'needs a nudge'],
          ['Awaiting moderation', o.awaiting_moderation, o.awaiting_moderation ? `oldest ${o.oldest_pending_minutes} min` : 'all clear'],
        ].map(([label, v, sub]) => (
          <div key={label as string} className="card">
            <div className="stat-label">{label}</div>
            <div className="stat" style={{ margin: '6px 0' }}>
              {v}
            </div>
            <div className="muted small">{sub}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card">
            <h3>Where girls are dropping off</h3>
            <p className="muted">completion by lesson, Month {current?.month_no} — {current?.title}</p>
            {funnel.length ? (
              <>
                <div className="bars" role="img" aria-label="Completion by lesson">
                  {funnel.map((f) => (
                    <div key={f.lesson_position}>
                      <span>{f.pct}%</span>
                      <i className={f.pct < 50 ? 'low' : ''} style={{ height: `${Math.max(2, f.pct)}%` }} />
                      <span className="muted">L{f.lesson_position}</span>
                    </div>
                  ))}
                </div>
                {worst && worst.drop > 15 && (
                  <p style={{ marginTop: 12 }}>
                    Lesson {worst.lesson_position} loses {worst.drop} points of the cohort. That is where the content needs work, not the girls.
                  </p>
                )}
              </>
            ) : (
              <Empty>No lessons yet.</Empty>
            )}
          </section>
          <section className="card">
            <h3>Needs you</h3>
            {needs.length === 0 ? (
              <p className="muted">Nothing waiting. Good week.</p>
            ) : (
              <ul className="list">
                {needs.map(([label, kind, text, to]) => (
                  <li key={label + text}>
                    <Status kind={kind}>{label}</Status>
                    <Link to={to} style={{ flex: 1 }}>
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card">
            <h3>This month</h3>
            <div className="spread">
              <span>Collected</span>
              <strong>{ghs(o.collected_pesewas)}</strong>
            </div>
            <div className="spread">
              <span>Instalments due</span>
              <strong>{ghs(o.due_pesewas)}</strong>
            </div>
            <div className="spread">
              <span>Failed payments</span>
              <strong>{o.failed_payments}</strong>
            </div>
            <Link to="/palace/commerce" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>
              Open recovery queue
            </Link>
          </section>
          <section className="card">
            <h3>Next up</h3>
            {next.length === 0 && <p className="muted">Nothing scheduled.</p>}
            <ul className="list">
              {next.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.title}</strong>
                    <div className="muted">
                      {when(s.starts_at)}
                      {s.host_name ? ` · ${s.host_name}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <DemoDataCard />
        </aside>
      </div>
    </>
  );
}

/** Sample people/posts for presentations. Removing them is one click and cannot touch real families. */
function DemoDataCard() {
  const { profile } = useAuth();
  const { data, reload } = useLoad(async () => {
    const { count } = await sb().from('profiles').select('id', { count: 'exact', head: true }).like('email', '%@demo.gritandgrace.app');
    return count ?? 0;
  });
  const [msg, setMsg] = useState<string | null>(null);
  if (!isAdmin(profile) || !data) return null;
  async function purge() {
    if (!confirm('Remove all demo girls, parents, mentors, posts, sessions and messages? Real accounts are not touched. This cannot be undone.')) return;
    const { error } = await sb().rpc('purge_demo');
    setMsg(error ? error.message : 'Demo data removed. The platform is ready for real families.');
    reload();
  }
  return (
    <section className="card" style={{ borderStyle: 'dashed' }}>
      <p className="eyebrow">Demo mode</p>
      <p style={{ marginTop: 0 }}>
        {data} sample people and their posts, progress and sessions are showing so the platform looks lived-in. They cannot sign in.
      </p>
      {msg && <p className="notice">{msg}</p>}
      <button className="btn btn-danger btn-block" onClick={purge}>
        Remove demo data
      </button>
    </section>
  );
}

type QueueItem = {
  id: string;
  body: string;
  kind: string;
  status: string;
  queue_reason: 'safety' | 'first_post' | 'reported' | 'flagged' | null;
  created_at: string;
  space_name: string;
  author_name: string;
  author_full_name: string;
  report_count: number;
  moderation: { categories?: string[] } | null;
};

const REASON: Record<string, { label: string; kind: 'safety' | 'attention' | 'progress'; explain: (q: QueueItem) => string }> = {
  safety: { label: 'Safety', kind: 'safety', explain: (q) => `Flagged by the automated check${q.moderation?.categories?.length ? ` (${q.moderation.categories.join(', ')})` : ''}. A human must respond — this cannot be cleared without a documented action.` },
  first_post: { label: 'First post', kind: 'progress', explain: () => 'Standard first-post review. Approve once and she posts freely after this.' },
  reported: { label: 'Reported', kind: 'attention', explain: (q) => `Reported by ${q.report_count} member${q.report_count === 1 ? '' : 's'}. Reporters stay anonymous to her.` },
  flagged: { label: 'Flagged', kind: 'attention', explain: (q) => `The automated check was unsure${q.moderation?.categories?.length ? ` (${q.moderation.categories.join(', ')})` : ''}.` },
};

export function Moderation() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<string>('all');
  const { data, error, loading, reload } = useLoad(async () => must(await sb().from('moderation_queue').select('*').order('created_at')) as QueueItem[]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  if (!isModerator(profile)) return <Empty>Moderation is for moderators and admins.</Empty>;

  async function act(id: string, action: string) {
    const note = (notes[id] ?? '').trim();
    if (note.length < 3) return setMsg('Every action needs a note — why are you doing this?');
    const { error } = await sb().rpc('moderate_post', { p_post: id, p_action: action, p_note: note });
    if (error) return setMsg(error.message);
    setMsg(null);
    reload();
  }

  const items = (data ?? []).filter((q) => filter === 'all' || q.queue_reason === filter || (filter === 'first_post' && !q.queue_reason));
  const count = (r: string) => (data ?? []).filter((q) => q.queue_reason === r).length;
  // Safety first, then oldest.
  items.sort((a, b) => Number(b.queue_reason === 'safety') - Number(a.queue_reason === 'safety') || a.created_at.localeCompare(b.created_at));

  return (
    <div className="two-col">
      <div>
        <p className="muted">
          <Link to="/palace">← The Palace</Link> / Moderation queue
        </p>
        <h1>Moderation queue</h1>
        <div className="row" style={{ marginBottom: 16 }}>
          {[
            ['all', `All · ${data?.length ?? 0}`],
            ['safety', `Safety · ${count('safety')}`],
            ['first_post', `First posts · ${count('first_post')}`],
            ['reported', `Reported · ${count('reported')}`],
            ['flagged', `Flagged · ${count('flagged')}`],
          ].map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        {msg && <p className="error">{msg}</p>}
        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && items.length === 0 && <Empty>The queue is clear.</Empty>}
        <div className="stack">
          {items.map((q) => {
            const r = REASON[q.queue_reason ?? 'first_post'];
            const safety = q.queue_reason === 'safety';
            return (
              <article key={q.id} className="card" style={safety ? { borderColor: 'var(--danger)', borderWidth: 2 } : undefined}>
                <div className="spread">
                  <div className="row">
                    <Status kind={r.kind}>{r.label}</Status>
                    <strong>{q.author_full_name || q.author_name}</strong> <span className="muted">in {q.space_name}</span>
                  </div>
                  <span className="muted">{timeAgo(q.created_at)}</span>
                </div>
                <blockquote className="serif" style={{ fontSize: '1.1rem', margin: '14px 0', paddingLeft: 14, borderLeft: '3px solid var(--line)' }}>
                  {q.body}
                </blockquote>
                <p className="muted">{r.explain(q)}</p>
                <label className="field">
                  <span>Note (required, permanent, visible to Admins)</span>
                  <input type="text" value={notes[q.id] ?? ''} onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })} placeholder="Why are you doing this?" />
                </label>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => act(q.id, 'approve')}>
                    Approve
                  </button>
                  <button className="btn btn-danger" onClick={() => act(q.id, 'remove')}>
                    Remove
                  </button>
                  <button className="btn btn-secondary" onClick={() => act(q.id, 'warn')}>
                    Warn
                  </button>
                  <button className="btn btn-secondary" onClick={() => act(q.id, 'timeout')}>
                    Timeout 24h
                  </button>
                  <button className="btn btn-secondary" onClick={() => act(q.id, 'escalate')}>
                    {safety ? 'Escalate to safeguarding lead' : 'Escalate'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="card">
          <h3>Every action needs a note</h3>
          <p className="muted" style={{ margin: 0 }}>
            Notes are permanent and visible to Admins. They are what protects the Academy if a decision is ever questioned.
          </p>
        </section>
        <section className="card card-soft">
          <p className="eyebrow">Safeguarding escalation</p>
          <p>Anything the system reads as risk of harm goes straight to the named safeguarding lead and cannot be dismissed from this screen without a documented response.</p>
          <p style={{ margin: 0 }}>
            <strong>Lead on call:</strong> Grace Nikoi · <a href="tel:+233548531412">+233 54 853 1412</a>
          </p>
        </section>
      </aside>
    </div>
  );
}

type MemberRow = { id: string; full_name: string; display_name: string; username: string | null; role: string; circle_id: string | null; crown_level: number; age_band: string | null; created_at: string };

export function Members() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const people = must(await sb().from('profiles').select('id, full_name, display_name, username, role, circle_id, crown_level, age_band, created_at').order('created_at', { ascending: false })) as MemberRow[];
    const circles = must(await sb().from('circles').select('id, name, mentor_id').order('name')) as { id: string; name: string; mentor_id: string | null }[];
    const codes = must(await sb().from('join_codes').select('code, child_name, created_at, used_by').is('used_by', null)) as { code: string; child_name: string; created_at: string }[];
    return { people, circles, codes };
  });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('member');
  if (loading) return <Loading lines={8} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  const circleName = new Map(data.circles.map((c) => [c.id, c.name]));
  const list = data.people.filter((p) => (role === 'all' || p.role === role) && `${p.full_name} ${p.display_name} ${p.username ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  async function assign(id: string, circle_id: string) {
    await api(`/admin/members/${id}/circle`, { body: { circle_id: circle_id || null } });
    reload();
  }

  return (
    <>
      <h1>Members</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 200 }} aria-label="Role">
          {['member', 'parent', 'mentor', 'moderator', 'admin', 'owner', 'all'].map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'Everyone' : r[0].toUpperCase() + r.slice(1) + 's'}
            </option>
          ))}
        </select>
      </div>
      {data.codes.length > 0 && (
        <p className="notice">
          {data.codes.length} join code{data.codes.length === 1 ? '' : 's'} not yet redeemed: {data.codes.map((c) => c.child_name).join(', ')}.
        </p>
      )}
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Age band</th>
              <th>Crown</th>
              <th>Circle</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.full_name || p.display_name}</strong>
                  <div className="muted small" style={{ textTransform: 'capitalize' }}>{p.role}</div>
                </td>
                <td>{p.username ?? '—'}</td>
                <td>{p.age_band ?? '—'}</td>
                <td>{p.role === 'member' ? p.crown_level : '—'}</td>
                <td>
                  {p.role === 'member' && isAdmin(profile) ? (
                    <select value={p.circle_id ?? ''} onChange={(e) => assign(p.id, e.target.value)} aria-label={`Circle for ${p.full_name}`}>
                      <option value="">No circle</option>
                      {data.circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (p.circle_id && circleName.get(p.circle_id)) ?? '—'
                  )}
                </td>
                <td>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty>No one matches.</Empty>}
      </div>
    </>
  );
}

type LiveRow = LiveSession & { recording_url: string | null; recording_lesson_id: string | null };

/** Bunny Stream links (embed or play page) carry the video GUID — lift it so the replay plays inside a lesson. */
function bunnyGuid(url: string) {
  return url.match(/(?:mediadelivery\.net|bunnycdn\.com)\/(?:embed|play)\/[^/]+\/([0-9a-f-]{36})/i)?.[1] ?? null;
}

export function LiveAdmin() {
  const { data, error, loading, reload } = useLoad(async () => {
    const sessions = must(await sb().from('live_sessions').select('*').order('starts_at', { ascending: false }).limit(30)) as LiveRow[];
    const circles = must(await sb().from('circles').select('id, name').order('name')) as { id: string; name: string }[];
    const modules = must(await sb().from('modules').select('id, month_no, title').order('month_no')) as Pick<Module, 'id' | 'month_no' | 'title'>[];
    return { sessions, circles, modules };
  });
  const { profile } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [rec, setRec] = useState<string | null>(null);
  const [recMsg, setRecMsg] = useState<string | null>(null);

  async function saveRecording(s: LiveRow, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const url = String(f.get('recording_url') ?? '').trim();
    const moduleId = String(f.get('module_id') ?? '');
    if (url && !/^https:\/\//i.test(url)) return setRecMsg('Paste the full replay link, starting with https://');
    setRecMsg(null);
    const patch: Record<string, unknown> = { recording_url: url || null };
    if (url && moduleId) {
      const { data: last } = await sb().from('lessons').select('position').eq('module_id', moduleId).order('position', { ascending: false }).limit(1);
      const position = ((last?.[0] as { position: number } | undefined)?.position ?? 0) + 1;
      const guid = bunnyGuid(url);
      const day = new Date(s.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      const { data: lesson, error: le } = await sb()
        .from('lessons')
        .insert({
          module_id: moduleId,
          position,
          kind: 'video',
          title: s.title,
          summary: `Recording of the live session on ${day}${s.host_name ? ` with ${s.host_name}` : ''}.`,
          body: guid ? '' : `Watch the replay: ${url}`,
          bunny_video_id: guid,
          video_status: guid ? 'ready' : null,
        })
        .select('id')
        .single();
      if (le) return setRecMsg(le.message);
      patch.recording_lesson_id = (lesson as { id: string }).id;
    }
    const { error } = await sb().from('live_sessions').update(patch).eq('id', s.id);
    if (error) return setRecMsg(error.message);
    setRec(null);
    setMsg(url ? (moduleId ? 'Recording saved and added as a lesson — finish it in the Course studio.' : 'Recording saved. Girls can watch the replay from the Throne Room.') : 'Recording removed.');
    reload();
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const kind = String(f.get('kind'));
    const { error } = await sb()
      .from('live_sessions')
      .insert({
        title: String(f.get('title')),
        kind,
        circle_id: String(f.get('circle_id') ?? '') || null,
        starts_at: new Date(String(f.get('starts_at'))).toISOString(),
        host_id: profile!.id,
        host_name: String(f.get('host_name') ?? '') || profile!.display_name || profile!.full_name,
        youtube_id: kind === 'broadcast' ? String(f.get('youtube_id') ?? '').trim() || null : null,
      });
    setMsg(error ? error.message : 'Session scheduled.');
    if (!error) form.reset();
    reload();
  }
  async function setLive(s: LiveSession, is_live: boolean) {
    await sb().from('live_sessions').update({ is_live, ends_at: is_live ? null : new Date().toISOString() }).eq('id', s.id);
    reload();
  }

  return (
    <div className="two-col">
      <div>
        <h1>Live sessions</h1>
        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {msg && <p className="notice">{msg}</p>}
        <div className="stack">
          {data?.sessions.map((s) => (
            <article key={s.id} className="card">
              <div className="spread" style={{ flexWrap: 'wrap' }}>
                <div>
                  {s.is_live && <span className="live-badge">Live</span>} <strong>{s.title}</strong>
                  <div className="muted">
                    {when(s.starts_at)} · {s.kind === 'broadcast' ? 'Broadcast (YouTube)' : `Interactive (Jitsi)${s.circle_id ? ` · ${data.circles.find((c) => c.id === s.circle_id)?.name ?? ''}` : ''}`}
                  </div>
                  {s.recording_url && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <Status kind="complete">Replay added</Status>
                      {s.recording_lesson_id && <Link to="/palace/content">Also a lesson</Link>}
                    </div>
                  )}
                </div>
                <div className="row">
                  {!s.is_live && new Date(s.starts_at) < new Date() && (
                    <button
                      className="btn btn-ghost"
                      aria-expanded={rec === s.id}
                      onClick={() => {
                        setRec(rec === s.id ? null : s.id);
                        setRecMsg(null);
                      }}
                    >
                      {s.recording_url ? 'Edit recording' : 'Add recording'}
                    </button>
                  )}
                  <Link className="btn btn-secondary" to={`/app/live/${s.id}`}>
                    Open room
                  </Link>
                  {s.is_live ? (
                    <button className="btn btn-danger" onClick={() => setLive(s, false)}>
                      End for all
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => setLive(s, true)}>
                      Go live
                    </button>
                  )}
                </div>
              </div>
              {rec === s.id && (
                <form className="stack" onSubmit={(e) => saveRecording(s, e)} style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16 }}>
                  <label className="field">
                    <span>Replay link (YouTube or Bunny Stream)</span>
                    <input type="url" name="recording_url" defaultValue={s.recording_url ?? ''} placeholder="https://youtu.be/… or https://iframe.mediadelivery.net/embed/…" />
                  </label>
                  {isAdmin(profile) && !s.recording_lesson_id && (
                    <label className="field">
                      <span>Also turn it into a lesson (optional)</span>
                      <select name="module_id" defaultValue="">
                        <option value="">No — just the replay</option>
                        {data.modules.map((m) => (
                          <option key={m.id} value={m.id}>
                            Add to Month {m.month_no} — {m.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="muted small" style={{ margin: 0 }}>
                    Bunny links play inside the lesson. YouTube links show as “Watch the replay”. Empty the link and save to remove it.
                  </p>
                  {recMsg && <p className="error">{recMsg}</p>}
                  <div className="row">
                    <button className="btn btn-primary">Save recording</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setRec(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
          {data?.sessions.length === 0 && <Empty>No sessions yet.</Empty>}
        </div>
      </div>
      <aside>
        <form className="card stack" onSubmit={create}>
          <h3>Schedule a session</h3>
          <label className="field">
            <span>Title</span>
            <input type="text" name="title" required placeholder="Circle 4 · Mentor hour" />
          </label>
          <label className="field">
            <span>Kind</span>
            <select name="kind" defaultValue="interactive">
              <option value="interactive">Interactive — Circle, up to 25 cameras (Jitsi)</option>
              <option value="broadcast">Broadcast — whole Academy (YouTube Live)</option>
            </select>
          </label>
          <label className="field">
            <span>Circle (leave empty for everyone)</span>
            <select name="circle_id" defaultValue="">
              <option value="">Everyone enrolled</option>
              {data?.circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Starts (GMT)</span>
            <input type="datetime-local" name="starts_at" required />
          </label>
          <label className="field">
            <span>Host name</span>
            <input type="text" name="host_name" placeholder="Adjoa" />
          </label>
          <label className="field">
            <span>YouTube video ID (broadcasts only)</span>
            <input type="text" name="youtube_id" placeholder="unlisted live stream ID" />
          </label>
          <button className="btn btn-primary">Schedule</button>
        </form>
      </aside>
    </div>
  );
}

export function Commerce() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const programs = must(await sb().from('programs').select('*').order('created_at')) as Program[];
    const payments = must(await sb().from('payments').select('*').order('created_at', { ascending: false }).limit(100)) as Payment[];
    return { programs, payments };
  });
  const [msg, setMsg] = useState<string | null>(null);
  if (loading) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;

  async function savePrice(p: Program, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ghsValue = Number(f.get('price'));
    const { error } = await sb()
      .from('programs')
      .update({ price_pesewas: ghsValue ? Math.round(ghsValue * 100) : null, instalments: Number(f.get('instalments')) || 1, is_open: f.get('is_open') === 'on' })
      .eq('id', p.id);
    setMsg(error ? error.message : `${p.name} saved.`);
    reload();
  }

  return (
    <>
      <h1>Commerce</h1>
      {msg && <p className="notice">{msg}</p>}
      {isAdmin(profile) && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 24 }}>
          {data.programs.map((p) => (
            <form key={p.id} className="card stack" onSubmit={(e) => savePrice(p, e)}>
              <h3>{p.name}</h3>
              <label className="field">
                <span>Price (GHS)</span>
                <input type="number" step="0.01" name="price" defaultValue={p.price_pesewas ? p.price_pesewas / 100 : ''} placeholder="[PRICE]" />
              </label>
              <label className="field">
                <span>Instalments</span>
                <input type="number" min={1} max={12} name="instalments" defaultValue={p.instalments} />
              </label>
              <label className="check">
                <input type="checkbox" name="is_open" defaultChecked={p.is_open} /> <span>Open for enrolment</span>
              </label>
              <button className="btn btn-primary">Save</button>
            </form>
          ))}
        </div>
      )}
      <section className="card table-wrap">
        <h3>Payments</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Amount</th>
              <th>Instalment</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td className="small">{p.reference}</td>
                <td>{ghs(p.amount_pesewas)}</td>
                <td>{p.instalment_no}</td>
                <td>
                  <Status kind={p.status === 'success' ? 'complete' : p.status === 'failed' ? 'attention' : 'progress'}>{p.status}</Status>
                </td>
                <td>{new Date(p.paid_at ?? p.due_at ?? Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.payments.length === 0 && <Empty>No payments yet.</Empty>}
      </section>
    </>
  );
}

export function HelpQueue() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const reqs = must(await sb().from('help_requests').select('*').order('created_at', { ascending: false }).limit(100)) as { id: string; member_id: string; body: string; status: string; created_at: string }[];
    const ids = [...new Set(reqs.map((r) => r.member_id))];
    const people = ids.length ? (must(await sb().from('profiles').select('id, full_name, phone').in('id', ids)) as { id: string; full_name: string }[]) : [];
    const names = new Map(people.map((p) => [p.id, p.full_name]));
    const deletions = must(await sb().from('account_deletion_requests').select('*').eq('status', 'open')) as { id: string; user_id: string; reason: string | null; created_at: string }[];
    const contacts = isAdmin(profile)
      ? (must(await sb().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100)) as { id: string; name: string; email: string; phone: string | null; topic: string | null; subject: string; message: string; status: string; created_at: string }[])
      : [];
    return { reqs: reqs.map((r) => ({ ...r, name: names.get(r.member_id) ?? 'Member' })), deletions, contacts };
  });
  async function close(id: string) {
    await sb().from('help_requests').update({ status: 'closed', handled_by: profile!.id }).eq('id', id);
    reload();
  }
  async function markContact(id: string, status: string) {
    await sb().from('contact_messages').update({ status }).eq('id', id);
    reload();
  }
  async function completeDeletion(id: string) {
    if (!confirm('Permanently delete this account and its data? This cannot be undone.')) return;
    await api(`/admin/deletions/${id}/complete`, { body: {} });
    reload();
  }
  return (
    <>
      <h1>Talk to someone</h1>
      <p className="muted">Private messages from girls. Only moderators and admins see these. Reply by phone or in person, then close it with what you did.</p>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="stack">
        {data?.reqs.map((r) => (
          <article key={r.id} className="card" style={r.status === 'escalated' ? { borderColor: 'var(--danger)', borderWidth: 2 } : undefined}>
            <div className="spread">
              <div className="row">
                <Status kind={r.status === 'escalated' ? 'safety' : r.status === 'open' ? 'attention' : 'complete'}>{r.status}</Status>
                <strong>{r.name}</strong>
              </div>
              <span className="muted">{timeAgo(r.created_at)}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{r.body}</p>
            {r.status !== 'closed' && (
              <button className="btn btn-secondary" onClick={() => close(r.id)}>
                Mark handled
              </button>
            )}
          </article>
        ))}
        {data?.reqs.length === 0 && <Empty>No messages.</Empty>}
      </div>
      {isAdmin(profile) && !!data?.contacts.length && (
        <section style={{ marginTop: 32 }}>
          <h2>Website messages</h2>
          <p className="muted">From the contact form on the public site. They are also emailed to the Academy.</p>
          <div className="stack">
            {data.contacts.map((m) => (
              <article key={m.id} className="card">
                <div className="spread">
                  <div className="row">
                    <Status kind={m.status === 'new' ? 'attention' : 'complete'}>{m.status === 'new' ? 'New' : 'Replied'}</Status>
                    <strong>{m.name}</strong>
                    {m.topic && <span className="chip">{m.topic}</span>}
                  </div>
                  <span className="muted">{timeAgo(m.created_at)}</span>
                </div>
                {m.subject && <p className="serif" style={{ fontSize: '1.1rem', margin: '12px 0 4px' }}>{m.subject}</p>}
                <p style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
                <div className="row">
                  <a className="btn btn-primary" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Grit & Grace'))}`}>Reply by email</a>
                  {m.phone && <a className="btn btn-secondary" href={`tel:${m.phone}`}>Call {m.phone}</a>}
                  {m.status === 'new' && <button className="btn btn-ghost" onClick={() => markContact(m.id, 'replied')}>Mark replied</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {isAdmin(profile) && !!data?.deletions.length && (
        <section className="card" style={{ marginTop: 24 }}>
          <h3>Account deletion requests</h3>
          <ul className="list">
            {data.deletions.map((d) => (
              <li key={d.id} className="spread">
                <span>
                  {d.reason ?? 'No reason given'} · {timeAgo(d.created_at)}
                </span>
                <button className="btn btn-danger" onClick={() => completeDeletion(d.id)}>
                  Delete account
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function People() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const staff = must(await sb().from('profiles').select('id, full_name, display_name, role, email').in('role', ['mentor', 'moderator', 'admin', 'owner']).order('role')) as { id: string; full_name: string; display_name: string; role: string; email: string | null }[];
    const circles = must(await sb().from('circles').select('id, name, mentor_id').order('name')) as { id: string; name: string; mentor_id: string | null }[];
    return { staff, circles };
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  if (!isAdmin(profile)) return <Empty>People &amp; access is for admins.</Empty>;

  async function inviteStaff(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const r = await api<{ invite_link: string | null }>('/admin/staff', { body: { email: f.get('email'), full_name: f.get('full_name'), role: f.get('role') } });
      setInvite(r.invite_link);
      setMsg('Invited. They have been emailed a link to set their password.');
      form.reset();
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }
  async function addCircle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await sb().from('circles').insert({ name: String(f.get('name')), mentor_id: String(f.get('mentor_id') ?? '') || null });
    setMsg(error ? error.message : 'Circle created with its own private space.');
    form.reset();
    reload();
  }
  async function announce(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const days = Number(f.get('days') || 0);
    const { error } = await sb().from('announcements').insert({
      author_id: profile!.id,
      title: String(f.get('title')),
      body: String(f.get('body')),
      audience: String(f.get('audience') || 'members'),
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    });
    setMsg(error ? error.message : 'Announcement posted.');
    form.reset();
  }

  return (
    <>
      <h1>People &amp; access</h1>
      {msg && <p className="notice">{msg}</p>}
      {invite && (
        <p className="muted small" style={{ wordBreak: 'break-all' }}>
          If the email does not arrive, send them this one-time link privately: {invite}
        </p>
      )}
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section className="card">
          <h3>Staff</h3>
          <ul className="list">
            {data?.staff.map((s) => (
              <li key={s.id}>
                <div className="avatar gold">{initials(s.full_name || s.display_name)}</div>
                <div style={{ flex: 1 }}>
                  <strong>{s.full_name || s.display_name}</strong>
                  <div className="muted small">{s.email}</div>
                </div>
                <span className="chip" style={{ textTransform: 'capitalize' }}>{s.role}</span>
              </li>
            ))}
          </ul>
          <form className="stack" onSubmit={inviteStaff} style={{ marginTop: 12 }}>
            <h4>Invite someone</h4>
            <input type="text" name="full_name" placeholder="Full name" required />
            <input type="email" name="email" placeholder="Email" required />
            <select name="role" defaultValue="mentor" aria-label="Role">
              <option value="mentor">Mentor</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn-primary">Send invite</button>
          </form>
        </section>
        <section className="card">
          <h3>Circles</h3>
          <ul className="list">
            {data?.circles.map((c) => (
              <li key={c.id}>
                <strong style={{ flex: 1 }}>{c.name}</strong>
                <span className="muted">{data.staff.find((s) => s.id === c.mentor_id)?.display_name ?? 'No mentor'}</span>
              </li>
            ))}
          </ul>
          <form className="stack" onSubmit={addCircle} style={{ marginTop: 12 }}>
            <h4>New Circle</h4>
            <input type="text" name="name" placeholder="Circle 5" required />
            <select name="mentor_id" defaultValue="" aria-label="Mentor">
              <option value="">Choose a mentor</option>
              {data?.staff
                .filter((s) => s.role === 'mentor')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.display_name}
                  </option>
                ))}
            </select>
            <button className="btn btn-primary">Create Circle</button>
          </form>
        </section>
        <section className="card" id="announce">
          <h3>New announcement</h3>
          <form className="stack" onSubmit={announce}>
            <input type="text" name="title" placeholder="Title" required />
            <textarea name="body" placeholder="What does everyone need to know?" required />
            <select name="audience" defaultValue="members" aria-label="Who sees it">
              <option value="members">Girls (member home)</option>
              <option value="parents">Parents (The Gate)</option>
              <option value="everyone">Everyone</option>
            </select>
            <select name="days" defaultValue="14" aria-label="Show for">
              <option value="7">Show for 1 week</option>
              <option value="14">Show for 2 weeks</option>
              <option value="30">Show for a month</option>
              <option value="0">Until I remove it</option>
            </select>
            <button className="btn btn-primary">
              <Icon name="megaphone" size={18} /> Post announcement
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
