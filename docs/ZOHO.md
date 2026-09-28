# Zoho × Grit & Grace

The Academy already runs on Zoho: their current site embeds **Zoho Forms** (enrolment pop-ups) and
**Zoho SalesIQ** (the "We're offline — leave a message" chat). This plan keeps what Zoho does well and
lets the platform do what it must own.

## Who owns what

| The platform (this repo) owns | Zoho owns |
|---|---|
| Girls' accounts, lessons, progress, certificates | Families & leads (CRM) |
| The Court, Circles, mentor messages, moderation | Email marketing & newsletters (Campaigns) |
| Safeguarding, consent ledger, parent permissions | Bookings — counselling sessions (Bookings) |
| Payments via Paystack (mobile money) | Event ticketing — Royal Table, Crown Council, Summits (Backstage) |
| Live Circle rooms | Invoices / accounting (Books) |
| | Website chat (SalesIQ), surveys (Survey), help desk (Desk) |

**Children's data never goes to Zoho.** Only parent/enquirer details and non-identifying events.
Ghana's Data Protection Act treats children's data as special personal data; keeping it in one
place (Supabase, with row-level security) is the simplest way to stay compliant.

## How they connect — one webhook

The Worker sends business events to a single **Zoho Flow** webhook (`apps/web/worker/integrations.ts`).
Zoho Flow then routes each event wherever the Academy wants, with no more code:

| Event | Sent when | Suggested Zoho Flow route |
|---|---|---|
| `contact.created` | Someone uses the contact form | CRM → create Lead; Desk → ticket if topic is counselling |
| `waitlist.joined` | HerShift waitlist | CRM Lead (tag: HerShift) → Campaigns list |
| `enrolment.started` | Parent starts checkout | CRM → Contact + Deal "Inner Court" (stage: Checkout) |
| `payment.succeeded` | Paystack confirms | CRM Deal → Won; Books → invoice / receipt |
| `member.joined` | Her join code is redeemed | CRM Contact → tag "Active family"; Campaigns → parent digest list |

Payload shape: see `BusinessEvent` in `integrations.ts`. Every event carries `source` and `at`.

## To switch it on (needs the Academy's Zoho admin)

1. Zoho Flow → **Create flow** → trigger **Webhook** → copy the webhook URL.
2. Cloudflare → Workers → `grits` → Settings → Variables → add **Secret** `ZOHO_FLOW_WEBHOOK_URL`.
3. In Flow, add a **Decision** on `type`, then the CRM / Campaigns / Books actions per the table above.
4. Submit the contact form on the site once and watch the run in Flow's history.

## Next, once we have their Zoho details

- **SalesIQ chat widget** on the public site (replace our "Talk to us" button, or keep ours for
  signed-in girls — girls must never be routed to an external chat).
- **Zoho Bookings** embed for One-on-One Counselling (1 hour, virtual or in Accra).
- **Zoho Backstage** for Royal Table / Crown Council tickets, or keep Paystack if they want mobile money.
- **Zoho Campaigns** for the weekly parent digest instead of Resend, once volumes pass Resend's free tier.
- **Zoho Forms**: retire the old enrolment forms once enrolment moves to `/enrol` (consent must be
  captured in our ledger, not a form).

Questions for the Academy: which Zoho plan/apps they pay for, the org's data centre (.com / .eu / .in),
and who the Zoho admin is.
