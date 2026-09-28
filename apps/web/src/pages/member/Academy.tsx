import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Empty, ErrorBox, Icon, Loading, Status } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { timeAgo, unlockLabel } from '../../lib/format';
import { useLoad } from '../../lib/hooks';
import { sb } from '../../lib/supabase';
import { VALUE_LABEL, type Lesson } from '../../lib/types';
import { lessonState, loadJourney, moduleLocked } from './data';

export function Academy() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(() => loadJourney(profile!.id), [profile!.id]);
  if (loading) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  return (
    <>
      <p className="eyebrow">The Academy</p>
      <h1>The Inner Court</h1>
      <p className="muted">Twelve months. Five values. One Circle.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginTop: 20 }}>
        {data.modules.map((m) => {
          const ls = data.lessons.filter((l) => l.module_id === m.id);
          const done = ls.filter((l) => data.progress.get(l.id)?.completed_at).length;
          const locked = moduleLocked(m);
          return (
            <Link key={m.id} to={locked ? '#' : `/app/academy/${m.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', opacity: locked ? 0.7 : 1 }}>
              <div className="spread">
                <span className="eyebrow">Month {m.month_no}</span>
                {locked ? (
                  <Status kind="locked">{unlockLabel(m.unlock_at!)}</Status>
                ) : done === ls.length && ls.length ? (
                  <Status kind="complete">Complete</Status>
                ) : done ? (
                  <Status kind="progress">In progress</Status>
                ) : null}
              </div>
              <h3 style={{ marginTop: 8 }}>{m.title}</h3>
              <p className="muted">{m.summary}</p>
              <div className="bar">
                <i style={{ width: `${ls.length ? (100 * done) / ls.length : 0}%` }} />
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {done} of {ls.length} lessons{m.value ? ` · ${VALUE_LABEL[m.value]}` : ''}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function ModulePage() {
  const { moduleId } = useParams();
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(() => loadJourney(profile!.id), [profile!.id]);
  if (loading) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  const m = data.modules.find((x) => x.id === moduleId);
  if (!m) return <Empty>That month is not available.</Empty>;
  const ls = data.lessons.filter((l) => l.module_id === m.id);
  return (
    <>
      <Link to="/app/academy" className="row" style={{ textDecoration: 'none', marginBottom: 12 }}>
        <Icon name="back" size={18} /> The Academy
      </Link>
      <p className="eyebrow">
        Month {m.month_no}
        {m.value ? ` · ${VALUE_LABEL[m.value]}` : ''}
      </p>
      <h1>{m.title}</h1>
      <p className="muted">{m.summary}</p>
      <div className="card">
        <ul className="list">
          {ls.map((l) => (
            <LessonRow key={l.id} lesson={l} state={lessonState(l, data.progress)} />
          ))}
        </ul>
      </div>
    </>
  );
}

function LessonRow({ lesson: l, state, current }: { lesson: Lesson; state: ReturnType<typeof lessonState>; current?: boolean }) {
  const meta = l.kind === 'video' ? `Video · ${l.duration_min ?? '–'} min` : l.kind === 'devotional' ? 'Devotional' : l.kind === 'assignment' ? 'Assignment' : 'Live';
  return (
    <li style={current ? { background: 'var(--chip)', margin: '0 -12px', padding: '14px 12px', borderRadius: 10 } : undefined}>
      <Link className="rowlink" to={state === 'locked' ? '#' : `/app/lesson/${l.id}`}>
        <div style={{ flex: 1 }}>
          <strong>{l.title}</strong>
          <div className="muted">{current ? 'Playing now' : meta}</div>
        </div>
        {state === 'done' && <Status kind="complete">Done</Status>}
        {state === 'progress' && !current && <Status kind="progress">In progress</Status>}
        {state === 'locked' && <Status kind="locked">{unlockLabel(l.unlock_at!)}</Status>}
      </Link>
    </li>
  );
}

export function LessonPage() {
  const { lessonId } = useParams();
  const { profile } = useAuth();
  const me = profile!;
  const { data, error, loading, reload } = useLoad(() => loadJourney(me.id), [me.id, lessonId]);
  const [play, setPlay] = useState<{ embed_url: string | null; note?: string } | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [tab, setTab] = useState<'journal' | 'notes'>('journal');
  const [entry, setEntry] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [finish, setFinish] = useState<null | { done: number; total: number; certificate: string | null }>(null);

  useEffect(() => {
    if (!lessonId) return;
    setPlay(null);
    setPlayError(null);
    api<{ embed_url: string | null; note?: string }>(`/lessons/${lessonId}/play${me.data_saver ? '?saver=1' : ''}`)
      .then(setPlay)
      .catch((e) => setPlayError(e.message));
    // Opening a lesson counts as starting it.
    void sb().from('lesson_progress').upsert({ member_id: me.id, lesson_id: lessonId, updated_at: new Date().toISOString() }, { onConflict: 'member_id,lesson_id' });
  }, [lessonId, me.id, me.data_saver]);

  if (loading) return <Loading lines={8} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;
  const lesson = data.lessons.find((l) => l.id === lessonId);
  if (!lesson) return <Empty>This lesson is not available.</Empty>;
  const mod = data.modules.find((m) => m.id === lesson.module_id)!;
  const siblings = data.lessons.filter((l) => l.module_id === mod.id);
  const doneCount = siblings.filter((l) => data.progress.get(l.id)?.completed_at).length;
  const isDone = !!data.progress.get(lesson.id)?.completed_at;

  async function saveEntry(e: FormEvent, share: boolean) {
    e.preventDefault();
    if (!entry.trim()) return;
    const { error } = await sb().from('journal_entries').insert({ member_id: me.id, lesson_id: lesson!.id, prompt: lesson!.journal_prompt, body: entry.trim(), shared_with_mentor: share });
    if (error) setSaved(`Could not save: ${error.message}`);
    else {
      setEntry('');
      setSaved(share ? 'Saved and shared with your mentor.' : 'Saved. Only you can see this.');
    }
  }

  async function markDone() {
    const { data: res, error } = await sb().rpc('complete_lesson', { p_lesson: lesson!.id });
    if (error) return setSaved(error.message);
    setFinish(res as { done: number; total: number; certificate: string | null });
    reload();
  }

  return (
    <div className="two-col">
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="row muted">
          <Link to={`/app/academy/${mod.id}`}>← The Academy</Link> / The Inner Court · Month {mod.month_no} · {mod.value ? VALUE_LABEL[mod.value] : mod.title}
        </div>
        {me.data_saver && (
          <p className="eyebrow" style={{ margin: 0 }}>
            Data saver · streaming at 480p to save your bundle
          </p>
        )}
        <div className="player">
          {me.data_saver && <span className="saver">480p · Data saver</span>}
          {play?.embed_url ? (
            <iframe src={play.embed_url} title={lesson.title} loading="lazy" allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <div className="poster">
              <div>
                <Icon name={lesson.kind === 'video' ? 'play' : lesson.kind === 'devotional' ? 'book' : 'journal'} size={40} />
                <p style={{ marginTop: 8 }}>
                  {playError ?? (play ? (lesson.kind === 'video' ? 'The video for this lesson is on its way.' : 'Read, reflect, and write below.') : 'Loading…')}
                </p>
              </div>
            </div>
          )}
        </div>
        <div>
          <h1 style={{ fontSize: '2rem' }}>
            Lesson {lesson.position} · {lesson.title}
          </h1>
          <p>{lesson.summary}</p>
          {lesson.body && <div style={{ whiteSpace: 'pre-wrap' }}>{lesson.body}</div>}
        </div>
        <LessonResources lessonId={lesson.id} dataSaver={me.data_saver} />

        <div className="row" role="tablist">
          <button className="chip" role="tab" aria-pressed={tab === 'journal'} onClick={() => setTab('journal')}>
            Journal prompt
          </button>
          <Link className="chip" to="/app/court">
            Discussion
          </Link>
        </div>
        {tab === 'journal' && (
          <form className="card stack">
            <div className="spread">
              <p className="eyebrow" style={{ margin: 0 }}>
                Private to you
              </p>
              <span className="muted">Your mentor sees this only if you share it</span>
            </div>
            <label className="field">
              <span className="serif" style={{ fontSize: '1.2rem' }}>
                {lesson.journal_prompt ?? 'What stayed with you from this lesson?'}
              </span>
              <textarea value={entry} onChange={(e) => setEntry(e.target.value)} />
            </label>
            {saved && <p className="notice">{saved}</p>}
            <div className="row">
              <button className="btn btn-primary" onClick={(e) => saveEntry(e, false)}>
                Save entry
              </button>
              {me.circle_id && (
                <button className="btn btn-secondary" onClick={(e) => saveEntry(e, true)}>
                  Share with my mentor
                </button>
              )}
            </div>
          </form>
        )}
        <div className="row">
          {isDone ? (
            <Status kind="complete">Lesson complete</Status>
          ) : (
            <button className="btn btn-primary" onClick={markDone}>
              <Icon name="check" size={18} /> Mark as done
            </button>
          )}
        </div>
        {finish && (
          <div className="notice">
            {finish.certificate
              ? `Month complete — your badge is unlocked and your certificate (${finish.certificate}) is ready.`
              : `${finish.done} of ${finish.total} done this month.`}
          </div>
        )}
      </div>

      <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="card">
          <div className="spread">
            <p className="eyebrow" style={{ margin: 0 }}>
              Month {mod.month_no} — {mod.value ? VALUE_LABEL[mod.value] : mod.title}
            </p>
            <span className="muted">
              {doneCount}/{siblings.length}
            </span>
          </div>
          <ul className="list">
            {siblings.map((l) => (
              <LessonRow key={l.id} lesson={l} state={lessonState(l, data.progress)} current={l.id === lesson.id} />
            ))}
          </ul>
        </section>
        {siblings.length - doneCount > 0 && (
          <section className="card card-soft">
            <h3>Finish this month</h3>
            <p style={{ margin: 0 }}>
              {siblings.length - doneCount === 1 ? 'One lesson to go' : `${siblings.length - doneCount} lessons to go`} and your {mod.value ? VALUE_LABEL[mod.value] : ''} badge unlocks — plus your Month {mod.month_no} certificate.
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}

type LessonResource = { id: string; title: string; path: string; size_bytes: number | null };

function fileSize(n: number | null) {
  if (n == null) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const BIG_FILE = 5 * 1024 * 1024;

/** Workbooks, printables and audio for this lesson — private files, opened with a one-hour link. */
function LessonResources({ lessonId, dataSaver }: { lessonId: string; dataSaver: boolean }) {
  const { data } = useLoad(async () => {
    const { data, error } = await sb().from('lesson_resources').select('id, title, path, size_bytes').eq('lesson_id', lessonId).order('created_at');
    if (error) throw error;
    return (data ?? []) as LessonResource[];
  }, [lessonId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data?.length) return null;

  async function download(r: LessonResource) {
    setErr(null);
    setBusy(r.id);
    const name = r.path.split('/').pop() ?? r.title;
    const { data: s, error } = await sb().storage.from('course').createSignedUrl(r.path, 3600, { download: name });
    setBusy(null);
    if (error || !s) return setErr('Could not open this file. Check your connection and try again.');
    window.location.assign(s.signedUrl);
  }

  return (
    <section className="card">
      <h3>Workbooks &amp; resources</h3>
      <ul className="list">
        {data.map((r) => {
          const big = (r.size_bytes ?? 0) > BIG_FILE;
          return (
            <li key={r.id}>
              <Icon name="file" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{r.title}</strong>
                <div className="muted">
                  {fileSize(r.size_bytes)}
                  {big && (dataSaver ? ' · large file — best on Wi-Fi' : ' · large file')}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => download(r)} disabled={busy === r.id} aria-label={`Download ${r.title}`}>
                {busy === r.id ? 'Opening…' : 'Download'}
              </button>
            </li>
          );
        })}
      </ul>
      {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
    </section>
  );
}

export function Journal() {
  const { profile } = useAuth();
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await sb().from('journal_entries').select('*').eq('member_id', profile!.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data as { id: string; prompt: string | null; body: string; shared_with_mentor: boolean; created_at: string }[];
  }, [profile!.id]);
  const [body, setBody] = useState('');
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await sb().from('journal_entries').insert({ member_id: profile!.id, body: body.trim() });
    setBody('');
    reload();
  }
  return (
    <>
      <p className="eyebrow">Private to you</p>
      <h1>My Journal</h1>
      <p className="muted">Your parent can see that your journal exists — never what you write. Your mentor sees only entries you choose to share.</p>
      <form className="card stack" onSubmit={add}>
        <label className="field">
          <span>Write something down</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button className="btn btn-primary">Save entry</button>
      </form>
      <div style={{ marginTop: 20 }}>
        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data?.length === 0 && <Empty>No entries yet.</Empty>}
        <div className="stack">
          {data?.map((j) => (
            <article key={j.id} className="card">
              <div className="spread">
                <span className="muted">{timeAgo(j.created_at)}</span>
                {j.shared_with_mentor && <Status kind="progress">Shared with mentor</Status>}
              </div>
              {j.prompt && <p className="serif" style={{ fontSize: '1.1rem', marginTop: 8 }}>{j.prompt}</p>}
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{j.body}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

export function TalkToSomeone() {
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | string>('idle');
  async function send(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      await api('/help', { body: { body } });
      setState('sent');
      setBody('');
    } catch (err) {
      setState(err instanceof Error ? err.message : 'Could not send');
    }
  }
  return (
    <div style={{ maxWidth: 640 }}>
      <p className="eyebrow">Talk to someone</p>
      <h1>A real adult, just for you</h1>
      <p>If anything here or anywhere else is worrying you, this reaches a real adult at the Academy. Nobody else sees it — not other girls, and not your Circle.</p>
      {state === 'sent' ? (
        <div className="card card-soft">
          <h3>Thank you for telling us.</h3>
          <p style={{ margin: 0 }}>Someone from the Academy will reply soon. If you are in danger right now, tell an adult near you or call the Ghana Child Helpline on 116.</p>
        </div>
      ) : (
        <form className="card stack" onSubmit={send}>
          <label className="field">
            <span>What would you like to tell us?</span>
            <textarea required value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          {state !== 'idle' && state !== 'busy' && <p className="error">{state}</p>}
          <button className="btn btn-primary" disabled={state === 'busy'}>
            Send privately
          </button>
        </form>
      )}
      <p className="muted" style={{ marginTop: 16 }}>
        Your parent can see your progress and attendance. They cannot read your journal or your messages.
      </p>
    </div>
  );
}
