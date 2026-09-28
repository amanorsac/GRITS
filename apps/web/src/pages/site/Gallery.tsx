import { useEffect, useRef, useState } from 'react';
import { useDialog } from '../../components/dialog';
import { Loading } from '../../components/ui';
import { youtubeId } from '../../lib/media';
import { GALLERY_CATEGORIES, useSite, type GalleryItem } from '../../lib/site';
import { sb } from '../../lib/supabase';
import { PageHero, SiteShell } from './Shell';

const FILTERS = ['All', ...GALLERY_CATEGORIES, 'Videos'] as const;
type Filter = (typeof FILTERS)[number];

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;

function thumbOf(item: GalleryItem) {
  if (item.kind === 'video') {
    const id = youtubeId(item.url);
    return id ? ytThumb(id) : null;
  }
  return item.url;
}

function Lightbox({ items, index, onIndex, onClose }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const item = items[index]!;
  const many = items.length > 1;
  const go = (d: number) => onIndex((index + d + items.length) % items.length);
  useDialog(ref, onClose, (e) => {
    if (!many) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  const vid = item.kind === 'video' ? youtubeId(item.url) : null;
  const label = item.caption || (item.kind === 'video' ? 'Video' : 'Photo');
  return (
    <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="lightbox-inner" role="dialog" aria-modal="true" aria-label={`${label} — ${index + 1} of ${items.length}`} tabIndex={-1}>
        <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label="Close" data-autofocus>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <figure className="lightbox-figure">
          {vid ? (
            <div className="lightbox-video">
              <iframe key={vid} src={ytEmbed(vid)} title={label} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          ) : (
            <img key={item.id} src={item.url} alt={item.caption || ''} />
          )}
          <figcaption>
            <span>{item.caption}</span>
            <span className="lightbox-count">
              {index + 1} / {items.length}
            </span>
          </figcaption>
        </figure>
        {many && (
          <>
            <button type="button" className="lightbox-btn lightbox-prev" onClick={() => go(-1)} aria-label="Previous">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="lightbox-btn lightbox-next" onClick={() => go(1)} aria-label="Next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Gallery() {
  const P = useSite('pages');
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    sb()
      .from('gallery_items')
      .select('*')
      .order('position')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(true);
        setItems(((data ?? []) as GalleryItem[]).filter((i) => i.kind === 'image' || youtubeId(i.url)));
      });
    return () => {
      alive = false;
    };
  }, []);

  const shown = (items ?? []).filter((i) => (filter === 'All' ? true : filter === 'Videos' ? i.kind === 'video' : i.category === filter));
  const available = FILTERS.filter((f) => f === 'All' || (items ?? []).some((i) => (f === 'Videos' ? i.kind === 'video' : i.category === f)));

  return (
    <SiteShell title="Gallery">
      <PageHero eyebrow={P.galleryEyebrow} title={P.galleryTitle}>
        {P.galleryText && <p>{P.galleryText}</p>}
      </PageHero>
      <section className="section">
        <div className="section-inner">
          {items && items.length > 0 && available.length > 2 && (
            <div className="row" role="group" aria-label="Filter the gallery" style={{ marginBottom: 24 }}>
              {available.map((f) => (
                <button key={f} type="button" className="chip chip-lg" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          )}
          {!items && <Loading lines={4} />}
          {items && shown.length === 0 && <p className="muted">{error ? 'The gallery could not be loaded just now.' : 'Photos are coming soon.'}</p>}
          <ul className="masonry" aria-label={`${filter} — ${shown.length} items`}>
            {shown.map((item, i) => {
              const src = thumbOf(item);
              const label = item.caption || (item.kind === 'video' ? 'Play video' : 'Open photo');
              return (
                <li key={item.id}>
                  <button type="button" className={`masonry-item${item.kind === 'video' ? ' is-video' : ''}`} onClick={() => setOpen(i)} aria-label={item.kind === 'video' ? `Play video: ${label}` : `Open photo: ${label}`}>
                    {src && <img src={src} alt="" loading="lazy" decoding="async" />}
                    {item.kind === 'video' && (
                      <span className="play" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
                    {item.caption && <span className="masonry-caption">{item.caption}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      {open !== null && shown[open] && <Lightbox items={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </SiteShell>
  );
}
