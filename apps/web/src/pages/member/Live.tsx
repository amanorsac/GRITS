import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Empty, ErrorBox, Icon, Loading, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { timeAgo, when } from '../../lib/format';
import { useLoad } from '../../lib/hooks';
import { sb } from '../../lib/supabase';
import type { LiveSession } from '../../lib/types';

export function LiveList() {
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await sb()
      .from('live_sessions')
      .select('*')
      .gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString())
      .order('starts_at')
      .limit(20);
    if (error) throw error;
    return data as LiveSession[];
  });
  return (
    <>
      <p className="eyebrow">The Throne Room</p>
      <h1>Live sessions</h1>
      <p className="muted">Circle mentor hours and whole-Academy broadcasts. Low on data? Every room has an audio-only mode.</p>
      {loading && <Loading />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {data?.length === 0 && <Empty>No sessions scheduled yet. Your mentor will add the next one here.</Empty>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 16 }}>
        {data?.map((s) => (
          <Link key={s.id} to={`/app/live/${s.id}`} className={`card ${s.is_live ? 'card-soft' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="spread">
              {s.is_live ? <span className="live-badge">Live</span> : <span className="eyebrow">{s.kind === 'broadcast' ? 'Broadcast' : 'Circle'}</span>}
            </div>
            <h3 style={{ marginTop: 8 }}>{s.title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {when(s.starts_at)} GMT{s.host_name ? ` · ${s.host_name}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

export function LiveRoom() {
  const { sessionId } = useParams();
  const { data: s, error, loading, reload } = useLoad(async () => {
    const { data, error } = await sb().from('live_sessions').select('*').eq('id', sessionId!).single();
    if (error) throw error;
    return data as LiveSession;
  }, [sessionId]);
  const [audioOnly, setAudioOnly] = useState(false);
  const [room, setRoom] = useState<{ provider: string; url: string } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setJoinError(null);
    try {
      setRoom(await api<{ provider: string; url: string }>(`/live/${sessionId}/join`, { body: { audio_only: audioOnly } }));
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !s) return <ErrorBox error={error ?? 'Session not found'} onRetry={reload} />;
  const started = new Date(s.starts_at) < new Date();

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/app/live" className="row" style={{ textDecoration: 'none' }}>
        <Icon name="back" size={18} /> The Throne Room
      </Link>
      <div className="spread">
        <div>
          {s.is_live && <span className="live-badge">Live</span>}
          <h1 style={{ marginTop: 8 }}>{s.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {s.host_name ?? 'The Academy'} · {started ? `started ${timeAgo(s.starts_at)}` : when(s.starts_at) + ' GMT'}
          </p>
        </div>
      </div>
      <div className="live-stage">
        {room ? (
          <iframe src={room.url} title={s.title} allow="camera; microphone; fullscreen; display-capture; autoplay" allowFullScreen />
        ) : (
          <div className="player" style={{ position: 'absolute', inset: 0, borderRadius: 0 }}>
            <div className="poster">
              <div className="stack" style={{ maxWidth: 420 }}>
                <Icon name="live" size={40} />
                <p>{s.kind === 'broadcast' ? 'The broadcast plays right here, inside the Academy.' : 'Your Circle meets here. Cameras start off — switch yours on when you are ready.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {!room && (
        <div className="card">
          {s.kind === 'interactive' && (
            <div className="perm" style={{ paddingTop: 0 }}>
              <div>
                <strong>Audio only — save data</strong>
                <div className="muted">Low on data? Stay in the room for a fraction of the bundle.</div>
              </div>
              <Switch checked={audioOnly} onChange={setAudioOnly} label="Audio only" />
            </div>
          )}
          {joinError && <p className="error">{joinError}</p>}
          <button className="btn btn-primary" onClick={join} disabled={busy} style={{ marginTop: 12 }}>
            {busy ? 'Opening the room…' : 'Join the room'}
          </button>
          <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
            Chat is moderated. Sessions may be recorded and become a lesson for your Circle.
          </p>
        </div>
      )}
    </div>
  );
}
