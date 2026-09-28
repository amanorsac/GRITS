import { useState } from 'react';
import { Link } from 'react-router';
import { Crown, Empty, ErrorBox, Icon, Loading, Status, Switch } from '../components/ui';
import { api } from '../lib/api';
import { isStaff, useAuth } from '../lib/auth';
import { ghs } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { sb } from '../lib/supabase';
import type { Payment, Profile } from '../lib/types';

type ChildView = {
  child: Profile;
  perms: { circle: boolean; court: boolean; mentor_dm: boolean } | null;
  lessonsDone: number;
  lessonsThisWeek: number;
  attended: number;
  sessions: number;
  certificates: { code: string; title: string; issued_at: string }[];
  badges: string[];
  streak: number;
  journal: number;
  intake: Record<string, number> | null;
  latest: Record<string, number> | null;
  circleName: string | null;
};

const DIMENSIONS = ['gracefulness', 'integrity', 'resilience', 'leadership', 'spirituality', 'confidence'];

async function loadGate(parentId: string) {
  const [links, codes, payments] = await Promise.all([
    sb().from('parent_links').select('child_id').eq('parent_id', parentId),
    sb().from('join_codes').select('code, child_name, used_by, expires_at, enrolments(status)').eq('parent_id', parentId).is('used_by', null),
    sb().from('payments').select('*').eq('parent_id', parentId).order('instalment_no'),
  ]);
  const childIds = (links.data ?? []).map((l) => l.child_id as string);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const children: ChildView[] = await Promise.all(
    childIds.map(async (id) => {
      const [p, perms, prog, att, sessions, certs, badges, streak, journal, assess] = await Promise.all([
        sb().from('profiles').select('*').eq('id', id).single(),
        sb().from('member_permissions').select('circle, court, mentor_dm').eq('member_id', id).maybeSingle(),
        sb().from('lesson_progress').select('completed_at').eq('member_id', id).not('completed_at', 'is', null),
        sb().from('attendance').select('session_id', { count: 'exact', head: true }).eq('member_id', id),
        sb().from('live_sessions').select('id', { count: 'exact', head: true }).lt('starts_at', new Date().toISOString()),
        sb().from('certificates').select('code, title, issued_at').eq('member_id', id).order('issued_at'),
        sb().from('member_badges').select('badges(name)').eq('member_id', id),
        sb().rpc('member_streak', { p_member: id }),
        sb().rpc('journal_count', { p_child: id }),
        sb().from('assessments').select('phase, scores, taken_at').eq('member_id', id).order('taken_at'),
      ]);
      const child = p.data as Profile;
      let circleName: string | null = null;
      if (child.circle_id) {
        const { data } = await sb().from('circles').select('name').eq('id', child.circle_id).maybeSingle();
        circleName = data?.name ?? null;
      }
      const done = (prog.data ?? []) as { completed_at: string }[];
      const a = (assess.data ?? []) as { phase: string; scores: Record<string, number> }[];
      return {
        child,
        perms: perms.data,
        lessonsDone: done.length,
        lessonsThisWeek: done.filter((d) => d.completed_at > weekAgo).length,
        attended: att.count ?? 0,
        sessions: sessions.count ?? 0,
        certificates: certs.data ?? [],
        badges: ((badges.data ?? []) as unknown as { badges: { name: string } }[]).map((b) => b.badges.name),
        streak: (streak.data as number) ?? 0,
        journal: (journal.data as number) ?? 0,
        intake: a.find((x) => x.phase === 'intake')?.scores ?? null,
        latest: a.length > 1 ? a[a.length - 1].scores : null,
        circleName,
      };
    }),
  );
  return {
    children,
    codes: (codes.data ?? []) as unknown as { code: string; child_name: string; expires_at: string; enrolments: { status: string } | null }[],
    payments: (payments.data ?? []) as Payment[],
  };
}

export default function Gate() {
  const { profile, signOut } = useAuth();
  const { data, error, loading, reload } = useLoad(() => loadGate(profile!.id), [profile!.id]);
  const [tab, setTab] = useState<'overview' | 'invoices' | 'permissions'>('overview');

  return (
    <div>
      <header className="site-nav">
        <Link to="/" className="brandmark">
          <Crown size={28} /> The Gate <span className="muted" style={{ color: '#e8bccb', fontFamily: 'var(--body)', fontSize: '.95rem' }}>Parent portal</span>
        </Link>
        <nav className="row" aria-label="Parent portal">
          <button className="chip" aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className="chip" aria-pressed={tab === 'invoices'} onClick={() => setTab('invoices')}>
            Invoices
          </button>
          <button className="chip" aria-pressed={tab === 'permissions'} onClick={() => setTab('permissions')}>
            Permissions
          </button>
          {isStaff(profile) ? (
            <Link to="/palace" className="chip">
              Back to The Palace
            </Link>
          ) : (
            <button className="linkish" style={{ color: '#fff' }} onClick={signOut}>
              Log out
            </button>
          )}
        </nav>
      </header>
      <main className="section-inner" style={{ padding: '32px 16px 64px' }}>
        {loading && <Loading lines={6} />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && (
          <>
            {data.codes.map((c) => (
              <div key={c.code} className="card card-soft" style={{ marginBottom: 20 }}>
                <p className="eyebrow">Waiting for {c.child_name.split(' ')[0]}</p>
                {c.enrolments?.status === 'active' ? (
                  <>
                    <p>Give her this code. She uses it once, in the Grit &amp; Grace app or at {location.host}/join, to create her own account:</p>
                    <p className="serif" style={{ fontSize: '1.6rem', letterSpacing: 3, color: 'var(--maroon)', margin: 0 }}>
                      {c.code}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0 }}>Payment is not confirmed yet. Once it is, her join code appears here and in your email.</p>
                )}
              </div>
            ))}
            {data.children.length === 0 && data.codes.length === 0 && (
              <Empty>
                <h2>Welcome to The Gate</h2>
                <p>This is where you watch her grow. Start by enrolling your daughter.</p>
                <Link className="btn btn-primary" to="/enrol">
                  Enrol her
                </Link>
              </Empty>
            )}
            {tab === 'overview' && data.children.map((c) => <ChildOverview key={c.child.id} v={c} payments={data.payments} />)}
            {tab === 'permissions' && data.children.map((c) => <Permissions key={c.child.id} v={c} onChange={reload} />)}
            {tab === 'invoices' && <Invoices payments={data.payments} />}
          </>
        )}
      </main>
    </div>
  );
}

function ChildOverview({ v, payments }: { v: ChildView; payments: Payment[] }) {
  const first = v.child.display_name || v.child.full_name.split(' ')[0];
  const next = payments.find((p) => p.status !== 'success');
  return (
    <section style={{ marginBottom: 40 }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>{first}&rsquo;s month</h1>
          <p className="muted">
            The Inner Court{v.circleName ? ` · ${v.circleName}` : ''} · Crown Level {v.child.crown_level}
          </p>
        </div>
        {next && (
          <div className="card" style={{ minWidth: 220 }}>
            <div className="muted">Next payment</div>
            <strong className="serif" style={{ fontSize: '1.3rem' }}>
              {ghs(next.amount_pesewas)}
            </strong>
            {next.due_at && <span className="muted"> · {new Date(next.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 16 }}>
        <div className="card card-maroon">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            Your weekly digest
          </p>
          <p className="serif" style={{ fontSize: '1.2rem', color: '#fff' }}>
            This week {first} completed {v.lessonsThisWeek} lesson{v.lessonsThisWeek === 1 ? '' : 's'}
            {v.badges.length ? ` and has earned ${v.badges.length} badge${v.badges.length === 1 ? '' : 's'} so far` : ''}.
          </p>
          <div className="row" style={{ gap: 24 }}>
            <div>
              <span className="stat" style={{ color: 'var(--gold)' }}>{v.streak}</span> <span className="muted">day streak</span>
            </div>
            <div>
              <span className="stat" style={{ color: 'var(--gold)' }}>{v.lessonsDone}</span> <span className="muted">lessons done</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Attendance</h3>
          <p className="stat">
            {v.attended} <span className="stat-label" style={{ fontSize: '1rem' }}>of {v.sessions} live sessions</span>
          </p>
        </div>
        <div className="card">
          <h3>What you cannot see</h3>
          <p>
            Her journal entries and her messages with her mentor are private. You can see that they exist — she has written {v.journal} journal {v.journal === 1 ? 'entry' : 'entries'} — not what she wrote.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            That boundary is deliberate. It is what makes her honest in there. If you are ever worried, <a href="mailto:grace@gritgracegirlsacademy.com">ask an Admin for a review</a>.
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 16 }}>
        <div className="card">
          <h3>Where she started, where she is</h3>
          <p className="muted">Intake assessment, measured again at the mid-point. Same questions, her own answers.</p>
          {v.intake ? (
            <div className="stack">
              {DIMENSIONS.map((d) => {
                const a = v.intake?.[d] ?? 0;
                const b = v.latest?.[d] ?? a;
                return (
                  <div key={d}>
                    <div className="spread">
                      <span style={{ textTransform: 'capitalize' }}>{d}</span>
                      {v.latest && <strong style={{ color: 'var(--ok)' }}>+{b - a}</strong>}
                    </div>
                    <div className="bar" style={{ position: 'relative' }}>
                      <i style={{ width: `${b}%`, background: 'var(--maroon)' }} />
                    </div>
                    <div className="bar" style={{ marginTop: 3, height: 4 }}>
                      <i style={{ width: `${a}%`, background: 'var(--pink-bright)' }} />
                    </div>
                  </div>
                );
              })}
              <p className="muted small">Thin bar: at intake · Thick bar: now</p>
            </div>
          ) : (
            <p className="muted">Her intake assessment has not been recorded yet. Her mentor does this in the first weeks.</p>
          )}
        </div>
        <div className="card">
          <h3>Certificates</h3>
          {v.certificates.length === 0 ? (
            <p className="muted">Her first certificate arrives when she finishes her first month.</p>
          ) : (
            <ul className="list">
              {v.certificates.map((c) => (
                <li key={c.code}>
                  <Icon name="file" />
                  <div style={{ flex: 1 }}>
                    <strong>{c.title}</strong>
                    <div className="muted">Verified · code {c.code}</div>
                  </div>
                  <Status kind="complete">Verified</Status>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Permissions({ v, onChange }: { v: ChildView; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const first = v.child.display_name || v.child.full_name.split(' ')[0];
  async function set(scope: 'circle' | 'court' | 'mentor_dm', granted: boolean) {
    const { error } = await sb().rpc('set_member_permission', { p_child: v.child.id, p_scope: scope, p_granted: granted });
    if (error) setError(error.message);
    else onChange();
  }
  const p = v.perms ?? { circle: true, court: false, mentor_dm: true };
  return (
    <section className="card" style={{ maxWidth: 720, marginBottom: 24 }}>
      <h2>What {first} can do inside</h2>
      <p className="muted">Every change is recorded in your consent history.</p>
      <div className="perm">
        <div>
          <strong>Lessons and live sessions</strong>
          <div className="muted">Always on for enrolled members</div>
        </div>
        <Switch checked disabled label="Lessons" onChange={() => {}} />
      </div>
      <div className="perm">
        <div>
          <strong>Her Circle</strong>
          <div className="muted">A private group of 8–12 girls with a mentor</div>
        </div>
        <Switch checked={p.circle} label="Her Circle" onChange={(x) => set('circle', x)} />
      </div>
      <div className="perm">
        <div>
          <strong>The Court — main community feed</strong>
          <div className="muted">Moderated. Off by default under 13.</div>
        </div>
        <Switch checked={p.court} label="The Court" onChange={(x) => set('court', x)} />
      </div>
      <div className="perm" style={{ borderBottom: 0 }}>
        <div>
          <strong>Direct messages to her mentor</strong>
          <div className="muted">She starts the thread. Every message is logged.</div>
        </div>
        <Switch checked={p.mentor_dm} label="Direct messages to her mentor" onChange={(x) => set('mentor_dm', x)} />
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Invoices({ payments }: { payments: Payment[] }) {
  const [error, setError] = useState<string | null>(null);
  async function pay(id: string) {
    try {
      const r = await api<{ authorization_url: string }>(`/payments/${id}/pay`, { body: {} });
      location.href = r.authorization_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  if (!payments.length) return <Empty>No invoices yet.</Empty>;
  return (
    <section className="card">
      <h2>Invoices</h2>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Instalment</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.instalment_no}</td>
                <td>{ghs(p.amount_pesewas)}</td>
                <td>{p.due_at ? new Date(p.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                <td>
                  {p.status === 'success' ? (
                    <Status kind="complete">Paid{p.channel === 'mobile_money' ? ' · MoMo' : p.channel === 'card' ? ' · card' : ''}</Status>
                  ) : p.status === 'failed' ? (
                    <Status kind="attention">Failed</Status>
                  ) : (
                    <Status kind="progress">Due</Status>
                  )}
                </td>
                <td>
                  {p.status !== 'success' && (
                    <button className="btn btn-primary" onClick={() => pay(p.id)}>
                      Pay now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
