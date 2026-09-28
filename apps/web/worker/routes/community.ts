import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { body, escapeHtml, HttpError, isQuietHours, requireUser, sendEmail } from '../lib';
import { moderate, type Verdict } from '../moderation';

const community = new Hono<AppEnv>();

const KINDS = ['general', 'win', 'prayer', 'books', 'scripture'] as const;
const TRUSTED = new Set(['mentor', 'moderator', 'admin', 'owner']);

type Decision = { status: 'approved' | 'pending'; queue_reason: 'safety' | 'first_post' | 'flagged' | null };

function decide(verdict: Verdict, trusted: boolean, hasHistory: boolean): Decision {
  if (verdict.safety) return { status: 'pending', queue_reason: 'safety' };
  if (trusted) return { status: 'approved', queue_reason: null };
  if (verdict.flagged) return { status: 'pending', queue_reason: 'flagged' };
  if (!hasHistory) return { status: 'pending', queue_reason: 'first_post' };
  return { status: 'approved', queue_reason: null };
}

function guardWriter(role: string, timedOutUntil: string | null) {
  if (role === 'parent') throw new HttpError(403, 'The Court is for members and mentors');
  if (timedOutUntil && new Date(timedOutUntil) > new Date())
    throw new HttpError(403, 'You can read the Court, but posting is paused for now. A mentor will talk with you.');
  if (!TRUSTED.has(role) && isQuietHours())
    throw new HttpError(403, 'The Court closes at 9:00 pm and opens at 6:00 am. Lessons stay open all night.');
}

async function alertSafeguarding(c: { env: AppEnv['Bindings'] }, who: string, where: string, text: string) {
  await sendEmail(
    c.env,
    c.env.SAFEGUARDING_EMAIL,
    'SAFEGUARDING — a post needs a person now',
    `<p><strong>${escapeHtml(who)}</strong> in <strong>${escapeHtml(where)}</strong> wrote:</p>
     <blockquote>${escapeHtml(text)}</blockquote>
     <p>It has been held from the feed. Respond from the moderation queue: ${c.env.APP_ORIGIN}/palace/moderation</p>`,
  );
}

community.post('/posts', requireUser(), async (c) => {
  const profile = c.get('profile');
  const admin = c.get('admin');
  const asUser = c.get('asUser');
  const input = await body<{ space_id?: string; kind?: string; body?: string }>(c);
  const text = (input.body ?? '').trim();
  const kind = (KINDS as readonly string[]).includes(input.kind ?? '') ? input.kind! : 'general';
  if (!input.space_id) throw new HttpError(400, 'Choose where to post');
  if (text.length < 1 || text.length > 2000) throw new HttpError(400, 'Posts are 1 to 2,000 characters');
  guardWriter(profile.role, profile.timed_out_until);

  // RLS decides whether she can see (and therefore post in) this space.
  const { data: space } = await asUser.from('spaces').select('id, name').eq('id', input.space_id).maybeSingle();
  if (!space) throw new HttpError(403, 'You cannot post in this space');

  const verdict = await moderate(c.env, text);
  const { count } = await admin
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profile.id)
    .eq('status', 'approved');
  const d = decide(verdict, TRUSTED.has(profile.role), (count ?? 0) > 0);

  const { data: post, error } = await admin
    .from('posts')
    .insert({
      space_id: space.id,
      author_id: profile.id,
      kind,
      body: text,
      status: d.status,
      queue_reason: d.queue_reason,
      moderation: verdict,
      approved_at: d.status === 'approved' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw new HttpError(500, error.message);

  if (d.queue_reason === 'safety') await alertSafeguarding(c, profile.display_name || profile.full_name, space.name, text);

  if (kind === 'win' && d.status === 'approved') {
    const { data: badge } = await admin.from('badges').select('id').eq('slug', 'first-testimony').single();
    if (badge) await admin.from('member_badges').upsert({ member_id: profile.id, badge_id: badge.id }, { ignoreDuplicates: true });
  }

  return c.json({ id: post.id, status: d.status, reason: d.queue_reason });
});

community.post('/replies', requireUser(), async (c) => {
  const profile = c.get('profile');
  const admin = c.get('admin');
  const asUser = c.get('asUser');
  const input = await body<{ post_id?: string; body?: string }>(c);
  const text = (input.body ?? '').trim();
  if (!input.post_id) throw new HttpError(400, 'Which post are you replying to?');
  if (text.length < 1 || text.length > 1000) throw new HttpError(400, 'Replies are 1 to 1,000 characters');
  guardWriter(profile.role, profile.timed_out_until);

  const { data: post } = await asUser.from('posts').select('id, status, space_id').eq('id', input.post_id).maybeSingle();
  if (!post || post.status !== 'approved') throw new HttpError(403, 'You cannot reply to this post');

  const verdict = await moderate(c.env, text);
  const { count } = await admin
    .from('replies')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profile.id)
    .eq('status', 'approved');
  const { count: postCount } = await admin
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profile.id)
    .eq('status', 'approved');
  const d = decide(verdict, TRUSTED.has(profile.role), (count ?? 0) + (postCount ?? 0) > 0);

  const { data: reply, error } = await admin
    .from('replies')
    .insert({ post_id: post.id, author_id: profile.id, body: text, status: d.status, moderation: verdict })
    .select('id')
    .single();
  if (error) throw new HttpError(500, error.message);

  if (d.queue_reason === 'safety') {
    // Replies have no queue of their own; hold the parent post's thread for a person too.
    await admin.from('posts').update({ queue_reason: 'safety' }).eq('id', post.id);
    await alertSafeguarding(c, profile.display_name || profile.full_name, 'a reply', text);
  }
  return c.json({ id: reply.id, status: d.status });
});

// "Talk to someone" — reaches a real adult. Nobody else sees it.
community.post('/help', requireUser(), async (c) => {
  const profile = c.get('profile');
  const { body: text } = await body<{ body?: string }>(c);
  const message = (text ?? '').trim();
  if (!message) throw new HttpError(400, 'Write a few words so we know how to help');
  const verdict = await moderate(c.env, message);
  const { error } = await c.get('admin').from('help_requests').insert({
    member_id: profile.id,
    body: message,
    status: verdict.safety ? 'escalated' : 'open',
  });
  if (error) throw new HttpError(500, error.message);
  await sendEmail(
    c.env,
    c.env.SAFEGUARDING_EMAIL,
    verdict.safety ? 'SAFEGUARDING — Talk to someone (urgent)' : 'Talk to someone — new message',
    `<p>From <strong>${escapeHtml(profile.full_name || profile.display_name)}</strong>:</p><blockquote>${escapeHtml(message)}</blockquote>
     <p>Reply from The Palace: ${c.env.APP_ORIGIN}/palace/help</p>`,
  );
  return c.json({ ok: true });
});

export default community;
