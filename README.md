# Grit & Grace Girls Academy — platform

Faith-based mentoring for girls in Accra and online. *We don't just raise girls. We raise Queens.*

| Part | Where | Stack |
|---|---|---|
| Website, member web app, **The Gate** (parents), **The Palace** (admin) | `apps/web/src` | React 19 + React Router, served as static assets |
| API — moderation, payments, video signing, live rooms, join codes, keep-alive cron | `apps/web/worker` | Cloudflare Worker (Hono) — the `grits` Worker |
| Member app — iOS (`com.gritandgrace.app`) + Android | `apps/mobile` | Expo SDK 57 / React Native, built & shipped with EAS |
| Database, auth, row-level security, RPCs, seed | `supabase/migrations` | Supabase Postgres (`ckwzixmsyfgonqiayltb`) |

Contract between everything: [`docs/API.md`](docs/API.md). Go-live checklist: [`docs/LAUNCH.md`](docs/LAUNCH.md).

## Why this shape

Follows the *Lean Launch Stack* (≈ $3.75/month under 100 members):

- **Cloudflare, not Vercel** — Vercel Hobby forbids commercial use; Cloudflare's free tier allows it. One Worker serves
  the site *and* the API, so there is one deploy and one place for secrets.
- **Supabase** for Postgres + Auth + RLS. A daily **Cron Trigger** touches `keepalive` so the free project never pauses.
- **Bunny Stream** for paid lesson video (signed, expiring embed URLs). **YouTube Live** for broadcasts, **JaaS** (Jitsi)
  for Circle rooms (≤ 25 cameras), both embedded so girls never leave the Academy.
- **Paystack** for mobile money + card, instalments; webhook verified by HMAC *and* re-checked against Paystack.
- **Resend** for email, **OpenAI omni-moderation** + deterministic safety rules on every community write.
- **Native iOS app via Expo/EAS** (TestFlight) as requested; Android lives in the same codebase, ready to ship.

## Safety architecture (non-negotiable)

- **Parent-first**: a parent signs up, consents, pays; the girl's account only exists once she redeems the join code.
- **Consent ledger** (`consents`) is append-only. Every permission switch is ledgered.
- **Community off by default under 13**; the parent switches it on in The Gate.
- **No client can insert a post.** Posts go through the Worker: quiet hours (21:00–06:00 GMT), time-outs, automated check,
  first-post human review. Risk-of-harm and off-platform-contact patterns go to the safeguarding lead by email and can
  only leave the queue through a documented action (`moderate_post` requires a note).
- **Parents never read the journal or mentor messages** (RLS), but can see that they exist.
- Four positive reactions only. No downvotes, no leaderboards, no infinite scroll, no streak guilt.
- Roles live in `app_metadata` (service-role only) and a trigger blocks self-escalation.

## Develop

```bash
npm install                 # root workspace (web + worker)
npm run worker:dev          # builds the web app and runs the Worker at http://localhost:8787
npm run dev                 # Vite dev server with /api proxied to :8787
```

Put local-only values in `.dev.vars` (git-ignored), e.g. `SUPABASE_ANON_KEY=…`.

Mobile: see [`apps/mobile/README.md`](apps/mobile/README.md).

## Deploy

- **Web + API**: push to `main`. Cloudflare Workers Builds runs `npx wrangler deploy`, which runs the build command in
  `wrangler.jsonc`. Secrets are set once on the Worker (see `docs/LAUNCH.md`).
- **Database**: `npx supabase link --project-ref ckwzixmsyfgonqiayltb` then `npx supabase db push`.
- **iOS → TestFlight**: `cd apps/mobile && npx eas-cli@latest build -p ios --profile production --auto-submit`,
  or run the *iOS → TestFlight* GitHub Action.

Amanorsac Studio · 2026
