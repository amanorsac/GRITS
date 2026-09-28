import { sb } from './supabase';

// Site images live in the public "media" bucket (read by anyone, written by admins through RLS).
// Every upload is resized in the browser first, so a 12 MB phone photo becomes ~300 KB.

export const MEDIA_BUCKET = 'media';
const MAX_EDGE = 1920;
const MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/*';

export type MediaFile = {
  path: string; // e.g. gallery/2026/uuid.webp
  folder: string; // top-level folder, e.g. gallery
  name: string;
  url: string;
  size: number | null;
  created_at: string | null;
};

export function isImageFile(f: File) {
  // SVG can carry script, so it is never accepted.
  return f.type.startsWith('image/') && f.type !== 'image/svg+xml';
}

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoke after decode — the pixels are in memory now.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resizes to a 1920px long edge and re-encodes as WebP (JPEG where the browser cannot write WebP). */
export async function resizeImage(file: File): Promise<Blob> {
  if (!isImageFile(file)) throw new Error(`${file.name} is not an image.`);
  let src: Awaited<ReturnType<typeof decode>>;
  try {
    src = await decode(file);
  } catch {
    throw new Error(`${file.name} could not be read. Try saving it as a JPEG or PNG first.`);
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src && typeof src.close === 'function') src.close();

  for (const quality of [0.82, 0.7, 0.55]) {
    let blob = await toBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) throw new Error('Could not encode the image.');
    if (blob.size <= MAX_BYTES) return blob;
  }
  throw new Error(`${file.name} is still larger than 10 MB after resizing.`);
}

export function publicUrl(path: string) {
  return sb().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The object path for a URL in our bucket, or null for any other URL. */
export function pathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]!);
}

/** Resizes, uploads to media/${folder}/${yyyy}/${uuid}.webp and returns the public URL. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const blob = await resizeImage(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const safeFolder = folder.replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'library';
  const path = `${safeFolder}/${new Date().getFullYear()}/${uuid()}.${ext}`;
  const { error } = await sb().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message.includes('row-level security') ? 'Only admins can upload images.' : error.message);
  return publicUrl(path);
}

type StorageEntry = { name: string; id: string | null; created_at?: string | null; metadata?: { size?: number } | null };

async function listDir(prefix: string, depth: number): Promise<MediaFile[]> {
  const { data, error } = await sb().storage.from(MEDIA_BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error(error.message);
  const out: MediaFile[] = [];
  for (const e of (data ?? []) as StorageEntry[]) {
    if (e.name === '.emptyFolderPlaceholder') continue;
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id == null) {
      if (depth < 3) out.push(...(await listDir(path, depth + 1)));
    } else {
      out.push({ path, folder: path.split('/')[0]!, name: e.name, url: publicUrl(path), size: e.metadata?.size ?? null, created_at: e.created_at ?? null });
    }
  }
  return out;
}

/** Everything in the media bucket (or one folder), newest first. */
export async function listMedia(folder?: string): Promise<MediaFile[]> {
  const files = await listDir(folder ?? '', folder ? 1 : 0);
  return files.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export async function deleteMedia(path: string) {
  const { error } = await sb().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export function formatBytes(n: number | null) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** The 11-character video id from any common YouTube link, or null. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Only links we are happy to put in an href: http(s), mailto, tel, or a path on this site. */
export function safeHref(url: string | null | undefined): string | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^(mailto:|tel:)/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
