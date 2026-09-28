import { Hono } from 'hono';
import type { AppEnv, Env } from '../env';
import { body, HttpError, requireUser, sha256Hex } from '../lib';

// Course Studio: direct-from-browser video uploads to Bunny Stream.
// The Bunny API key never leaves the Worker — the browser only gets a short-lived TUS signature
// that is valid for one video object.
const studio = new Hono<AppEnv>();

const NOT_CONNECTED =
  'Video uploads are not connected yet. Connect Bunny Stream in Cloudflare → grits → Settings → Variables: BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_TOKEN_KEY';

function bunny(env: Env) {
  if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_API_KEY) throw new HttpError(503, NOT_CONNECTED);
  return { libraryId: env.BUNNY_LIBRARY_ID, apiKey: env.BUNNY_API_KEY };
}

type BunnyVideo = { guid: string; status: number; encodeProgress?: number; length?: number; title?: string };

// Bunny video status codes → what the Academy sees.
// 0 created · 1 uploaded · 2 processing · 3 transcoding · 4 finished · 5 error · 6 upload failed · 7/8 JIT ready.
function mapStatus(code: number): 'uploading' | 'processing' | 'ready' | 'failed' {
  if (code === 0) return 'uploading';
  if (code === 4 || code === 7 || code === 8) return 'ready';
  if (code === 5 || code === 6) return 'failed';
  return 'processing';
}

// Create the video object and hand back TUS credentials for a direct browser upload.
studio.post('/videos', requireUser('admin', 'owner'), async (c) => {
  const { libraryId, apiKey } = bunny(c.env);
  const input = await body<{ title?: string; lesson_id?: string }>(c);
  const title = (input.title ?? '').trim().slice(0, 200) || 'Lesson video';
  if (!input.lesson_id) throw new HttpError(400, 'lesson_id is required');

  const admin = c.get('admin');
  const { data: lesson } = await admin.from('lessons').select('id').eq('id', input.lesson_id).maybeSingle();
  if (!lesson) throw new HttpError(404, 'Lesson not found');

  const res = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    console.error('Bunny create video failed', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, res.status === 401 ? 'Bunny rejected the API key — check BUNNY_API_KEY and BUNNY_LIBRARY_ID' : 'Bunny Stream could not create the video. Try again.');
  }
  const video = (await res.json()) as BunnyVideo;

  const { error } = await admin.from('lessons').update({ bunny_video_id: video.guid, video_status: 'uploading' }).eq('id', lesson.id);
  if (error) throw new HttpError(500, error.message);

  // Long enough for a slow upload to finish or resume the next day.
  const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const signature = await sha256Hex(libraryId + apiKey + expires + video.guid);
  return c.json({ endpoint: 'https://video.bunnycdn.com/tusupload', videoId: video.guid, libraryId, expires, signature });
});

// Poll a video's encoding state; records "ready" (and the length) on the lesson.
studio.get('/videos/:videoId', requireUser('admin', 'owner'), async (c) => {
  const { libraryId, apiKey } = bunny(c.env);
  const videoId = c.req.param('videoId');
  const res = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`, {
    headers: { AccessKey: apiKey, Accept: 'application/json' },
  });
  if (res.status === 404) throw new HttpError(404, 'Bunny has no video with that ID in this library');
  if (!res.ok) throw new HttpError(502, 'Could not reach Bunny Stream. Try again.');
  const v = (await res.json()) as BunnyVideo;
  const status = mapStatus(v.status);
  const lengthSeconds = v.length ?? 0;

  const admin = c.get('admin');
  const { data: lessons } = await admin.from('lessons').select('id, duration_min, size_mb_480p, video_status').eq('bunny_video_id', videoId);
  for (const l of lessons ?? []) {
    const patch: Record<string, unknown> = {};
    const lessonStatus = status === 'uploading' ? (l.video_status ?? 'uploading') : status;
    if (l.video_status !== lessonStatus) patch.video_status = lessonStatus;
    if (status === 'ready' && lengthSeconds > 0) {
      const minutes = Math.max(1, Math.round(lengthSeconds / 60));
      if (!l.duration_min) patch.duration_min = minutes;
      if (!l.size_mb_480p) patch.size_mb_480p = Math.max(1, Math.round(minutes * 0.8));
    }
    if (Object.keys(patch).length) await admin.from('lessons').update(patch).eq('id', l.id);
  }

  return c.json({ videoId, status, progress: status === 'ready' ? 100 : (v.encodeProgress ?? 0), length_seconds: lengthSeconds, title: v.title ?? null });
});

export default studio;
