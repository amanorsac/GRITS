import { Hono } from 'hono';
import type { AppEnv, Env } from '../env';
import { body, HttpError, requireUser, sha256Hex } from '../lib';

const media = new Hono<AppEnv>();

// Bunny Stream embed token authentication: token = sha256(key + videoId + expires).
async function bunnyEmbedUrl(env: Env, videoId: string, ttlSeconds = 4 * 60 * 60) {
  if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_TOKEN_KEY) return null;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await sha256Hex(env.BUNNY_TOKEN_KEY + videoId + expires);
  const url = new URL(`https://iframe.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${videoId}`);
  url.searchParams.set('token', token);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('autoplay', 'false');
  url.searchParams.set('preload', 'false');
  url.searchParams.set('responsive', 'true');
  return { url: url.toString(), expires_at: new Date(expires * 1000).toISOString() };
}

media.get('/lessons/:id/play', requireUser(), async (c) => {
  // RLS on lessons is the access check: if she can read it, she can watch it.
  const { data: lesson } = await c
    .get('asUser')
    .from('lessons')
    .select('id, bunny_video_id, unlock_at')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!lesson) throw new HttpError(403, 'This lesson is for enrolled members');
  const staff = ['mentor', 'moderator', 'admin', 'owner'].includes(c.get('profile').role);
  if (!staff && lesson.unlock_at && new Date(lesson.unlock_at) > new Date()) throw new HttpError(423, 'This lesson has not unlocked yet');
  if (!lesson.bunny_video_id) return c.json({ embed_url: null, expires_at: null });
  const signed = await bunnyEmbedUrl(c.env, lesson.bunny_video_id);
  if (!signed) return c.json({ embed_url: null, expires_at: null, note: 'Video hosting is not configured yet' });
  return c.json({ embed_url: signed.url, expires_at: signed.expires_at });
});

// ── JaaS (8x8 Jitsi as a Service) — RS256 JWT signed with the app's private key.
function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function jaasToken(env: Env, user: { id: string; name: string; email?: string | null; moderator: boolean }) {
  const pem = env.JAAS_PRIVATE_KEY!.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: env.JAAS_KEY_ID };
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: env.JAAS_APP_ID,
    // Short-lived and per-person; the room itself is chosen by the URL below.
    room: '*',
    iat: now,
    nbf: now - 10,
    exp: now + 3 * 60 * 60,
    context: {
      user: { id: user.id, name: user.name, email: user.email ?? undefined, moderator: String(user.moderator) },
      features: { livestreaming: 'false', recording: String(user.moderator), transcription: 'false', 'outbound-call': 'false' },
    },
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

media.post('/live/:id/join', requireUser(), async (c) => {
  const profile = c.get('profile');
  const { audio_only } = await body<{ audio_only?: boolean }>(c).catch(() => ({ audio_only: false }));
  const { data: session } = await c
    .get('asUser')
    .from('live_sessions')
    .select('id, title, kind, youtube_id, jaas_room, host_id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!session) throw new HttpError(403, 'This session is not open to you');

  if (profile.role === 'member') {
    await c.get('admin').from('attendance').upsert(
      { session_id: session.id, member_id: profile.id, audio_only: !!audio_only },
      { onConflict: 'session_id,member_id' },
    );
  }

  if (session.kind === 'broadcast' || session.youtube_id) {
    if (!session.youtube_id) throw new HttpError(409, 'The broadcast link has not been added yet');
    return c.json({ provider: 'youtube', url: `https://www.youtube-nocookie.com/embed/${session.youtube_id}?rel=0&modestbranding=1&playsinline=1` });
  }

  if (!c.env.JAAS_APP_ID || !c.env.JAAS_PRIVATE_KEY || !c.env.JAAS_KEY_ID)
    throw new HttpError(503, 'Live rooms are not configured yet (JaaS)');
  const room = session.jaas_room || `gg-${session.id.slice(0, 8)}`;
  const moderator = session.host_id === profile.id || ['mentor', 'moderator', 'admin', 'owner'].includes(profile.role);
  const jwt = await jaasToken(c.env, {
    id: profile.id,
    name: profile.display_name || profile.full_name,
    email: profile.role === 'member' ? null : profile.email,
    moderator,
  });
  const cfg = [
    'config.prejoinConfig.enabled=false',
    'config.disableDeepLinking=true',
    'config.startWithVideoMuted=true',
    audio_only ? 'config.startAudioOnly=true' : '',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
  ].filter(Boolean).join('&');
  return c.json({ provider: 'jaas', url: `https://8x8.vc/${c.env.JAAS_APP_ID}/${encodeURIComponent(room)}?jwt=${jwt}#${cfg}` });
});

export default media;
