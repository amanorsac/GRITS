import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, Env } from './env';
import { adminClient, HttpError } from './lib';
import community from './routes/community';
import enrol from './routes/enrol';
import media from './routes/media';
import adminRoutes from './routes/admin';
import site from './routes/site';

const api = new Hono<AppEnv>().basePath('/api');

// The mobile app calls from no origin; the web app is same-origin. Allow both.
api.use('*', cors({ origin: (o) => o ?? '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'OPTIONS'] }));

api.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// Public runtime config for the browser app, so keys live in one place (the Worker).
api.get('/config', (c) =>
  c.json({ supabaseUrl: c.env.SUPABASE_URL, supabaseAnonKey: c.env.SUPABASE_ANON_KEY ?? '' }, 200, { 'Cache-Control': 'public, max-age=300' }),
);
api.route('/', community);
api.route('/', enrol);
api.route('/', media);
api.route('/', site);
api.route('/admin', adminRoutes);

api.notFound((c) => c.json({ error: 'Not found' }, 404));
api.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  return c.json({ error: 'Something went wrong on our side' }, 500);
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!env.APP_ORIGIN) env.APP_ORIGIN = url.origin;
    if (url.pathname.startsWith('/api/')) return api.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },

  // Daily: keep the free Supabase project awake (it pauses after 7 idle days).
  async scheduled(_controller, env) {
    try {
      const { error } = await adminClient(env).from('keepalive').upsert({ id: 1, pinged_at: new Date().toISOString() });
      if (error) console.error('keepalive failed', error.message);
      else console.log('keepalive ok');
    } catch (e) {
      console.error('keepalive skipped', e instanceof Error ? e.message : e);
    }
  },
} satisfies ExportedHandler<Env>;
