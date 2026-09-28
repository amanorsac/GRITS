import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv, Env } from '../env';
import { emit } from '../integrations';
import { adminClient, body, escapeHtml, hmacSha512Hex, HttpError, joinCode, priceFor, requireUser, sendEmail, timingSafeEqual } from '../lib';

const enrol = new Hono<AppEnv>();

type EnrolInput = {
  program?: string;
  child_name?: string;
  birth_year?: number;
  age_band?: '8-12' | '13-17' | '10-12' | '13-15' | '16-18';
  permissions?: { circle?: boolean; court?: boolean; mentor_dm?: boolean };
  consent_data?: boolean;
  weekly_digest?: boolean;
  plan?: 'full' | 'instalments';
  channel?: 'mobile_money' | 'card';
};

async function paystack<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  if (!env.PAYSTACK_SECRET_KEY) throw new HttpError(503, 'Payments are not switched on yet (PAYSTACK_SECRET_KEY)');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) throw new HttpError(502, `Paystack: ${json.message}`);
  return json.data;
}

// Parent-first enrolment: consent is ledgered before any money moves, and the
// girl's account does not exist until her parent has paid and she redeems the code.
enrol.post('/enrol', requireUser('parent'), async (c) => {
  const admin = c.get('admin');
  const parent = c.get('profile');
  const user = c.get('user');
  const input = await body<EnrolInput>(c);

  const childName = (input.child_name ?? '').trim();
  if (!childName) throw new HttpError(400, "Tell us your daughter's name");
  if (!input.age_band) throw new HttpError(400, 'Choose her age band');
  if (!input.consent_data) throw new HttpError(400, 'Consent is needed before we can create her account');

  const { data: program } = await admin
    .from('programs')
    .select('id, slug, name, price_pesewas, instalments, is_open, pro_rata, cohort_start, cohort_end')
    .eq('slug', input.program ?? 'inner-court')
    .single();
  if (!program || !program.is_open) throw new HttpError(404, 'That program is not open for enrolment');
  const total = priceFor(program);
  if (!total) throw new HttpError(409, 'The Academy has not published the price yet. Please check back soon.');

  // Community is off by default under 13; the parent may switch it on.
  const under13 = input.age_band === '8-12' || input.age_band === '10-12';
  const permissions = {
    circle: input.permissions?.circle ?? true,
    court: input.permissions?.court ?? !under13,
    mentor_dm: input.permissions?.mentor_dm ?? true,
  };

  const plan = input.plan === 'instalments' && program.instalments > 1 ? 'instalments' : 'full';
  const parts = plan === 'instalments' ? program.instalments : 1;
  const firstAmount = Math.ceil(total / parts);

  const { data: enrolment, error: e1 } = await admin
    .from('enrolments')
    .insert({ parent_id: parent.id, program_id: program.id, plan })
    .select('id')
    .single();
  if (e1) throw new HttpError(500, e1.message);

  const code = joinCode();
  const { error: e2 } = await admin.from('join_codes').insert({
    code,
    parent_id: parent.id,
    child_name: childName,
    age_band: input.age_band,
    birth_year: input.birth_year ?? null,
    enrolment_id: enrolment.id,
    permissions,
  });
  if (e2) throw new HttpError(500, e2.message);

  const ua = c.req.header('user-agent') ?? null;
  await admin.from('consents').insert([
    { parent_id: parent.id, join_code: code, scope: 'data_processing', granted: true, user_agent: ua },
    { parent_id: parent.id, join_code: code, scope: 'circle', granted: permissions.circle, user_agent: ua },
    { parent_id: parent.id, join_code: code, scope: 'court', granted: permissions.court, user_agent: ua },
    { parent_id: parent.id, join_code: code, scope: 'mentor_dm', granted: permissions.mentor_dm, user_agent: ua },
    { parent_id: parent.id, join_code: code, scope: 'weekly_digest', granted: !!input.weekly_digest, user_agent: ua },
  ]);

  const reference = `GG-${enrolment.id.slice(0, 8)}-1-${Date.now().toString(36)}`;
  const now = new Date();
  const rows = Array.from({ length: parts }, (_, i) => {
    const due = new Date(now);
    due.setUTCMonth(due.getUTCMonth() + i);
    const amount = i === parts - 1 ? total - firstAmount * (parts - 1) : firstAmount;
    return {
      parent_id: parent.id,
      enrolment_id: enrolment.id,
      reference: i === 0 ? reference : `GG-${enrolment.id.slice(0, 8)}-${i + 1}`,
      amount_pesewas: amount,
      instalment_no: i + 1,
      due_at: due.toISOString(),
    };
  });
  const { error: e3 } = await admin.from('payments').insert(rows);
  if (e3) throw new HttpError(500, e3.message);

  const channels = input.channel === 'card' ? ['card'] : input.channel === 'mobile_money' ? ['mobile_money'] : ['mobile_money', 'card'];
  const tx = await paystack<{ authorization_url: string; reference: string }>(c.env, '/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email ?? parent.email,
      amount: firstAmount,
      currency: 'GHS',
      reference,
      channels,
      callback_url: `${c.env.APP_ORIGIN}/enrol/complete`,
      metadata: { enrolment_id: enrolment.id, join_code: code, instalment_no: 1, program: program.slug },
    }),
  });

  c.executionCtx.waitUntil(
    emit(c.env, { type: 'enrolment.started', parent_email: user.email ?? parent.email, parent_name: parent.full_name, parent_phone: null, program: program.slug, plan, amount_ghs: total / 100 }),
  );
  return c.json({ authorization_url: tx.authorization_url, reference, join_code: code });
});

// Pay the next instalment from the parent portal.
enrol.post('/payments/:id/pay', requireUser('parent'), async (c) => {
  const admin = c.get('admin');
  const parent = c.get('profile');
  const { data: p } = await admin
    .from('payments')
    .select('id, reference, amount_pesewas, status, parent_id, enrolment_id, instalment_no')
    .eq('id', c.req.param('id'))
    .single();
  if (!p || p.parent_id !== parent.id) throw new HttpError(404, 'Payment not found');
  if (p.status === 'success') throw new HttpError(409, 'Already paid');
  const reference = `GG-${p.enrolment_id?.slice(0, 8)}-${p.instalment_no}-${Date.now().toString(36)}`;
  await admin.from('payments').update({ reference, status: 'pending' }).eq('id', p.id);
  const tx = await paystack<{ authorization_url: string }>(c.env, '/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: c.get('user').email ?? parent.email,
      amount: p.amount_pesewas,
      currency: 'GHS',
      reference,
      channels: ['mobile_money', 'card'],
      callback_url: `${c.env.APP_ORIGIN}/enrol/complete`,
      metadata: { enrolment_id: p.enrolment_id, instalment_no: p.instalment_no },
    }),
  });
  return c.json({ authorization_url: tx.authorization_url, reference });
});

type PaystackTx = { reference: string; status: string; amount: number; currency: string; channel: string; paid_at: string };

async function applySuccess(env: Env, admin: SupabaseClient, tx: PaystackTx) {
  const { data: pay } = await admin
    .from('payments')
    .select('id, status, amount_pesewas, enrolment_id, parent_id, instalment_no')
    .eq('reference', tx.reference)
    .maybeSingle();
  if (!pay) return { ok: false, reason: 'unknown reference' };
  if (pay.status === 'success') return { ok: true, already: true };
  if (tx.amount < pay.amount_pesewas || tx.currency !== 'GHS') {
    await admin.from('payments').update({ status: 'failed', raw: tx }).eq('id', pay.id);
    return { ok: false, reason: 'amount mismatch' };
  }
  await admin
    .from('payments')
    .update({ status: 'success', channel: tx.channel, paid_at: tx.paid_at ?? new Date().toISOString(), raw: tx })
    .eq('id', pay.id);
  {
    const { data: payer } = await admin.from('profiles').select('email').eq('id', pay.parent_id).single();
    await emit(env, { type: 'payment.succeeded', parent_email: payer?.email ?? null, reference: tx.reference, amount_ghs: tx.amount / 100, channel: tx.channel, instalment_no: pay.instalment_no });
  }
  if (pay.enrolment_id) {
    const { data: enr } = await admin.from('enrolments').select('status').eq('id', pay.enrolment_id).single();
    if (enr?.status === 'pending_payment') {
      await admin.from('enrolments').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', pay.enrolment_id);
      const { data: jc } = await admin.from('join_codes').select('code, child_name').eq('enrolment_id', pay.enrolment_id).maybeSingle();
      const { data: parent } = await admin.from('profiles').select('email, full_name').eq('id', pay.parent_id).single();
      if (jc && parent?.email) {
        await sendEmail(
          env,
          parent.email,
          `${jc.child_name}'s place in The Inner Court is confirmed`,
          `<p>Dear ${escapeHtml(parent.full_name || 'parent')},</p>
           <p>Payment received — thank you. Give ${escapeHtml(jc.child_name)} this code so she can create her account in the Grit &amp; Grace app or at ${env.APP_ORIGIN}/join:</p>
           <p style="font-size:24px;font-weight:700;letter-spacing:2px">${jc.code}</p>
           <p>You hold the permissions. Change them any time in The Gate: ${env.APP_ORIGIN}/gate</p>`,
        );
      }
    }
  }
  return { ok: true };
}

enrol.post('/paystack/webhook', async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header('x-paystack-signature') ?? '';
  if (!c.env.PAYSTACK_SECRET_KEY) return c.text('not configured', 503);
  const expected = await hmacSha512Hex(c.env.PAYSTACK_SECRET_KEY, raw);
  if (!timingSafeEqual(expected, signature)) return c.text('bad signature', 401);

  const event = JSON.parse(raw) as { event: string; data: PaystackTx };
  const admin = adminClient(c.env);
  if (event.event === 'charge.success') {
    // Never trust the webhook body alone — confirm with Paystack.
    const tx = await paystack<PaystackTx>(c.env, `/transaction/verify/${encodeURIComponent(event.data.reference)}`);
    if (tx.status === 'success') await applySuccess(c.env, admin, tx);
  } else if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
    await admin.from('payments').update({ status: 'failed', raw: event.data }).eq('reference', event.data.reference).neq('status', 'success');
  }
  return c.text('ok');
});

// The callback page calls this so the parent sees the result even if the webhook is slow.
enrol.get('/paystack/verify', requireUser('parent'), async (c) => {
  const reference = c.req.query('reference');
  if (!reference) throw new HttpError(400, 'reference required');
  const admin = c.get('admin');
  const { data: pay } = await admin.from('payments').select('parent_id').eq('reference', reference).maybeSingle();
  if (!pay || pay.parent_id !== c.get('profile').id) throw new HttpError(404, 'Payment not found');
  const tx = await paystack<PaystackTx>(c.env, `/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status === 'success') await applySuccess(c.env, admin, tx);
  const { data: jc } = await admin
    .from('payments')
    .select('status, enrolments(join_codes(code, child_name))')
    .eq('reference', reference)
    .single();
  return c.json({ status: tx.status, payment: jc });
});

// She redeems the code her parent gave her and chooses her own username.
enrol.post('/join', async (c) => {
  const admin = adminClient(c.env);
  const input = await body<{ code?: string; username?: string; password?: string; display_name?: string }>(c);
  const code = (input.code ?? '').trim().toUpperCase();
  const username = (input.username ?? '').trim().toLowerCase();
  const password = input.password ?? '';
  if (!/^[a-z0-9._]{3,24}$/.test(username)) throw new HttpError(400, 'Usernames are 3–24 letters, numbers, dots or underscores');
  if (password.length < 8) throw new HttpError(400, 'Choose a password of at least 8 characters');

  const { data: jc } = await admin
    .from('join_codes')
    .select('code, parent_id, child_name, age_band, birth_year, enrolment_id, permissions, expires_at, used_by, enrolments(status)')
    .eq('code', code)
    .maybeSingle();
  if (!jc) throw new HttpError(404, 'That code is not right — check it with your parent');
  if (jc.used_by) throw new HttpError(409, 'That code has already been used');
  if (new Date(jc.expires_at) < new Date()) throw new HttpError(410, 'That code has expired — ask your parent for a new one');
  const enrolmentStatus = (jc.enrolments as unknown as { status: string } | null)?.status;
  if (enrolmentStatus !== 'active') throw new HttpError(402, 'Your place is not confirmed yet — your parent needs to finish payment');

  const email = `${username}@${c.env.MEMBER_EMAIL_DOMAIN}`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'member', username, age_band: jc.age_band, birth_year: jc.birth_year ? String(jc.birth_year) : '' },
    user_metadata: { full_name: jc.child_name, display_name: (input.display_name ?? '').trim() || jc.child_name.split(' ')[0] },
  });
  if (error || !created.user) {
    if (error?.message?.toLowerCase().includes('already')) throw new HttpError(409, 'That username is taken — try another');
    throw new HttpError(500, error?.message ?? 'Could not create the account');
  }
  const childId = created.user.id;
  const perms = jc.permissions as { circle?: boolean; court?: boolean; mentor_dm?: boolean };
  await admin.from('parent_links').insert({ parent_id: jc.parent_id, child_id: childId });
  await admin.from('member_permissions').insert({
    member_id: childId,
    circle: perms.circle ?? true,
    court: perms.court ?? false,
    mentor_dm: perms.mentor_dm ?? true,
    updated_by: jc.parent_id,
  });
  await admin.from('enrolments').update({ member_id: childId }).eq('id', jc.enrolment_id!);
  await admin.from('join_codes').update({ used_by: childId, used_at: new Date().toISOString() }).eq('code', code);
  // The ledger is append-only: record that the consented account now exists, linked by join code.
  await admin.from('consents').insert({ parent_id: jc.parent_id, child_id: childId, join_code: code, scope: 'account_created', granted: true });
  const { data: parentRow } = await admin.from('profiles').select('email').eq('id', jc.parent_id).single();
  c.executionCtx.waitUntil(emit(c.env, { type: 'member.joined', parent_email: parentRow?.email ?? null, program: 'inner-court' }));
  return c.json({ ok: true, email });
});

enrol.post('/waitlist', async (c) => {
  const input = await body<{ program?: string; email?: string }>(c);
  const email = (input.email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email');
  const { error } = await adminClient(c.env)
    .from('waitlist')
    .upsert({ program_slug: input.program ?? 'hershift', email }, { onConflict: 'program_slug,email', ignoreDuplicates: true });
  if (error) throw new HttpError(500, error.message);
  c.executionCtx.waitUntil(emit(c.env, { type: 'waitlist.joined', email, program: input.program ?? 'hershift' }));
  return c.json({ ok: true });
});

export default enrol;
