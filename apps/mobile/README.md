# Grit & Grace — member app (iOS + Android)

The app for enrolled girls: lessons, the Court (community), live sessions and "Talk to someone".
Expo SDK 57 · React Native 0.86 · Expo Router (routes in `src/app/`) · Supabase + the `grits` Worker
(contract: `../../docs/API.md`, schema: `../../supabase/migrations/`).

**App Store rule:** the app is a free companion to a paid web service. It has no prices, no purchase
flows and no calls to action to buy or enrol (guidelines 3.1.1 / 3.1.3(f)). Parents enrol and pay on the website.
Keep it that way.

## Layout

```
src/app/            routes only
  (auth)/           welcome, sign-in, join (join code)
  (tabs)/           index (Home), learn, court, live, me
  module/[id]       lessons in a month
  lesson/[id]       video (Bunny embed in a WebView), journal, mark as done
  session/[id]      live session details, audio-only toggle, join
  room              full-screen WebView for Jitsi (JaaS) / YouTube
  journal, certificates, talk, parent, profile-missing
src/lib/            supabase client, Worker API client, theme, auth, data helpers
src/components/     Screen, Card, Button, Chip, StatusChip, ProgressBar, Avatar, PostCard, ...
scripts/            generate-icons.cjs (brand icon/splash generator)
```

## Environment

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://ckwzixmsyfgonqiayltb.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the project's anon (publishable) key — Supabase dashboard → Project Settings → API |
| `EXPO_PUBLIC_API_URL` | the `grits` Worker. Default `https://grits.amanorsac.workers.dev` is a **placeholder** until the Worker's final URL is known |

Local development: copy `.env.example` to `.env` (already created with an empty key) and paste the anon key.
`.env` is git-ignored. `EXPO_PUBLIC_*` values are inlined into the JS bundle — only public values belong here
(the anon key is public by design; row-level security protects the data).

If the anon key is missing, the app does not crash: it shows an "Almost ready" screen.

### EAS builds

`eas.json` sets the Supabase URL and API URL for every profile. The anon key is **not** in `eas.json`; store it
as an EAS environment variable once (after `eas init`, see below):

```sh
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" \
  --environment production --environment preview --environment development --visibility plaintext
```

(Each build profile declares its `environment`, so EAS injects it at build time.) To point at the real Worker,
change `EXPO_PUBLIC_API_URL` in `eas.json` (or create it with `eas env:create`, which then takes the place of the
value in `eas.json`).

## Develop

```sh
npm install
npx expo start            # scan with a development build (see below)
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint
npx expo-doctor
```

The app uses native modules outside Expo Go's set only in standard ways (WebView, SVG, SecureStore), so Expo Go
works for most screens; for the live room (camera/microphone in a WebView) use a development build:

```sh
npx eas-cli@latest build --profile development --platform ios     # or android
```

`ios/` and `android/` are generated (Continuous Native Generation) and git-ignored — configure native behaviour in
`app.json` only.

### Brand assets

`assets/*.png` are generated from the crown mark (`assets/crown.svg`, gold #C9A227 on maroon #6E1028):

```sh
npm i --no-save @resvg/resvg-js
node scripts/generate-icons.cjs
```

The iOS icon is opaque (no transparency). Android gets adaptive foreground / background / monochrome layers.

## Ship to TestFlight

One-time setup (interactive — you sign in with the Academy's Expo and Apple accounts):

1. `npx eas-cli@latest login`
2. `npx eas-cli@latest init` — creates/links the EAS project and writes `extra.eas.projectId` into `app.json`.
3. Create the anon key env var (see **EAS builds** above).
4. In App Store Connect, create the app with bundle ID `com.gritandgrace.app`. Then fill in `eas.json` →
   `submit.production.ios`:
   - `ascAppId` — App Store Connect → the app → App Information → **Apple ID** (a number)
   - `appleTeamId` — developer.apple.com → Membership → **Team ID**

   (Or delete those two keys and let EAS ask on the first submit.)

Build and upload:

```sh
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

EAS manages signing credentials (let it create the distribution certificate and provisioning profile when asked),
builds in the cloud, and submits to TestFlight. Build numbers are managed remotely (`cli.appVersionSource: "remote"`,
`autoIncrement: true`), so you never bump `ios.buildNumber` by hand. Export compliance is pre-answered
(`ITSAppUsesNonExemptEncryption = false`).

Android (App Bundle for the pipeline; not submitted to Play from here):

```sh
npx eas-cli@latest build --platform android --profile production
```

For a side-loadable APK to test on a phone: `npx eas-cli@latest build --platform android --profile preview`.

## App Review notes (what exists and where)

- **Sign in** — username or email + password (usernames map to `<username>@members.gritandgrace.app`).
  "I have a join code" redeems a parent's code via `POST /api/join`. Provide App Review with a demo member account.
- **User-generated content (1.2)** — every post has Report (→ `reports`) and Block (→ `blocks`) in its "…" menu;
  first posts are held for a mentor; "Talk to someone" (Court header and Me tab) reaches a real adult (`POST /api/help`,
  falling back to `help_requests`).
- **Account deletion (5.1.1(v))** — Me → Delete my account → creates an `account_deletion_requests` row; the Academy
  confirms with the parent and deletes.
- **Camera / microphone** — only inside a live session's WebView (Jitsi), with usage strings in `app.json`.
- **Parents** signing in see "The parent portal lives on the web" and a Sign out button — nothing else.

## Known gaps

- Live headcount ("11 here") is not shown: `attendance` RLS lets a member read only her own row, so the app cannot
  count the room. Add a count RPC or return it from `POST /api/live/:id/join` to enable it.
- Video position is not tracked inside the Bunny iframe; opening a lesson marks it started, and "Mark as done"
  completes it. "min left" on Home uses `position_seconds` if something else writes it.
- Notifications row is static ("Push, quiet after 9pm"); push registration is not wired yet (`profiles.push_token`
  is ready for it).
