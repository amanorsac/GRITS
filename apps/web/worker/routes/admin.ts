import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { body, escapeHtml, HttpError, requireUser, sendEmail } from '../lib';

const admin = new Hono<AppEnv>();

const STAFF_ROLES = ['mentor', 'moderator', 'admin'] as const;

// Invite a mentor, moderator or admin. Roles live in app_metadata so nobody can grant themselves one.
admin.post('/staff', requireUser('admin', 'owner'), async (c) => {
  const input = await body<{ email?: string; full_name?: string; role?: string }>(c);
  const email = (input.email ?? '').trim().toLowerCase();
  const role = input.role as (typeof STAFF_ROLES)[number];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  if (!STAFF_ROLES.includes(role)) throw new HttpError(400, 'Role must be mentor, moderator or admin');
  const sb = c.get('admin');

  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: input.full_name ?? '' },
  });
  if (error) throw new HttpError(400, error.message);

  const { data: link } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${c.env.APP_ORIGIN}/account/password` },
  });
  const actionLink = link?.properties?.action_link;
  if (actionLink) {
    await sendEmail(
      c.env,
      email,
      'You have been invited to Grit & Grace',
      `<p>Hello ${escapeHtml(input.full_name ?? '')},</p><p>You have been added to the Grit &amp; Grace platform as a <strong>${role}</strong>.</p>
       <p><a href="${actionLink}">Set your password</a> — this link works once.</p>`,
    );
  }
  return c.json({ id: created.user?.id, invite_link: actionLink ?? null });
});

// Assign a member to a Circle (and so to its private space and its mentor).
admin.post('/members/:id/circle', requireUser('admin', 'owner'), async (c) => {
  const { circle_id } = await body<{ circle_id?: string | null }>(c);
  const { error } = await c.get('admin').from('profiles').update({ circle_id: circle_id ?? null }).eq('id', c.req.param('id'));
  if (error) throw new HttpError(400, error.message);
  return c.json({ ok: true });
});

// Carry out an account deletion request (Apple 5.1.1(v); Ghana DPA erasure).
admin.post('/deletions/:id/complete', requireUser('admin', 'owner'), async (c) => {
  const sb = c.get('admin');
  const { data: req } = await sb.from('account_deletion_requests').select('id, user_id, status').eq('id', c.req.param('id')).single();
  if (!req) throw new HttpError(404, 'Request not found');
  await sb.from('account_deletion_requests').update({ status: 'completed' }).eq('id', req.id);
  const { error } = await sb.auth.admin.deleteUser(req.user_id);
  if (error) throw new HttpError(500, error.message);
  return c.json({ ok: true });
});

export default admin;
