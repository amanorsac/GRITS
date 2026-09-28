import type { PostKind } from './api';
import { must, supabase } from './supabase';
import type { Post, PublicProfile, ReactionKind, Reply, Space } from './types';

export const PAGE_SIZE = 15;

export const REACTIONS: { kind: ReactionKind; label: string }[] = [
  { kind: 'crown', label: 'Crown' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'praying', label: 'Praying' },
  { kind: 'amen', label: 'Amen' },
];

export const POST_KINDS: { kind: PostKind; label: string }[] = [
  { kind: 'general', label: 'Post' },
  { kind: 'win', label: 'Win of the Week' },
  { kind: 'prayer', label: 'Prayer' },
  { kind: 'books', label: 'Books' },
  { kind: 'scripture', label: 'Scripture' },
];

export const KIND_TAG: Partial<Record<PostKind, string>> = {
  win: 'WIN',
  prayer: 'PRAYER',
  books: 'BOOKS',
  scripture: 'SCRIPTURE',
};

export type FeedPost = Post & {
  author: PublicProfile | null;
  reactions: Record<ReactionKind, number>;
  mine: Set<ReactionKind>;
  replyCount: number;
};

/** Spaces she can see (RLS decides). Her Circle first, then the open Court in order. */
export async function loadSpaces(): Promise<Space[]> {
  const rows = must(await supabase.from('spaces').select('id, slug, name, circle_id, position')) as Space[];
  return rows.sort((a, b) => {
    if (!!a.circle_id !== !!b.circle_id) return a.circle_id ? -1 : 1;
    return a.position - b.position;
  });
}

export async function loadAuthors(ids: string[]): Promise<Map<string, PublicProfile>> {
  const map = new Map<string, PublicProfile>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const rows = must(
    await supabase.from('public_profiles').select('id, display_name, role, crown_level, circle_id').in('id', unique),
  ) as PublicProfile[];
  for (const r of rows) map.set(r.id, r);
  return map;
}

/** One page of a space's feed, newest first. `before` pages back through older posts. */
export async function loadPosts(spaceId: string, userId: string, before?: string, limit = PAGE_SIZE): Promise<FeedPost[]> {
  let q = supabase
    .from('posts')
    .select('id, space_id, author_id, kind, body, status, created_at')
    .eq('space_id', spaceId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  const posts = must(await q) as Post[];
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);

  const [authors, reactions, replies] = await Promise.all([
    loadAuthors(posts.map((p) => p.author_id)),
    supabase.from('reactions').select('post_id, user_id, kind').in('post_id', ids),
    supabase.from('replies').select('post_id').in('post_id', ids).eq('status', 'approved'),
  ]);
  const reactionRows = must(reactions) as { post_id: string; user_id: string; kind: ReactionKind }[];
  const replyRows = must(replies) as { post_id: string }[];

  return posts.map((p) => {
    const counts: Record<ReactionKind, number> = { crown: 0, heart: 0, praying: 0, amen: 0 };
    const mine = new Set<ReactionKind>();
    for (const r of reactionRows) {
      if (r.post_id !== p.id) continue;
      counts[r.kind] += 1;
      if (r.user_id === userId) mine.add(r.kind);
    }
    return {
      ...p,
      author: authors.get(p.author_id) ?? null,
      reactions: counts,
      mine,
      replyCount: replyRows.filter((r) => r.post_id === p.id).length,
    };
  });
}

export async function setReaction(postId: string, userId: string, kind: ReactionKind, on: boolean) {
  if (on) {
    const { error } = await supabase.from('reactions').insert({ post_id: postId, user_id: userId, kind });
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .match({ post_id: postId, user_id: userId, kind });
    if (error) throw new Error(error.message);
  }
}

export type ReplyWithAuthor = Reply & { author: PublicProfile | null };

export async function loadReplies(postId: string): Promise<ReplyWithAuthor[]> {
  const rows = must(
    await supabase
      .from('replies')
      .select('id, post_id, author_id, body, status, created_at')
      .eq('post_id', postId)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })
      .limit(50),
  ) as Reply[];
  const authors = await loadAuthors(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: authors.get(r.author_id) ?? null }));
}

export async function reportContent(reporterId: string, target: { post_id?: string; reply_id?: string }, reason: string) {
  const { error } = await supabase.from('reports').insert({ reporter_id: reporterId, reason, ...target });
  if (error) throw new Error(error.message);
}

export async function blockPerson(blockerId: string, blockedId: string) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw new Error(error.message);
}
