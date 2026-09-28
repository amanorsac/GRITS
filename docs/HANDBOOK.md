# Running Grit & Grace — the Academy handbook

Everything below is done in **The Palace** (sign in → you land there). No code, no developer.

## Every day
- **Community → moderation queue.** Safety items are red and sit at the top. Every action needs a short note.
- **Inbox.** "Talk to someone" messages from girls, and messages from the website's contact form. Reply by
  phone or email, then mark them handled.

## The website (Public site → …)
| To change… | Go to |
|---|---|
| Home page words, hero photo, founder photo & bio, values, pillars, FAQ, phone numbers, the banner at the top | **Website** — pick a section, edit, **Save**. "Reset to default" undoes your changes. |
| Blog posts | **Journal** → New article. Write in plain text: a blank line starts a new paragraph, `## ` makes a heading, `- ` makes a bullet. Pick a future date to schedule it. |
| Photos and videos | **Gallery** → drag in many photos at once, or paste a YouTube link. Photos are shrunk automatically so they load fast on phones. |
| Events (Royal Table, Crown Council, Summits) | **Events** → add date, venue, cover photo, registration link. Untick "Show on the site" to hide one. |
| Programs and prices | **Events → Programs** (or **Commerce**). Price is in cedis. For the Inner Court, "pro-rata" charges only for the months left in the year. |
| Any uploaded file | **Media library** |

## Courses (Course studio)
1. Open a **month** to change its title, summary, value, cover photo and unlock date.
2. Inside a month, **add lessons**, reorder them with the arrows, and open one to edit.
3. **Video:** drag the video file onto the lesson. It uploads in pieces, so a dropped connection just resumes.
   After upload it says "Processing" — you can close the page; it becomes "Ready" by itself.
4. **Workbooks:** attach PDFs, pictures or audio. Only enrolled girls can download them.
5. Click **Preview as member** to see it exactly as a girl will.

## Live sessions
- **Live sessions** → schedule a session: *Interactive* for a Circle (up to 25 cameras, with audio-only for low data),
  *Broadcast* for everyone (paste the YouTube Live ID).
- **Go live** when you start, **End for all** when you finish.
- Afterwards, **Add recording** (a YouTube or Bunny link). Tick "turn into a lesson" to put it in a month.

## People
- **People & access:** invite mentors, moderators and admins (they get an email to set a password);
  create Circles and choose their mentor; post **announcements** for girls, parents or everyone.
- **Members:** put each girl in a Circle.
- **Commerce:** payments, failed mobile-money instalments, prices.
- Parents enrol themselves on the website and get a join code for their daughter. Girls sign in with a
  username — if a girl forgets her password, her parent contacts you.

## Demo data
While you are showing the platform, sample girls, posts and sessions make it look lived-in.
When real families arrive: **Overview → Remove demo data**. Real accounts are never touched.

## One-time settings (Cloudflare → Workers → grits → Settings → Variables)
| Name | What it switches on |
|---|---|
| `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY` (secret), `BUNNY_TOKEN_KEY` (secret) | Lesson video upload and playback |
| `PAYSTACK_SECRET_KEY` (secret) | Mobile money and card payments |
| `RESEND_API_KEY` (secret) | Emails (receipts, join codes, safeguarding alerts) |
| `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY` (secret) | Circle video rooms |
| `OPENAI_API_KEY` (secret) | Extra automatic safety check on posts |
| `ZOHO_FLOW_WEBHOOK_URL` (secret) | Send enquiries, enrolments and payments to Zoho |
| `SAFEGUARDING_EMAIL`, `EMAIL_FROM`, `APP_ORIGIN` | Who gets alerts, who emails come from, the site address |

Values set there survive every update.
