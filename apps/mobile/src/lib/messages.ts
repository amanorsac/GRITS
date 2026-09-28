// Mentor messages. RLS (dm_threads_start, dm_messages_send) is the real gate; this mirrors it in the UI:
// a girl may message only her own Circle's mentor, only while member_permissions.mentor_dm is on,
// and she is the one who starts the thread. A mentor sees and replies to threads where mentor_id = her.
import { loadAuthors } from './community';
import { must, supabase } from './supabase';
import type { Circle, DmMessage, DmThread, Profile, PublicProfile } from './types';

export const MESSAGE_MAX = 2000;

export const SAFETY_NOTE =
  "Messages with your mentor are kept safe and can be reviewed by the Academy. Your parent can't read them.";
export const MENTOR_SAFETY_NOTE = 'Messages are kept safe and can be reviewed by the Academy.';

export const NO_CIRCLE_COPY = "You'll be able to message your mentor once you're placed in a Circle.";
export const DM_OFF_COPY = 'Your parent has turned off mentor messages. Talk to someone is always available.';

export type ThreadSummary = { thread: DmThread; other: PublicProfile | null; last: DmMessage | null };

/** Newest message per thread. */
async function lastMessages(threadIds: string[]): Promise<Map<string, DmMessage>> {
  const map = new Map<string, DmMessage>();
  if (threadIds.length === 0) return map;
  const rows = must(
    await supabase
      .from('dm_messages')
      .select('id, thread_id, sender_id, body, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(Math.min(1000, threadIds.length * 25)),
  ) as DmMessage[];
  for (const m of rows) if (!map.has(m.thread_id)) map.set(m.thread_id, m);
  return map;
}

function byRecent(a: ThreadSummary, b: ThreadSummary): number {
  const ta = a.last?.created_at ?? a.thread.created_at;
  const tb = b.last?.created_at ?? b.thread.created_at;
  return tb.localeCompare(ta);
}

async function mentorDmAllowed(memberId: string): Promise<boolean> {
  const row = must(
    await supabase.from('member_permissions').select('mentor_dm').eq('member_id', memberId).maybeSingle(),
  ) as { mentor_dm: boolean } | null;
  // No permissions row means the insert policy cannot pass either, so treat it as off.
  return !!row?.mentor_dm;
}

// ── A girl's inbox ──────────────────────────────────────────────────────────
export type MemberInbox = {
  kind: 'member';
  state: 'no-circle' | 'off' | 'ready';
  circle: Circle | null;
  mentor: PublicProfile | null;
  /** Her Circle, mentor first. */
  ring: PublicProfile[];
  thread: ThreadSummary | null;
};

export async function loadMemberInbox(me: Profile): Promise<MemberInbox> {
  const empty: MemberInbox = { kind: 'member', state: 'no-circle', circle: null, mentor: null, ring: [], thread: null };
  if (!me.circle_id) return empty;

  const [circleRes, allowed, membersRes] = await Promise.all([
    supabase.from('circles').select('id, name, mentor_id').eq('id', me.circle_id).maybeSingle(),
    mentorDmAllowed(me.id),
    supabase
      .from('public_profiles')
      .select('id, display_name, role, crown_level, circle_id')
      .eq('circle_id', me.circle_id)
      .order('display_name')
      .limit(60),
  ]);
  const circle = must(circleRes) as Circle | null;
  const members = (must(membersRes) as PublicProfile[]).filter((p) => p.id !== me.id);
  if (!circle?.mentor_id) return { ...empty, circle, ring: members };

  const mentor = (await loadAuthors([circle.mentor_id])).get(circle.mentor_id) ?? null;
  const ring = [...(mentor ? [mentor] : []), ...members.filter((p) => p.id !== circle.mentor_id)];

  const threadRow = must(
    await supabase
      .from('dm_threads')
      .select('id, member_id, mentor_id, created_at')
      .eq('member_id', me.id)
      .eq('mentor_id', circle.mentor_id)
      .maybeSingle(),
  ) as DmThread | null;
  const last = threadRow ? (await lastMessages([threadRow.id])).get(threadRow.id) ?? null : null;

  return {
    kind: 'member',
    state: allowed ? 'ready' : 'off',
    circle,
    mentor,
    ring,
    thread: threadRow ? { thread: threadRow, other: mentor, last } : null,
  };
}

/** Finds her thread with her mentor, or starts it (she is always the one who starts it). */
export async function openMentorThread(memberId: string, mentorId: string): Promise<string> {
  const existing = must(
    await supabase.from('dm_threads').select('id').eq('member_id', memberId).eq('mentor_id', mentorId).maybeSingle(),
  ) as { id: string } | null;
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from('dm_threads')
    .insert({ member_id: memberId, mentor_id: mentorId })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return openMentorThread(memberId, mentorId);
    throw new Error('Messages with your mentor are not open right now.');
  }
  return (data as { id: string }).id;
}

// ── A mentor's inbox ────────────────────────────────────────────────────────
export type MentorInbox = { kind: 'mentor'; threads: ThreadSummary[] };

export async function loadMentorInbox(me: Profile): Promise<MentorInbox> {
  const threads = must(
    await supabase
      .from('dm_threads')
      .select('id, member_id, mentor_id, created_at')
      .eq('mentor_id', me.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ) as DmThread[];
  const [people, last] = await Promise.all([
    loadAuthors(threads.map((t) => t.member_id)),
    lastMessages(threads.map((t) => t.id)),
  ]);
  return {
    kind: 'mentor',
    threads: threads
      .map((thread) => ({ thread, other: people.get(thread.member_id) ?? null, last: last.get(thread.id) ?? null }))
      .sort(byRecent),
  };
}

// ── One conversation ────────────────────────────────────────────────────────
export type Conversation = {
  thread: DmThread;
  other: PublicProfile | null;
  /** The girl's Circle name, for the header status line. */
  circleName: string | null;
  iAmMember: boolean;
  /** False when her parent has switched mentor messages off. */
  canSend: boolean;
  messages: DmMessage[];
};

const HISTORY = 200;

export async function loadConversation(threadId: string, me: Profile): Promise<Conversation | null> {
  const thread = must(
    await supabase.from('dm_threads').select('id, member_id, mentor_id, created_at').eq('id', threadId).maybeSingle(),
  ) as DmThread | null;
  if (!thread) return null;
  const iAmMember = thread.member_id === me.id;
  const otherId = iAmMember ? thread.mentor_id : thread.member_id;

  const [people, rows, allowed] = await Promise.all([
    loadAuthors([otherId]),
    supabase
      .from('dm_messages')
      .select('id, thread_id, sender_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(HISTORY),
    iAmMember ? mentorDmAllowed(me.id) : Promise.resolve(true),
  ]);
  const other = people.get(otherId) ?? null;
  const circleId = iAmMember ? me.circle_id : other?.circle_id;
  let circleName: string | null = null;
  if (circleId) {
    const c = await supabase.from('circles').select('name').eq('id', circleId).maybeSingle();
    circleName = (c.data as { name: string } | null)?.name ?? null;
  }
  return {
    thread,
    other,
    circleName,
    iAmMember,
    canSend: allowed,
    messages: (must(rows) as DmMessage[]).reverse(),
  };
}

export async function sendMessage(threadId: string, senderId: string, body: string): Promise<DmMessage> {
  const { data, error } = await supabase
    .from('dm_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body })
    .select('id, thread_id, sender_id, body, created_at')
    .single();
  if (error) throw new Error('Your message did not send. Check your connection and try again.');
  return data as DmMessage;
}

/** Live new messages for one thread. Returns an unsubscribe function. */
export function subscribeToThread(threadId: string, onInsert: (m: DmMessage) => void): () => void {
  const channel = supabase
    .channel(`dm:${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` },
      (payload) => onInsert(payload.new as DmMessage),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Adds a message once, keeping time order. */
export function mergeMessage(list: DmMessage[], m: DmMessage): DmMessage[] {
  if (list.some((x) => x.id === m.id)) return list;
  return [...list, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
