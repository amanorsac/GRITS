import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Upload } from 'tus-js-client';
import { api } from '../lib/api';
import { sb } from '../lib/supabase';
import { Icon, Status } from './ui';

// Direct browser → Bunny Stream upload over TUS: chunked and resumable, so a dropped connection
// picks up where it stopped instead of starting again. The Worker creates the video and signs
// the upload; the Bunny API key never reaches the browser.

export type VideoLesson = { id: string; title: string; bunny_video_id: string | null; video_status: string | null };

type Creds = { endpoint: string; videoId: string; libraryId: string; expires: number; signature: string };
type Phase = 'idle' | 'starting' | 'uploading' | 'paused' | 'processing' | 'ready' | 'failed';
type StatusRes = { videoId: string; status: 'uploading' | 'processing' | 'ready' | 'failed'; progress: number; length_seconds: number };

const CHUNK = 5 * 1024 * 1024; // 5 MB — small enough to retry cheaply on a mobile connection
const credKey = (lessonId: string, f: File) => `gg.tus.${lessonId}.${f.name}.${f.size}.${f.lastModified}`;

function readCreds(key: string): Creds | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw) as Creds;
    return c.expires * 1000 > Date.now() + 60 * 60 * 1000 ? c : null; // at least an hour left
  } catch {
    return null;
  }
}
function writeCreds(key: string, c: Creds | null) {
  try {
    if (c) localStorage.setItem(key, JSON.stringify(c));
    else localStorage.removeItem(key);
  } catch {
    /* private mode — resuming after a reload just won't be possible */
  }
}

export function fmtBytes(n: number | null | undefined) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function initialPhase(l: VideoLesson): Phase {
  if (!l.bunny_video_id) return 'idle';
  if (l.video_status === 'processing' || l.video_status === 'uploading') return 'processing';
  if (l.video_status === 'failed') return 'failed';
  return 'ready';
}

export function VideoUploader({ lesson, onChange }: { lesson: VideoLesson; onChange: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(lesson));
  const [pct, setPct] = useState(0);
  const [bytes, setBytes] = useState<[number, number]>([0, 0]);
  const [encode, setEncode] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [existing, setExisting] = useState('');
  const [drag, setDrag] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(lesson.bunny_video_id);
  const upload = useRef<Upload | null>(null);
  // The video to fall back to if an upload is cancelled (not a half-finished one).
  const previous = useRef<string | null>(lesson.video_status === 'uploading' ? null : lesson.bunny_video_id);
  const storeKey = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Warn before closing the tab mid-upload.
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'starting') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [phase]);

  // While Bunny encodes, ask every 6 seconds.
  useEffect(() => {
    if (phase !== 'processing' || !videoId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await api<StatusRes>(`/admin/videos/${encodeURIComponent(videoId)}`);
        if (stop) return;
        setEncode(s.progress);
        if (s.status === 'ready') {
          setPhase('ready');
          setMsg('Video ready. Girls can watch it as soon as the lesson unlocks.');
          onChange();
          return;
        }
        if (s.status === 'uploading') {
          setPhase('idle');
          setMsg('An upload for this lesson did not finish. Choose the same file again and it continues from where it stopped.');
          return;
        }
        if (s.status === 'failed') {
          setPhase('failed');
          setMsg('Bunny could not process this file. Try exporting it again as MP4 (H.264) and re-upload.');
          onChange();
          return;
        }
      } catch (e) {
        if (stop) return;
        setMsg(e instanceof Error ? e.message : String(e));
        if ((e as { status?: number }).status === 503) return; // not connected — polling won't help
      }
      timer = setTimeout(tick, 6000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, videoId]);

  async function start(file: File) {
    setMsg(null);
    if (!file.type.startsWith('video/')) return setMsg('That is not a video file. Choose an MP4, MOV or similar.');
    setPhase('starting');
    const key = credKey(lesson.id, file);
    storeKey.current = key;
    try {
      let creds = readCreds(key);
      if (!creds) {
        creds = await api<Creds>('/admin/videos', { body: { title: lesson.title, lesson_id: lesson.id } });
        writeCreds(key, creds);
      } else {
        // Resuming: make sure the lesson points at the video being resumed.
        await sb().from('lessons').update({ bunny_video_id: creds.videoId, video_status: 'uploading' }).eq('id', lesson.id);
      }
      const c = creds;
      setVideoId(c.videoId);
      const up = new Upload(file, {
        endpoint: c.endpoint,
        chunkSize: CHUNK,
        retryDelays: [0, 3000, 6000, 12000, 30000, 60000, 120000],
        removeFingerprintOnSuccess: true,
        headers: {
          AuthorizationSignature: c.signature,
          AuthorizationExpire: String(c.expires),
          VideoId: c.videoId,
          LibraryId: String(c.libraryId),
        },
        metadata: { filetype: file.type, title: lesson.title },
        onProgress(sent, total) {
          setBytes([sent, total]);
          setPct(total ? Math.floor((100 * sent) / total) : 0);
        },
        onError(err) {
          setPhase('paused');
          setMsg(`The upload stopped: ${err.message.split('\n')[0]}. Press Resume when your connection is back — it continues from where it stopped.`);
        },
        onSuccess() {
          writeCreds(key, null);
          upload.current = null;
          setPct(100);
          setPhase('processing');
          setMsg(null);
          void sb().from('lessons').update({ video_status: 'processing' }).eq('id', lesson.id);
          onChange();
        },
      });
      upload.current = up;
      const prev = await up.findPreviousUploads();
      if (prev.length) up.resumeFromPreviousUpload(prev[0]);
      up.start();
      setPhase('uploading');
    } catch (e) {
      setPhase(previous.current ? initialPhase(lesson) : 'idle');
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function pause() {
    void upload.current?.abort();
    setPhase('paused');
  }
  function resume() {
    setMsg(null);
    upload.current?.start();
    setPhase('uploading');
  }
  async function cancel() {
    if (!confirm('Cancel this upload? What has been sent so far will be discarded.')) return;
    await upload.current?.abort();
    upload.current = null;
    if (storeKey.current) writeCreds(storeKey.current, null);
    // Put back whatever video the lesson had before.
    const restore = previous.current;
    await sb().from('lessons').update({ bunny_video_id: restore, video_status: restore ? 'ready' : null }).eq('id', lesson.id);
    setVideoId(restore);
    setPhase(restore ? 'ready' : 'idle');
    setPct(0);
    setMsg('Upload cancelled.');
    onChange();
  }

  async function useExisting() {
    const id = existing.trim();
    if (!/^[0-9a-f-]{20,}$/i.test(id)) return setMsg('That does not look like a Bunny video ID (it looks like 4f1c2a…-…).');
    const { error } = await sb().from('lessons').update({ bunny_video_id: id, video_status: 'processing' }).eq('id', lesson.id);
    if (error) return setMsg(error.message);
    previous.current = id;
    setVideoId(id);
    setExisting('');
    setMsg(null);
    setPhase('processing');
    onChange();
  }

  async function removeVideo() {
    if (!confirm('Remove the video from this lesson? The file stays in Bunny Stream; girls will see “coming soon”.')) return;
    const { error } = await sb().from('lessons').update({ bunny_video_id: null, video_status: null }).eq('id', lesson.id);
    if (error) return setMsg(error.message);
    previous.current = null;
    setVideoId(null);
    setPhase('idle');
    onChange();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void start(f);
  }

  const busy = phase === 'starting' || phase === 'uploading' || phase === 'paused';

  return (
    <div className="uploader">
      {busy ? (
        <div className="upload-progress" aria-live="polite">
          <div className="spread">
            <strong>{phase === 'paused' ? 'Paused' : phase === 'starting' ? 'Preparing upload…' : 'Uploading'}</strong>
            <span className="muted">
              {pct}%{bytes[1] ? ` · ${fmtBytes(bytes[0])} of ${fmtBytes(bytes[1])}` : ''}
            </span>
          </div>
          <div className="bar bar-lg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Keep this page open until the upload finishes. If the connection drops it resumes by itself — or choose the same file again later and it continues.
          </p>
          <div className="row">
            {phase === 'uploading' && (
              <button type="button" className="btn btn-secondary" onClick={pause}>
                Pause
              </button>
            )}
            {phase === 'paused' && (
              <button type="button" className="btn btn-primary" onClick={resume}>
                Resume
              </button>
            )}
            {phase !== 'starting' && (
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancel upload
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {phase === 'processing' && (
            <div className="upload-progress" aria-live="polite">
              <div className="spread">
                <Status kind="progress">Processing</Status>
                <span className="muted">{encode ? `${encode}% encoded` : 'Waiting for Bunny…'}</span>
              </div>
              <div className="bar bar-lg">
                <i style={{ width: `${Math.max(3, encode)}%` }} />
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                Processing — you can leave this page. The video will be marked ready on its own.
              </p>
            </div>
          )}
          {phase === 'ready' && (
            <div className="row">
              <Status kind="complete">Video ready</Status>
              <span className="muted small">Bunny ID {videoId}</span>
            </div>
          )}
          {phase === 'failed' && <Status kind="safety">Video failed</Status>}
          <div
            className={`dropzone${drag ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <Icon name="play" size={28} />
            <p style={{ margin: 0 }}>
              <strong>{phase === 'idle' ? 'Add the lesson video' : 'Replace the video'}</strong>
              <br />
              <span className="muted">Drag a video file here, or</span>
            </p>
            <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
              Choose a video
            </button>
            <input
              ref={input}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void start(f);
              }}
            />
          </div>
          <details className="studio-details">
            <summary>Use a video already in Bunny Stream</summary>
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <span>Bunny video ID</span>
                <input type="text" value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="e.g. 4f1c2a9e-…" />
              </label>
              <button type="button" className="btn btn-secondary" onClick={useExisting} disabled={!existing.trim()}>
                Use this video
              </button>
            </div>
          </details>
          {videoId && phase !== 'processing' && (
            <button type="button" className="linkish" onClick={removeVideo}>
              Remove video from this lesson
            </button>
          )}
        </>
      )}
      {msg && (
        <p className={phase === 'failed' || /not connected|rejected|could not|stopped/i.test(msg) ? 'error' : 'notice'} role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
