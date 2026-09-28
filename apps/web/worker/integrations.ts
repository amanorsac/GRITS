import type { Env } from './env';

/**
 * Outbound business events for Zoho (or anything else).
 *
 * The platform stays the system of record for learning, community and safeguarding.
 * Zoho gets the business side — leads, families, bookings, campaigns — through ONE
 * Zoho Flow webhook: Flow routes each event to CRM, Campaigns, Bookings, Books, etc.
 * without more code here. See docs/ZOHO.md.
 *
 * Never send children's data: only parent/enquirer details and non-identifying counts.
 */
export type BusinessEvent =
  | { type: 'contact.created'; name: string; email: string; phone: string | null; topic: string; subject: string; message: string }
  | { type: 'waitlist.joined'; email: string; program: string }
  | { type: 'enrolment.started'; parent_email: string | null; parent_name: string; parent_phone: string | null; program: string; plan: string; amount_ghs: number }
  | { type: 'payment.succeeded'; parent_email: string | null; reference: string; amount_ghs: number; channel: string; instalment_no: number }
  | { type: 'member.joined'; parent_email: string | null; program: string };

export async function emit(env: Env, event: BusinessEvent) {
  if (!env.ZOHO_FLOW_WEBHOOK_URL) return;
  try {
    const res = await fetch(env.ZOHO_FLOW_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, source: 'grit-and-grace-platform', at: new Date().toISOString() }),
    });
    if (!res.ok) console.error('Zoho Flow webhook failed', event.type, res.status);
  } catch (e) {
    // Business sync must never break enrolment or payments.
    console.error('Zoho Flow webhook error', event.type, e);
  }
}
