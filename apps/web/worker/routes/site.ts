import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { emit } from '../integrations';
import { adminClient, body, escapeHtml, HttpError, sendEmail } from '../lib';

const site = new Hono<AppEnv>();

const TOPICS = ['enquiry', 'counselling', 'summits', 'royal-table', 'crown-council', 'hershift', 'inner-court'];

// The public contact form. Stored for The Palace and emailed to the Academy.
site.post('/contact', async (c) => {
  const input = await body<{ name?: string; email?: string; phone?: string; subject?: string; message?: string; topic?: string; website?: string }>(c);
  // Honeypot: a hidden field people never see. Bots fill it; pretend success.
  if (input.website) return c.json({ ok: true });

  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const message = (input.message ?? '').trim();
  if (!name) throw new HttpError(400, 'Tell us your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email so we can reply');
  if (message.length < 2 || message.length > 4000) throw new HttpError(400, 'Write a message (up to 4,000 characters)');
  const topic = TOPICS.includes(input.topic ?? '') ? input.topic! : 'enquiry';
  const subject = (input.subject ?? '').trim().slice(0, 200);
  const phone = (input.phone ?? '').trim().slice(0, 40) || null;

  const { error } = await adminClient(c.env).from('contact_messages').insert({ name, email, phone, subject, message, topic });
  if (error) throw new HttpError(500, 'We could not send your message — please call +233 54 853 1412');

  await sendEmail(
    c.env,
    c.env.SAFEGUARDING_EMAIL,
    `Website: ${subject || topic} — ${name}`,
    `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${phone ? `, ${escapeHtml(phone)}` : ''}) wrote about <strong>${escapeHtml(topic)}</strong>:</p>
     <blockquote>${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>
     <p>See all messages in The Palace: ${c.env.APP_ORIGIN}/palace/help</p>`,
  );
  c.executionCtx.waitUntil(emit(c.env, { type: 'contact.created', name, email, phone, topic, subject, message }));
  return c.json({ ok: true });
});

export default site;
