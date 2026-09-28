import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Icon, Loading, ReactionGlyph, REACTIONS } from '../../components/ui';
import { api } from '../../lib/api';
import { isStaff, useAuth } from '../../lib/auth';
import { initials, isQuietHours, timeAgo } from '../../lib/format';
import { sb } from '../../lib/supabase';
import { KIND_LABEL, type Post, type Space } from '../../lib/types';

const PAGE = 20;
const COMPOSE_KINDS: [Post['kind'], string][] = [
  ['general', 'Post'],
  ['win', 'Win of the Week'],
  ['prayer', 'Prayer'],
  ['books', 'Books'],
  ['scripture', 'Scripture card'],
];

type FeedPost = Post & { author: string; authorRole: string; counts: Record<string, number>; mine: Set<string>; replyCount: number };
type Reply = { id: string; body: string; author_id: string; created_at: string; status: string };

async function loadFeed(spaceId: string, meId: string, before?: string) {
  let q = sb().from('posts').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  const posts = (data ?? []) as Post[];
  const ids = posts.map((p) => p.id);
  const authors = [...new Set(posts.map((p) => p.author_id))];
  const [people, reactions, replies] = await Promise.all([
    authors.length ? sb().from('public_profiles').select('id, display_name, role').in('id', authors) : Promise.resolve({ data: [] }),
    ids.length ? sb().from('reactions').select('post_id, user_id, kind').in('post_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? sb().from('replies').select('post_id').in('post_id', ids).eq('status', 'approved') : Promise.resolve({ data: [] }),
  ]);
  const who = new Map(((people.data ?? []) as { id: string; display_name: string; role: string }[]).map((p) => [p.id, p]));
  return posts.map<FeedPost>((p) => {
    const rs = ((reactions.data ?? []) as { post_id: string; user_id: string; kind: string }[]).filter((r) => r.post_id === p.id);
    const counts: Record<string, number> = {};
    rs.forEach((r) => (counts[r.kind] = (counts[r.kind] ?? 0) + 1));
    const a = who.get(p.author_id);
    return {
      ...p,
      author: a ? (a.role === 'mentor' ? `Mentor ${a.display_name}` : a.display_name) : 'A member',
      authorRole: a?.role ?? 'member',
      counts,
      mine: new Set(rs.filter((r) => r.user_id === meId).map((r) => r.kind)),
      replyCount: ((replies.data ?? []) as { post_id: string }[]).filter((r) => r.post_id === p.id).length,
    };
  });
}

export default function Court() {
  const { profile } = useAuth();
  const me = profile!;
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<Post['kind']>('general');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quiet = isQuietHours() && !isStaff(me);

  useEffect(() => {
    sb()
      .from('spaces')
      .select('*')
      .order('position')
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        const list = (data ?? []) as Space[];
        setSpaces(list);
        setActive(list[0]?.id ?? null);
        if (!list.length) setLoading(false);
      });
  }, []);

  const refresh = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const ps = await loadFeed(active, me.id);
      setPosts(ps);
      setMore(ps.length === PAGE);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [active, me.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function earlier() {
    const last = posts[posts.length - 1];
    if (!last || !active) return;
    const ps = await loadFeed(active, me.id, last.created_at);
    setPosts([...posts, ...ps]);
    setMore(ps.length === PAGE);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !active) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ status: string; reason?: string }>('/posts', { body: { space_id: active, kind, body: draft } });
      setDraft('');
      setKind('general');
      setNotice(
        r.status === 'approved'
          ? null
          : r.reason === 'first_post'
            ? 'Thanks — a mentor checks every first post before it appears. After that, you post freely.'
            : r.reason === 'safety'
              ? 'Thank you for sharing. A real adult at the Academy will see this and reach out to you.'
              : 'Thanks — a mentor will look at this before it appears.',
      );
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: FeedPost, k: string) {
    const on = p.mine.has(k);
    const next = posts.map((x) => {
      if (x.id !== p.id) return x;
      const mine = new Set(x.mine);
      const counts = { ...x.counts };
      if (on) {
        mine.delete(k);
        counts[k] = Math.max(0, (counts[k] ?? 1) - 1);
      } else {
        mine.add(k);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return { ...x, mine, counts };
    });
    setPosts(next);
    const res = on
      ? await sb().from('reactions').delete().match({ post_id: p.id, user_id: me.id, kind: k })
      : await sb().from('reactions').insert({ post_id: p.id, user_id: me.id, kind: k });
    if (res.error) void refresh();
  }

  if (spaces && spaces.length === 0)
    return (
      <Empty>
        <h2>The Court is resting for you</h2>
        <p>The Court opens when your parent switches it on. Your lessons and live sessions are always here.</p>
      </Empty>
    );

  const activeSpace = spaces?.find((s) => s.id === active);

  return (
    <div className="two-col">
      <div>
        <div className="spread">
          <h1>{activeSpace?.name ?? 'The Court'}</h1>
          <Link to="/app/help">Talk to someone</Link>
        </div>
        <div className="row" role="tablist" aria-label="Spaces" style={{ marginBottom: 16 }}>
          {spaces?.map((s) => (
            <button key={s.id} className="chip" role="tab" aria-pressed={s.id === active} onClick={() => setActive(s.id)}>
              {s.name}
            </button>
          ))}
        </div>

        <form className="card stack" onSubmit={submit} style={{ marginBottom: 16 }}>
          {quiet ? (
            <p className="muted" style={{ margin: 0 }}>
              The Court closes at 9:00 pm and opens again at 6:00 am. Lessons stay open all night.
            </p>
          ) : (
            <>
              <label className="field">
                <span style={{ position: 'absolute', left: -9999 }}>Write a post</span>
                <textarea placeholder="Write a post" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 80 }} />
              </label>
              <div className="spread">
                <div className="row" style={{ gap: 6 }}>
                  {COMPOSE_KINDS.map(([k, label]) => (
                    <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                      {label}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" disabled={busy || !draft.trim()}>
                  Post
                </button>
              </div>
            </>
          )}
          {notice && <p className="notice" style={{ margin: 0 }}>{notice}</p>}
        </form>

        {error && <ErrorBox error={error} onRetry={refresh} />}
        {loading && !posts.length ? (
          <Loading lines={5} />
        ) : posts.length === 0 ? (
          <Empty>No posts here yet. Be the first — share a win, a prayer, or a book you love.</Empty>
        ) : (
          <div className="stack">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} meId={me.id} onReact={toggle} onChanged={refresh} />
            ))}
            {more && (
              <button className="btn btn-secondary btn-block" onClick={earlier}>
                Show earlier posts
              </button>
            )}
          </div>
        )}
      </div>

      <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="card card-soft">
          <p className="eyebrow">House rules</p>
          <p style={{ margin: 0 }}>Posts are checked before they appear. There is no dislike button here, and nothing you post leaves the Academy.</p>
        </section>
        <section className="card">
          <h3>Quiet hours</h3>
          <p className="muted" style={{ margin: 0 }}>
            Open until 9:00 pm. The Court goes read-only overnight. Lessons stay available.
          </p>
        </section>
      </aside>
    </div>
  );
}

function PostCard({ post: p, meId, onReact, onChanged }: { post: FeedPost; meId: string; onReact: (p: FeedPost, k: string) => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<(Reply & { author: string })[] | null>(null);
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  async function loadReplies() {
    const { data } = await sb().from('replies').select('*').eq('post_id', p.id).order('created_at');
    const rs = (data ?? []) as Reply[];
    const ids = [...new Set(rs.map((r) => r.author_id))];
    const { data: people } = ids.length ? await sb().from('public_profiles').select('id, display_name').in('id', ids) : { data: [] };
    const names = new Map((people ?? []).map((x) => [x.id, x.display_name]));
    setReplies(rs.map((r) => ({ ...r, author: names.get(r.author_id) ?? 'A member' })));
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ status: string }>('/replies', { body: { post_id: p.id, body: reply } });
      setReply('');
      setMsg(r.status === 'approved' ? null : 'A mentor will check your reply before it appears.');
      await loadReplies();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function report() {
    const { error } = await sb().from('reports').insert({ post_id: p.id, reporter_id: meId, reason: 'unkind' });
    setMenu(false);
    setMsg(error ? error.message : 'Thank you. A mentor will look at this. The writer will not know it was you.');
  }
  async function block() {
    const { error } = await sb().from('blocks').insert({ blocker_id: meId, blocked_id: p.author_id });
    setMenu(false);
    if (!error) onChanged();
  }

  return (
    <article className="card post">
      <header>
        <div className={`avatar${p.authorRole === 'mentor' ? ' gold' : ''}`}>{initials(p.author.replace(/^Mentor /, ''))}</div>
        <div style={{ flex: 1 }}>
          <strong>{p.author}</strong>
          <div className="muted small">{timeAgo(p.created_at)}{p.status === 'pending' ? ' · waiting for a mentor to check' : ''}</div>
        </div>
        {p.author_id !== meId && (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" aria-label="More options" aria-expanded={menu} onClick={() => setMenu(!menu)} style={{ padding: '0 10px' }}>
              <Icon name="flag" size={18} />
            </button>
            {menu && (
              <div className="card" style={{ position: 'absolute', right: 0, top: 48, zIndex: 5, padding: 8, minWidth: 200 }}>
                <button className="btn btn-ghost btn-block" onClick={report}>
                  Report this post
                </button>
                <button className="btn btn-ghost btn-block" onClick={block}>
                  Hide posts from {p.author.split(' ')[0]}
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      {KIND_LABEL[p.kind] && <div className="kind">{KIND_LABEL[p.kind]}</div>}
      <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{p.body}</p>
      {p.status === 'approved' && (
        <div className="reactions">
          {REACTIONS.map((r) => (
            <button key={r.kind} className="reaction" aria-pressed={p.mine.has(r.kind)} aria-label={`${r.label}, ${p.counts[r.kind] ?? 0}`} onClick={() => onReact(p, r.kind)}>
              <ReactionGlyph kind={r.kind} /> {r.label}
              {p.counts[r.kind] ? ` · ${p.counts[r.kind]}` : ''}
            </button>
          ))}
          <button
            className="reaction"
            onClick={() => {
              setOpen(!open);
              if (!replies) void loadReplies();
            }}
            aria-expanded={open}
          >
            {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}
      {msg && <p className="notice" style={{ marginTop: 12 }}>{msg}</p>}
      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {replies?.map((r) => (
            <div key={r.id} className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '.8rem' }}>
                {initials(r.author)}
              </div>
              <div>
                <strong>{r.author}</strong> <span className="muted small">{timeAgo(r.created_at)}</span>
                <div>{r.body}</div>
              </div>
            </div>
          ))}
          {!isQuietHours() && (
            <form onSubmit={sendReply} className="row">
              <input type="text" placeholder="Write a reply" value={reply} onChange={(e) => setReply(e.target.value)} style={{ flex: 1 }} maxLength={1000} />
              <button className="btn btn-primary" disabled={!reply.trim()}>
                Reply
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
