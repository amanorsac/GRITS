# Grit & Grace — API contract

Two back ends, one identity:

1. **Supabase** (`https://ckwzixmsyfgonqiayltb.supabase.co`) — Postgres with row-level security. Clients read
   directly with the anon key + the signed-in user's session. Schema: `supabase/migrations/`.
2. **The Worker** (`/api/*` on the `grits` Cloudflare Worker) — anything that needs a secret or must be trusted:
   posting (moderation), payments, video signing, live-room tokens, account creation for girls.

All Worker calls that act as a user send `Authorization: Bearer <supabase access_token>`.
Errors are `{ "error": "message" }` with a 4xx/5xx status.

## Identity

| Who | Signs in with | Created by |
|---|---|---|
| Parent | email + password | self sign-up on the web (`/enrol`) |
| Girl (member) | **username** + password | redeeming the join code her parent gives her (`POST /api/join`) |
| Mentor / moderator / admin | email + password | an admin (role set in `app_metadata`) |

A girl's username maps to the auth email `<username>@members.gritandgrace.app`. Clients do this mapping:
if the login field has no `@`, append `@members.gritandgrace.app`.

## Worker endpoints

| Method & path | Auth | Body | Returns |
|---|---|---|---|
| `GET /api/health` | – | – | `{ ok: true }` |
| `POST /api/join` | – | `{ code, username, password, display_name }` | `{ ok: true, email }` — then sign in with that email + password |
| `POST /api/posts` | member/mentor | `{ space_id, kind, body }` (`kind`: general/win/prayer/books/scripture) | `{ id, status: "approved" \| "pending", reason? }` |
| `POST /api/replies` | member/mentor | `{ post_id, body }` | `{ id, status }` |
| `GET /api/lessons/:id/play?saver=1` | enrolled | – | `{ embed_url, expires_at }` (Bunny signed iframe URL; `embed_url` null if no video yet) |
| `POST /api/live/:id/join` | enrolled | `{ audio_only?: boolean }` | `{ provider: "jaas" \| "youtube", url }` |
| `POST /api/help` | any | `{ body }` | `{ ok: true }` — "Talk to someone"; emails the safeguarding lead |
| `POST /api/enrol` | parent | see `apps/web/worker/routes/enrol.ts` | `{ authorization_url, reference, join_code }` |
| `POST /api/paystack/webhook` | Paystack HMAC | – | 200 |
| `POST /api/waitlist` | – | `{ program, email }` | `{ ok: true }` |
| `POST /api/admin/videos` | admin/owner | `{ title, lesson_id }` | `{ endpoint, videoId, libraryId, expires, signature }` — creates the Bunny video, sets `lessons.bunny_video_id` + `video_status='uploading'`; the browser then uploads over TUS with headers `AuthorizationSignature`, `AuthorizationExpire`, `VideoId`, `LibraryId`. `signature = sha256(libraryId + BUNNY_API_KEY + expires + videoId)`. 503 if Bunny is not connected |
| `GET /api/admin/videos/:videoId` | admin/owner | – | `{ videoId, status: "uploading" \| "processing" \| "ready" \| "failed", progress, length_seconds }` — also writes `video_status` (and `duration_min`/`size_mb_480p` when empty) on the lesson |

Posting rules enforced by the Worker: the Court is read-only 21:00–06:00 Africa/Accra (GMT); timed-out members
cannot post; the automated moderation check runs on every write; first posts, flagged posts and anything the
check reads as risk of harm go to the human queue (`status: "pending"`).

## Tables clients read directly (RLS-scoped)

`profiles` (own row), `public_profiles` (view: id, display_name, role, crown_level, circle_id),
`programs`, `enrolments`, `courses`, `modules`, `lessons`, `lesson_progress`, `journal_entries`,
`badges`, `member_badges`, `certificates`, `spaces`, `posts`, `replies`, `reactions`, `reports`,
`live_sessions`, `attendance`, `member_permissions`, `circles`, `dm_threads`, `dm_messages`,
`help_requests`, `account_deletion_requests`, `announcements`.

Clients write directly to: `lesson_progress` (own), `journal_entries` (own), `reactions` (own),
`reports` (own), `blocks` (own), `attendance` (own), `help_requests` (own), `dm_threads`/`dm_messages`,
`account_deletion_requests` (own), `profiles` columns `display_name`, `data_saver`, `push_token`.

## RPCs

| Function | Who | Purpose |
|---|---|---|
| `complete_lesson(p_lesson)` | member | marks done; awards badge + certificate when the month completes → `{ done, total, certificate }` |
| `member_streak(p_member?)` | self/parent/staff | consecutive active days |
| `journal_count(p_child)` | parent | how many entries exist (never the text) |
| `set_member_permission(p_child, p_scope, p_granted)` | parent | scope: circle/court/mentor_dm — ledgered |
| `moderate_post(p_post, p_action, p_note)` | moderator+ | approve/remove/warn/timeout/escalate — note required |
| `palace_overview()` | staff | admin metrics JSON |
| `module_funnel(p_module)` | staff | completion % by lesson |
| `verify_certificate(p_code)` | anyone | certificate check |
