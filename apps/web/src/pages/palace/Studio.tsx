// Course Studio — months (modules), lessons, video upload, workbooks. Everything the Academy
// needs to build and run the course without touching code.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Empty, ErrorBox, Icon, Loading, Status } from '../../components/ui';
import { fmtBytes, VideoUploader } from '../../components/VideoUploader';
import { api } from '../../lib/api';
import { isAdmin, useAuth } from '../../lib/auth';
import { must, useLoad } from '../../lib/hooks';
import { sb } from '../../lib/supabase';
import { VALUE_LABEL, type Lesson, type Module } from '../../lib/types';
import '../../studio.css';

type SModule = Module & { cover_url: string | null };
type SLesson = Lesson & { video_status: string | null };
type Resource = { id: string; lesson_id: string; title: string; path: string; size_bytes: number | null; created_at: string };
type Data = { courses: { id: string; title: string }[]; modules: SModule[]; lessons: SLesson[]; resources: Pick<Resource, 'id' | 'lesson_id'>[] };

const VALUES = Object.keys(VALUE_LABEL);
const KINDS: [SLesson['kind'], string][] = [
  ['video', 'Video'],
  ['devotional', 'Devotional'],
  ['assignment', 'Assignment'],
  ['live', 'Live session'],
];
const MB_PER_MIN_480P = 0.8;

// Ghana is GMT all year, so the Academy's clock is UTC: show and read date inputs in GMT.
const toInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
const fromInput = (v: string) => (v ? new Date(`${v}:00Z`).toISOString() : null);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const isLocked = (iso: string | null) => !!iso && new Date(iso) > new Date();
const friendly = (m: string) =>
  /duplicate key.*month_no|modules_course_id_month_no/i.test(m) ? 'Another month already uses that month number.' : m;

// Tiny local upload helper for public images (covers) — the "media" bucket is public-read.
async function uploadCover(file: File, moduleId: string) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image (JPG, PNG or WebP).');
  if (file.size > 10 * 1024 * 1024) throw new Error('That image is over 10 MB. Export a smaller one (1600px wide is plenty).');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `covers/module-${moduleId}-${Date.now().toString(36)}.${ext}`;
  const { error } = await sb().storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return sb().storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function VideoChip({ lesson }: { lesson: Pick<SLesson, 'kind' | 'bunny_video_id' | 'video_status'> }) {
  if (lesson.bunny_video_id) {
    if (lesson.video_status === 'uploading') return <Status kind="progress">Uploading</Status>;
    if (lesson.video_status === 'processing') return <Status kind="progress">Processing</Status>;
    if (lesson.video_status === 'failed') return <Status kind="safety">Video failed</Status>;
    return <Status kind="complete">Video ready</Status>;
  }
  if (lesson.kind === 'video') return <Status kind="attention">No video</Status>;
  return null;
}
function LockChip({ at }: { at: string | null }) {
  return isLocked(at) ? <Status kind="locked">Locked until {shortDate(at!)}</Status> : null;
}

export default function Studio() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('m');
  const lessonId = params.get('l');
  const { data, error, loading, reload } = useLoad<Data>(async () => {
    const [courses, modules, lessons, resources] = await Promise.all([
      sb().from('courses').select('id, title').order('title'),
      sb().from('modules').select('*').order('month_no'),
      sb().from('lessons').select('*').order('position'),
      sb().from('lesson_resources').select('id, lesson_id'),
    ]);
    return {
      courses: must(courses) ?? [],
      modules: (must(modules) ?? []) as SModule[],
      lessons: (must(lessons) ?? []) as SLesson[],
      resources: (must(resources) ?? []) as Data['resources'],
    };
  });

  const go = (m: string | null, l?: string | null) => {
    const p = new URLSearchParams();
    if (m) p.set('m', m);
    if (l) p.set('l', l);
    setParams(p);
    window.scrollTo({ top: 0 });
  };

  if (!isAdmin(profile)) return <Empty>The Course Studio is for admins.</Empty>;
  // Only show the skeleton on first load, so editors (and uploads) stay mounted on refresh.
  if (loading && !data) return <Loading lines={8} />;
  if (!data) return <ErrorBox error={error ?? 'Could not load'} onRetry={reload} />;

  const mod = moduleId ? data.modules.find((m) => m.id === moduleId) : null;
  if (moduleId && !mod) {
    return (
      <>
        <Empty>That month no longer exists.</Empty>
        <button className="btn btn-secondary" onClick={() => go(null)}>
          Back to the course
        </button>
      </>
    );
  }
  return (
    <>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {mod ? <ModuleView data={data} mod={mod} lessonId={lessonId} go={go} reload={reload} /> : <Overview data={data} go={go} reload={reload} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────── course overview
function Overview({ data, go, reload }: { data: Data; go: (m: string | null, l?: string | null) => void; reload: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMonth() {
    setBusy(true);
    setMsg(null);
    try {
      let courseId = data.courses[0]?.id ?? data.modules[0]?.course_id;
      if (!courseId) {
        const c = must(await sb().from('courses').insert({ slug: 'inner-court', title: 'The Inner Court' }).select('id').single()) as { id: string };
        courseId = c.id;
      }
      const next = Math.max(0, ...data.modules.map((m) => m.month_no)) + 1;
      const m = must(await sb().from('modules').insert({ course_id: courseId, month_no: next, title: `Month ${next}` }).select('id').single()) as { id: string };
      reload();
      go(m.id);
    } catch (e) {
      setMsg(friendly(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const totalVideos = data.lessons.filter((l) => l.kind === 'video').length;
  const withVideo = data.lessons.filter((l) => l.kind === 'video' && l.bunny_video_id).length;

  return (
    <>
      <div className="spread studio-head">
        <div>
          <p className="eyebrow">Course studio</p>
          <h1>The Inner Court</h1>
          <p className="muted" style={{ margin: 0 }}>
            {data.modules.length} month{data.modules.length === 1 ? '' : 's'} · {data.lessons.length} lessons · {withVideo} of {totalVideos} videos uploaded
          </p>
        </div>
        <button className="btn btn-primary" onClick={addMonth} disabled={busy}>
          <Icon name="book" size={18} /> Add month
        </button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {data.modules.length === 0 && <Empty>No months yet. Press “Add month” to start the course.</Empty>}
      <div className="studio-modules">
        {data.modules.map((m) => {
          const ls = data.lessons.filter((l) => l.module_id === m.id);
          const vids = ls.filter((l) => l.kind === 'video');
          const ready = vids.filter((l) => l.bunny_video_id).length;
          const processing = ls.some((l) => l.video_status === 'processing' || l.video_status === 'uploading');
          return (
            <button key={m.id} className="studio-module card" onClick={() => go(m.id)}>
              <div className="studio-cover" style={m.cover_url ? { backgroundImage: `url("${m.cover_url}")` } : undefined}>
                {!m.cover_url && <span className="serif">{m.month_no}</span>}
              </div>
              <div className="studio-module-body">
                <div className="spread">
                  <span className="eyebrow">
                    Month {m.month_no}
                    {m.value ? ` · ${VALUE_LABEL[m.value]}` : ''}
                  </span>
                </div>
                <h3>{m.title}</h3>
                <div className="row studio-chips">
                  <span className="muted">
                    {ls.length} lesson{ls.length === 1 ? '' : 's'}
                    {vids.length ? ` · ${ready}/${vids.length} with video` : ''}
                  </span>
                </div>
                <div className="row studio-chips">
                  {isLocked(m.unlock_at) ? <LockChip at={m.unlock_at} /> : <Status kind="complete">{m.unlock_at ? 'Open' : 'Open now'}</Status>}
                  {processing && <Status kind="progress">Processing</Status>}
                  {vids.length > ready && <Status kind="attention">{vids.length - ready} without video</Status>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────── one month
function ModuleView({ data, mod, lessonId, go, reload }: { data: Data; mod: SModule; lessonId: string | null; go: (m: string | null, l?: string | null) => void; reload: () => void }) {
  const lessons = data.lessons.filter((l) => l.module_id === mod.id).sort((a, b) => a.position - b.position);
  const lesson = lessonId ? lessons.find((l) => l.id === lessonId) ?? null : null;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lesson && window.matchMedia('(max-width: 1100px)').matches) editorRef.current?.scrollIntoView({ block: 'start' });
  }, [lesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(friendly(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      reload();
    }
  }

  const addLesson = () =>
    run(async () => {
      const pos = Math.max(0, ...lessons.map((l) => l.position)) + 1;
      const l = must(await sb().from('lessons').insert({ module_id: mod.id, position: pos, title: `Lesson ${pos}`, kind: 'video' }).select('id').single()) as { id: string };
      go(mod.id, l.id);
    });

  // Swap positions safely under unique (module_id, position): park one lesson on a temporary spot first.
  const move = (i: number, dir: -1 | 1) =>
    run(async () => {
      const a = lessons[i];
      const b = lessons[i + dir];
      if (!a || !b) return;
      const temp = -1 - (Date.now() % 1_000_000_000);
      must(await sb().from('lessons').update({ position: temp }).eq('id', a.id));
      must(await sb().from('lessons').update({ position: a.position }).eq('id', b.id));
      must(await sb().from('lessons').update({ position: b.position }).eq('id', a.id));
    });

  const removeLesson = (l: SLesson) => {
    if (!confirm(`Delete “${l.title}”? Girls’ progress on this lesson and its workbooks will be deleted too. This cannot be undone.`)) return;
    return run(async () => {
      const { data: files } = await sb().from('lesson_resources').select('path').eq('lesson_id', l.id);
      if (files?.length) await sb().storage.from('course').remove(files.map((f: { path: string }) => f.path));
      must(await sb().from('lessons').delete().eq('id', l.id));
      // Close the gap so lessons stay numbered 1, 2, 3… (ascending order never collides).
      const rest = lessons.filter((x) => x.id !== l.id);
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].position !== i + 1) must(await sb().from('lessons').update({ position: i + 1 }).eq('id', rest[i].id));
      }
      if (lessonId === l.id) go(mod.id);
    });
  };

  const resCount = (id: string) => data.resources.filter((r) => r.lesson_id === id).length;

  return (
    <>
      <p className="muted" style={{ marginBottom: 8 }}>
        <button className="linkish" onClick={() => go(null)}>
          ← Course studio
        </button>{' '}
        / Month {mod.month_no}
      </p>
      <ModuleEditor key={mod.id} mod={mod} lessonCount={lessons.length} onSaved={reload} onDeleted={() => go(null)} />

      <div className="studio-split">
        <section className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Lessons</h3>
            <button className="btn btn-secondary" onClick={addLesson} disabled={busy}>
              Add lesson
            </button>
          </div>
          {msg && <p className="error" style={{ marginTop: 12 }}>{msg}</p>}
          {lessons.length === 0 && <Empty>No lessons in this month yet.</Empty>}
          <ol className="studio-lessons">
            {lessons.map((l, i) => (
              <li key={l.id} className={l.id === lessonId ? 'current' : ''}>
                <button className="studio-lesson-open" onClick={() => go(mod.id, l.id)} aria-current={l.id === lessonId ? 'true' : undefined}>
                  <span className="studio-num">{l.position}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong className="studio-title">{l.title}</strong>
                    <span className="row studio-chips">
                      <span className="muted small">{KINDS.find((k) => k[0] === l.kind)?.[1]}{l.duration_min ? ` · ${l.duration_min} min` : ''}{resCount(l.id) ? ` · ${resCount(l.id)} file${resCount(l.id) === 1 ? '' : 's'}` : ''}</span>
                      <VideoChip lesson={l} />
                      <LockChip at={l.unlock_at} />
                    </span>
                  </span>
                </button>
                <span className="studio-order">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Move “${l.title}” up`}>
                    ↑
                  </button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={busy || i === lessons.length - 1} aria-label={`Move “${l.title}” down`}>
                    ↓
                  </button>
                  <button className="icon-btn danger" onClick={() => removeLesson(l)} disabled={busy} aria-label={`Delete “${l.title}”`}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <div ref={editorRef}>
          {lesson ? (
            <LessonEditor key={lesson.id} lesson={lesson} onSaved={reload} onClose={() => go(mod.id)} />
          ) : (
            <div className="card card-soft">
              <h3>Choose a lesson to edit</h3>
              <p style={{ margin: 0 }}>Pick a lesson on the left to change its words, upload its video and add workbooks. Use the arrows to change the order girls see.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ModuleEditor({ mod, lessonCount, onSaved, onDeleted }: { mod: SModule; lessonCount: number; onSaved: () => void; onDeleted: () => void }) {
  const [f, setF] = useState({ title: mod.title, summary: mod.summary, value: mod.value ?? '', month_no: String(mod.month_no), unlock: toInput(mod.unlock_at) });
  const [cover, setCover] = useState(mod.cover_url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = f.title !== mod.title || f.summary !== mod.summary || f.value !== (mod.value ?? '') || f.month_no !== String(mod.month_no) || f.unlock !== toInput(mod.unlock_at);

  async function save(e: FormEvent) {
    e.preventDefault();
    const month = Number(f.month_no);
    if (!Number.isInteger(month) || month < 1) return setMsg({ ok: false, text: 'Month number must be 1 or more.' });
    setBusy(true);
    const { error } = await sb()
      .from('modules')
      .update({ title: f.title.trim() || `Month ${month}`, summary: f.summary, value: f.value || null, month_no: month, unlock_at: fromInput(f.unlock) })
      .eq('id', mod.id);
    setBusy(false);
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: 'Month saved.' });
    if (!error) onSaved();
  }

  async function pickCover(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const url = await uploadCover(file, mod.id);
      must(await sb().from('modules').update({ cover_url: url }).eq('id', mod.id));
      setCover(url);
      setMsg({ ok: true, text: 'Cover image updated.' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }
  async function removeCover() {
    const { error } = await sb().from('modules').update({ cover_url: null }).eq('id', mod.id);
    if (!error) {
      setCover(null);
      onSaved();
    }
  }

  async function del() {
    const warn = lessonCount
      ? `Delete Month ${mod.month_no} and its ${lessonCount} lesson${lessonCount === 1 ? '' : 's'}? Every lesson, video link, workbook and girls’ progress in this month will be deleted. This cannot be undone.`
      : `Delete Month ${mod.month_no}? This cannot be undone.`;
    if (!confirm(warn)) return;
    if (lessonCount && prompt(`Type DELETE to confirm removing Month ${mod.month_no}.`) !== 'DELETE') return;
    setBusy(true);
    const { data: ls } = await sb().from('lessons').select('id').eq('module_id', mod.id);
    const ids = (ls ?? []).map((l: { id: string }) => l.id);
    if (ids.length) {
      const { data: files } = await sb().from('lesson_resources').select('path').in('lesson_id', ids);
      if (files?.length) await sb().storage.from('course').remove(files.map((x: { path: string }) => x.path));
    }
    const { error } = await sb().from('modules').delete().eq('id', mod.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    onSaved();
    onDeleted();
  }

  return (
    <form className="card studio-module-form" onSubmit={save}>
      <div className="studio-cover-edit">
        <div className="studio-cover big" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
          {!cover && <span className="serif">{mod.month_no}</span>}
        </div>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {cover ? 'Change cover' : 'Add cover image'}
          </button>
          {cover && (
            <button type="button" className="linkish" onClick={removeCover}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void pickCover(file);
          }}
        />
      </div>
      <div className="studio-fields">
        <label className="field span-2">
          <span>Title</span>
          <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        </label>
        <label className="field">
          <span>Month number</span>
          <input type="number" min={1} max={24} value={f.month_no} onChange={(e) => setF({ ...f, month_no: e.target.value })} required />
        </label>
        <label className="field">
          <span>Value</span>
          <select value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })}>
            <option value="">No value</option>
            {VALUES.map((v) => (
              <option key={v} value={v}>
                {VALUE_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          <span>Unlocks (GMT) — leave empty to open now</span>
          <input type="datetime-local" value={f.unlock} onChange={(e) => setF({ ...f, unlock: e.target.value })} />
        </label>
        <label className="field span-2">
          <span>Summary</span>
          <textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} style={{ minHeight: 80 }} placeholder="What this month is about, in one or two sentences." />
        </label>
        <div className="row span-2">
          <button className="btn btn-primary" disabled={busy || !dirty}>
            {dirty ? 'Save month' : 'Saved'}
          </button>
          <LockChip at={mod.unlock_at} />
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost studio-danger" onClick={del} disabled={busy}>
            Delete month
          </button>
        </div>
        {msg && <p className={`span-2 ${msg.ok ? 'notice' : 'error'}`} role="status">{msg.text}</p>}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────── one lesson
function LessonEditor({ lesson: l, onSaved, onClose }: { lesson: SLesson; onSaved: () => void; onClose: () => void }) {
  const init = {
    title: l.title,
    kind: l.kind,
    summary: l.summary,
    body: l.body,
    journal_prompt: l.journal_prompt ?? '',
    duration_min: l.duration_min == null ? '' : String(l.duration_min),
    size_mb_480p: l.size_mb_480p == null ? '' : String(l.size_mb_480p),
    unlock: toInput(l.unlock_at),
  };
  const [f, setF] = useState(init);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; note?: string } | null>(null);
  const dirty = (Object.keys(init) as (keyof typeof init)[]).some((k) => init[k] !== f[k]);
  const estimate = f.duration_min ? Math.max(1, Math.round(Number(f.duration_min) * MB_PER_MIN_480P)) : null;

  // Keep the fields in step when the server fills in duration after encoding.
  useEffect(() => {
    setF((cur) => ({
      ...cur,
      duration_min: cur.duration_min || (l.duration_min == null ? '' : String(l.duration_min)),
      size_mb_480p: cur.size_mb_480p || (l.size_mb_480p == null ? '' : String(l.size_mb_480p)),
    }));
  }, [l.duration_min, l.size_mb_480p]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))));
    const duration = num(f.duration_min);
    const size = num(f.size_mb_480p) ?? (duration ? Math.max(1, Math.round(duration * MB_PER_MIN_480P)) : null);
    const { error } = await sb()
      .from('lessons')
      .update({
        title: f.title.trim() || 'Untitled lesson',
        kind: f.kind,
        summary: f.summary,
        body: f.body,
        journal_prompt: f.journal_prompt.trim() || null,
        duration_min: duration,
        size_mb_480p: size,
        unlock_at: fromInput(f.unlock),
      })
      .eq('id', l.id);
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Lesson saved.' });
    if (!error) {
      setF((cur) => ({ ...cur, size_mb_480p: size == null ? '' : String(size) }));
      onSaved();
    }
  }

  async function loadPreview() {
    setPreview({ url: null, note: 'Loading…' });
    try {
      const r = await api<{ embed_url: string | null; note?: string }>(`/lessons/${l.id}/play`);
      setPreview({ url: r.embed_url, note: r.embed_url ? undefined : r.note ?? 'No video on this lesson yet.' });
    } catch (e) {
      setPreview({ url: null, note: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="stack studio-editor">
      <form className="card" onSubmit={save}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Lesson {l.position}</p>
            <div className="row studio-chips">
              <VideoChip lesson={l} />
              <LockChip at={l.unlock_at} />
            </div>
          </div>
          <div className="row">
            <Link className="btn btn-ghost" to={`/app/lesson/${l.id}`} target="_blank" rel="noopener">
              Preview as member
            </Link>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="studio-fields">
          <label className="field span-2">
            <span>Title</span>
            <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </label>
          <label className="field">
            <span>Kind</span>
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as SLesson['kind'] })}>
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Unlocks (GMT)</span>
            <input type="datetime-local" value={f.unlock} onChange={(e) => setF({ ...f, unlock: e.target.value })} />
          </label>
          <label className="field">
            <span>Length (minutes)</span>
            <input type="number" min={0} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} />
          </label>
          <label className="field">
            <span>Data at 480p (MB)</span>
            <input type="number" min={0} value={f.size_mb_480p} onChange={(e) => setF({ ...f, size_mb_480p: e.target.value })} placeholder={estimate ? `about ${estimate}` : 'auto'} />
          </label>
          <label className="field span-2">
            <span>Summary</span>
            <textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} style={{ minHeight: 70 }} placeholder="One or two sentences under the video." />
          </label>
          <label className="field span-2">
            <span>Lesson text</span>
            <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ minHeight: 200 }} placeholder="Plain text. Leave an empty line between paragraphs." />
          </label>
          <label className="field span-2">
            <span>Journal prompt</span>
            <input type="text" value={f.journal_prompt} onChange={(e) => setF({ ...f, journal_prompt: e.target.value })} placeholder="What stayed with you from this lesson?" />
          </label>
          <div className="row span-2">
            <button className="btn btn-primary" disabled={busy || !dirty}>
              {dirty ? 'Save lesson' : 'Saved'}
            </button>
            {msg && <span className={msg.ok ? 'muted' : 'error'} role="status">{msg.text}</span>}
          </div>
        </div>
      </form>

      <section className="card">
        <h3>Video</h3>
        {f.kind !== 'video' && !l.bunny_video_id && <p className="muted">This is a {f.kind} lesson — a video is optional.</p>}
        <VideoUploader lesson={l} onChange={onSaved} />
        {l.bunny_video_id && (
          <div style={{ marginTop: 16 }}>
            {preview?.url ? (
              <div className="player">
                <iframe src={preview.url} title={`Preview: ${l.title}`} loading="lazy" allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              </div>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={loadPreview}>
                  <Icon name="play" size={18} /> Preview video
                </button>
                {preview?.note && <p className="muted" style={{ marginTop: 8 }}>{preview.note}</p>}
              </>
            )}
          </div>
        )}
      </section>

      <Resources lessonId={l.id} onChange={onSaved} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────── workbooks & resources
const RES_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/aac';
const RES_TYPES = RES_ACCEPT.split(',');
const RES_MAX = 50 * 1024 * 1024;

function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const stem = (dot > 0 ? name.slice(0, dot) : name).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'file';
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return { stem, ext, full: ext ? `${stem}.${ext}` : stem };
}

function Resources({ lessonId, onChange }: { lessonId: string; onChange: () => void }) {
  const { data, error, loading, reload } = useLoad(
    async () => (must(await sb().from('lesson_resources').select('*').eq('lesson_id', lessonId).order('created_at')) ?? []) as Resource[],
    [lessonId],
  );
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(files: FileList) {
    setMsg(null);
    for (const file of Array.from(files)) {
      if (!RES_TYPES.includes(file.type)) {
        setMsg(`“${file.name}” is not a PDF, image or audio file.`);
        continue;
      }
      if (file.size > RES_MAX) {
        setMsg(`“${file.name}” is ${fmtBytes(file.size)} — the limit is 50 MB. Compress the PDF and try again.`);
        continue;
      }
      setBusy(`Uploading ${file.name}…`);
      const n = safeName(file.name);
      let path = `lessons/${lessonId}/${n.full}`;
      let res = await sb().storage.from('course').upload(path, file, { contentType: file.type });
      if (res.error && /exist|duplicate/i.test(res.error.message)) {
        path = `lessons/${lessonId}/${n.stem}-${Date.now().toString(36)}${n.ext ? '.' + n.ext : ''}`;
        res = await sb().storage.from('course').upload(path, file, { contentType: file.type });
      }
      if (res.error) {
        setMsg(res.error.message);
        continue;
      }
      const shown = (files.length === 1 && title.trim()) || file.name.replace(/\.[^.]+$/, '');
      const { error } = await sb().from('lesson_resources').insert({ lesson_id: lessonId, title: shown, path, size_bytes: file.size });
      if (error) {
        await sb().storage.from('course').remove([path]);
        setMsg(error.message);
      }
    }
    setBusy(null);
    setTitle('');
    reload();
    onChange();
  }

  async function remove(r: Resource) {
    if (!confirm(`Delete “${r.title}”? Girls will no longer be able to download it.`)) return;
    setBusy(`Deleting ${r.title}…`);
    await sb().storage.from('course').remove([r.path]);
    const { error } = await sb().from('lesson_resources').delete().eq('id', r.id);
    setBusy(null);
    if (error) setMsg(error.message);
    reload();
    onChange();
  }

  async function open(r: Resource) {
    const { data: s, error } = await sb().storage.from('course').createSignedUrl(r.path, 3600);
    if (error || !s) return setMsg(error?.message ?? 'Could not open the file');
    window.open(s.signedUrl, '_blank', 'noopener');
  }

  return (
    <section className="card">
      <h3>Workbooks &amp; resources</h3>
      <p className="muted">PDF workbooks, printable images or audio (up to 50 MB each). Only enrolled girls and their parents can download them.</p>
      {loading && !data && <Loading lines={2} />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data && data.length > 0 && (
        <ul className="list">
          {data.map((r) => (
            <li key={r.id}>
              <Icon name="file" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" className="linkish studio-title" onClick={() => open(r)}>
                  {r.title}
                </button>
                <div className="muted small">{fmtBytes(r.size_bytes)} · {r.path.split('/').pop()}</div>
              </div>
              <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label={`Delete ${r.title}`} disabled={!!busy}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && data.length === 0 && <p className="muted">No files on this lesson yet.</p>}
      <div className="row" style={{ alignItems: 'flex-end', marginTop: 12 }}>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span>Name shown to girls (optional)</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Month 1 workbook" />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          Upload file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={RES_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) void add(files).finally(() => (e.target.value = ''));
          }}
        />
      </div>
      {busy && <p className="notice" role="status" style={{ marginTop: 12 }}>{busy}</p>}
      {msg && <p className="error" role="alert" style={{ marginTop: 12 }}>{msg}</p>}
    </section>
  );
}
