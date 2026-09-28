# Go-live checklist

Everything in the code is done; these are the accounts, keys and values only the Academy/Studio can supply.
Nothing here should be pasted into chat, commits or tickets — set each value directly in the service's dashboard or CLI.

## 1. Database (Supabase — project `GRITS`, ref `ckwzixmsyfgonqiayltb`)

```bash
npx supabase link --project-ref ckwzixmsyfgonqiayltb     # asks for the database password
npx supabase db push                                     # applies supabase/migrations/*
```

Then in the Supabase dashboard:

- **Authentication → Providers → Email**: keep enabled. Decide on *Confirm email* (on = parents confirm before step 2 of
  enrolment; the flow handles both).
- **Authentication → URL configuration**: Site URL = the live domain; add `https://<domain>/enrol` and
  `https://<domain>/account/password` to redirect URLs.
- **Authentication → SMTP**: point at Resend so auth emails come from the Academy's domain.
- Make Grace the **owner**: after she signs up, run in the SQL editor:
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}' where email = '<her email>';`
  `update public.profiles set role = 'owner' where email = '<her email>';`

## 2. Worker secrets (Cloudflare → Workers & Pages → `grits` → Settings → Variables and secrets)

| Name | From | Needed for |
|---|---|---|
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (publishable/anon) | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret) | posting, payments, join codes, cron |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys (use `sk_test_…` first) | checkout, webhook |
| `OPENAI_API_KEY` | platform.openai.com | automated moderation (rules still run without it; failures fail *closed* to human review) |
| `RESEND_API_KEY` | resend.com (verify `gritgracegirlsacademy.com`) | receipts, join codes, safeguarding alerts |
| `BUNNY_TOKEN_KEY` + var `BUNNY_LIBRARY_ID` | Bunny Stream library → Security (enable *Embed view token authentication*) | lesson video |
| `JAAS_PRIVATE_KEY` + vars `JAAS_APP_ID`, `JAAS_KEY_ID` | jaas.8x8.vc → API keys | Circle live rooms |

Or from a terminal: `npx wrangler login` then `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (etc).

Vars in `wrangler.jsonc` to confirm: `SAFEGUARDING_EMAIL`, `EMAIL_FROM`, `APP_ORIGIN` (set once the custom domain is live).

## 3. Paystack

- Webhook URL: `https://<domain>/api/paystack/webhook`
- Callback is set per transaction (`/enrol/complete`).
- Set the Inner Court price and instalments in **The Palace → Commerce** — checkout refuses to start until a price exists.

## 4. Domain

Add the domain to Cloudflare, then Workers → `grits` → Settings → Domains & Routes → add custom domain.
Set `APP_ORIGIN` to it.

## 5. iOS → TestFlight (`com.gritandgrace.app`)

Needs: an Expo account and an Apple Developer Program membership ($99/yr).

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                      # creates the EAS project, writes its id into app config
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --environment production --visibility plaintext
npx eas-cli@latest build -p ios --profile production --auto-submit
```

The first run signs you in to Apple interactively, creates the bundle ID, certificates and the App Store Connect app
record, then uploads the build to TestFlight. After that, CI can do it: add an `EXPO_TOKEN` repository secret
(expo.dev → Access tokens) and run the **iOS → TestFlight** workflow.

Android: `npx eas-cli@latest build -p android --profile production` produces the AAB; not submitted yet.

App Store review (later, for public release) will want: a demo member account, the privacy policy URL
(`/privacy`), and the age rating questionnaire answered for user-generated content with moderation.

## 6. Legal — before the first real enrolment

- **Register with Ghana's Data Protection Commission** (children's data is special personal data).
- Replace every `[BRACKET]` in `apps/web/src/pages/Legal.tsx` and on the landing page (prices, founder portrait, counts).
- Name the deputy safeguarding lead; document mentor vetting.
