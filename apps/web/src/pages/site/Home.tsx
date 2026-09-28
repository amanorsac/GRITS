import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ghs, priceFor } from '../../lib/format';
import { loadPublishedArticles, useSite, type Article, type SiteEvent } from '../../lib/site';
import type { AcademyEvent } from '../../lib/types';
import { Cover, FounderPortrait, nextEvent, RegisterLink, SiteShell, useSiteData } from './Shell';

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  return { d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60, s: Math.floor(ms / 1000) % 60 };
}

export function eventDate(e: AcademyEvent) {
  if (!e.starts_at) return e.date_label ?? 'Date to be announced';
  const d = new Date(e.starts_at);
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' });
  const t = (x: Date) => x.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Accra' });
  return `${day} · ${t(d)}${e.ends_at ? ` – ${t(new Date(e.ends_at))}` : ''}`;
}

/** The newest published journal articles. */
export function useArticles(limit?: number) {
  const [list, setList] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadPublishedArticles(limit)
      .then((a) => alive && setList(a))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [limit]);
  return { list, error };
}

function Spotlight({ event }: { event: SiteEvent }) {
  const c = useCountdown(event.starts_at);
  return (
    <aside className="spotlight" aria-label="Next event">
      {event.cover_url && <Cover url={event.cover_url} className="spotlight-cover" />}
      <p className="eyebrow" style={{ color: 'var(--pink-bright)', margin: 0 }}>
        Upcoming event
      </p>
      <h3>{event.title}</h3>
      <p style={{ margin: 0 }} className="serif">
        {event.tagline}
      </p>
      {c ? (
        <div className="countdown" role="timer" aria-label={`${c.d} days, ${c.h} hours to go`}>
          {(
            [
              [c.d, 'Days'],
              [c.h, 'Hours'],
              [c.m, 'Mins'],
              [c.s, 'Secs'],
            ] as const
          ).map(([v, l]) => (
            <div key={l}>
              <b>{String(v).padStart(2, '0')}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="serif" style={{ fontSize: '1.6rem', color: 'var(--gold)', margin: '14px 0' }}>
          {event.date_label}
        </p>
      )}
      <p style={{ fontSize: '.95rem' }}>
        {event.starts_at ? eventDate(event) : null}
        {event.starts_at && event.venue ? ' · ' : ''}
        {event.venue}
      </p>
      <RegisterLink event={event} className="btn btn-on-dark btn-block" />
    </aside>
  );
}

export default function Home() {
  const data = useSiteData();
  const hero = useSite('hero');
  const SCRIPTURE = useSite('scripture');
  const FOUNDRY = useSite('foundry');
  const VALUES = useSite('values');
  const FOUNDER = useSite('founder');
  const INNER_COURT = useSite('inner_court');
  const TAGLINES = useSite('taglines');
  const H = useSite('home');
  const articles = useArticles(3);
  const inner = data?.programs.find((p) => p.slug === 'inner-court');
  const event = data ? nextEvent(data.events) : null;
  const price = inner ? priceFor(inner) : null;

  return (
    <SiteShell>
      <section className={`hero-v2${hero.image ? ' has-image' : ''}`}>
        {hero.image && <img className="hero-bg" src={hero.image} alt="" fetchPriority="high" decoding="async" />}
        <div className="hero-inner">
          <div>
            <p className="eyebrow eyebrow-line">{hero.eyebrow}</p>
            <h1>
              {hero.line1}
              {hero.line1 && (hero.line2 || hero.emphasis) && <br />}
              {hero.line2}
              {hero.line2 && hero.emphasis ? ' ' : ''}
              {hero.emphasis && <em>{hero.emphasis}</em>}
            </h1>
            {hero.lead && <p className="lead">{hero.lead}</p>}
            {hero.sublead && (
              <p className="lead" style={{ fontSize: '1.05rem', opacity: 0.85 }}>
                {hero.sublead}
              </p>
            )}
            <div className="row" style={{ marginTop: 28 }}>
              <Link to="/enrol" className="btn btn-on-dark" style={{ minHeight: 52, padding: '0 28px' }}>
                {hero.primaryCta}
              </Link>
              <Link to="/programs" className="btn btn-secondary btn-pill" style={{ color: '#fff' }}>
                {hero.secondaryCta}
              </Link>
            </div>
          </div>
          {event ? (
            <Spotlight event={event} />
          ) : (
            <aside className="spotlight">
              <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
                The Inner Court
              </p>
              <h3>{TAGLINES.motto}</h3>
              <p>{INNER_COURT.summons}</p>
            </aside>
          )}
        </div>
      </section>

      <section className="scripture" aria-label="Scripture">
        <p className="eyebrow" style={{ margin: 0 }}>
          {SCRIPTURE.eyebrow}
        </p>
        <blockquote>“{SCRIPTURE.text}”</blockquote>
        <cite>— {SCRIPTURE.ref}</cite>
      </section>

      <section className="section" id="story">
        <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'center' }}>
          <div>
            <p className="eyebrow">{FOUNDRY.eyebrow}</p>
            <h2>{FOUNDRY.title}</h2>
            <p style={{ fontSize: '1.15rem' }}>{FOUNDRY.lead}</p>
            {FOUNDRY.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <Link to="/about" className="btn btn-secondary">
              {FOUNDRY.cta}
            </Link>
          </div>
          <div className="card card-maroon" style={{ padding: 32 }}>
            {FOUNDRY.close.map((l, i) => (
              <p key={i} className="serif" style={{ fontSize: '1.6rem', margin: '0 0 6px', color: '#fff' }}>
                {l}
              </p>
            ))}
            <p className="eyebrow" style={{ color: 'var(--gold)', marginTop: 16, marginBottom: 0 }}>
              {FOUNDRY.closeTag}
            </p>
          </div>
        </div>
      </section>

      <section className="section band-plum" id="values">
        <div className="section-inner">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            {H.valuesEyebrow}
          </p>
          <h2>{H.valuesTitle}</h2>
          <p style={{ maxWidth: 680 }}>{H.valuesText}</p>
          <ValueGrid values={VALUES} />
        </div>
      </section>

      <section className="section" id="programs">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="eyebrow">{H.programsEyebrow}</p>
              <h2>{H.programsTitle}</h2>
              <p className="muted" style={{ maxWidth: 640, margin: 0 }}>
                {H.programsText}
              </p>
            </div>
            <Link to="/programs">All programs and services →</Link>
          </div>
          <div className="program-grid">
            <article className="card program-card featured">
              <Cover url={inner?.cover_url} />
              <div className="spread">
                <span className="status status-progress">Flagship · {inner && !inner.is_open ? 'waitlist' : 'enrolling'}</span>
                <span className="muted">{inner?.duration_label || '12 months'}</span>
              </div>
              <h3>{inner?.name ?? 'The Inner Court'}</h3>
              <p style={{ margin: 0 }}>{INNER_COURT.summons}</p>
              <div>
                <div className="price">{ghs(price)}</div>
                <div className="muted">
                  {inner?.pro_rata && price !== inner.price_pesewas ? `for the rest of this cohort · ${ghs(inner.price_pesewas)} for a full year` : 'annual investment per queen'}
                </div>
              </div>
              <ul>
                {(inner?.inclusions ?? []).slice(0, 4).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <Link to="/programs/inner-court" className="btn btn-primary">
                See the syllabus &amp; enrol
              </Link>
            </article>
            {data?.programs
              .filter((p) => p.slug === 'hershift' || p.slug === 'royal-table')
              .map((p) => (
                <article key={p.slug} className="card program-card">
                  <Cover url={p.cover_url} />
                  <div className="spread">
                    <span className={`status ${p.is_open ? 'status-complete' : 'status-attention'}`}>{p.is_open ? p.duration_label : 'Waitlist open'}</span>
                    <span className="muted">{p.audience}</span>
                  </div>
                  <h3>{p.name}</h3>
                  <p style={{ margin: 0 }}>{p.summary}</p>
                  {p.price_pesewas && <div className="price">{ghs(p.price_pesewas)}</div>}
                  <ul>
                    {p.inclusions.slice(0, 3).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  <Link to={`/contact?topic=${p.slug}&subject=${encodeURIComponent(p.name)}`} className="btn btn-secondary">
                    {p.slug === 'hershift' ? 'Join the waitlist' : 'Book a table'}
                  </Link>
                </article>
              ))}
          </div>
        </div>
      </section>

      <section className="section band-blush" id="parents">
        <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'center' }}>
          <div>
            <p className="eyebrow">{H.parentsEyebrow}</p>
            <h2>{H.parentsTitle}</h2>
            <p>{H.parentsText}</p>
            <Link to="/enrol" className="btn btn-primary">
              Start with your details
            </Link>
          </div>
          <div className="card">
            <p className="eyebrow">Your weekly digest</p>
            <p className="serif" style={{ fontSize: '1.25rem' }}>
              This week Ama completed 2 lessons, attended the live session, and earned her Integrity badge.
            </p>
            <div className="stack">
              {(
                [
                  ['Gracefulness', 62, 19],
                  ['Integrity', 71, 23],
                  ['Resilience', 68, 24],
                ] as const
              ).map(([k, v, d]) => (
                <div key={k}>
                  <div className="spread">
                    <span>{k}</span>
                    <span style={{ color: 'var(--ok)', fontWeight: 700 }}>+{d}</span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
              Her journal and her messages with her mentor stay private — you see that they exist, not what she wrote.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="founder">
        <div className="section-inner founder-v2">
          <FounderPortrait />
          <div>
            <p className="eyebrow">Meet the founder</p>
            <h2>{FOUNDER.name}</h2>
            <p className="muted" style={{ fontWeight: 600 }}>
              {[FOUNDER.title, FOUNDER.credentials].filter(Boolean).join(' · ')}
            </p>
            {FOUNDER.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {FOUNDER.quote && <blockquote>“{FOUNDER.quote}”</blockquote>}
          </div>
        </div>
      </section>

      <section className="section band-blush" id="journal">
        <div className="section-inner">
          <div className="section-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow">{H.journalEyebrow}</p>
              <h2>{H.journalTitle}</h2>
            </div>
            <Link to="/journal">Read the journal →</Link>
          </div>
          {articles.list && articles.list.length === 0 && <p className="muted">New articles are on their way.</p>}
          <div className="blog-grid" aria-busy={!articles.list && !articles.error}>
            {articles.list?.map((b) => (
              <Link key={b.id} to={`/journal/${b.slug}`} className="card blog-card">
                <Cover url={b.cover_url} className="blog-cover-img" />
                <span className="eyebrow" style={{ margin: 0 }}>
                  {b.tag}
                </span>
                <h3>{b.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {b.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section band-plum cta-band">
        <div className="section-inner">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            {H.ctaEyebrow}
          </p>
          <h2>{H.ctaTitle}</h2>
          <p style={{ maxWidth: 560, margin: '0 auto 24px' }}>{H.ctaText}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/enrol" className="btn btn-on-dark" style={{ minHeight: 52 }}>
              Secure her crown
            </Link>
            <Link to="/contact" className="btn btn-secondary btn-pill" style={{ color: '#fff' }}>
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export function ValueGrid({ values }: { values: { letter: string; name: string; sub: string; lines: string[] }[] }) {
  return (
    <div className="value-grid">
      {values.map((v, i) => (
        <article key={i} className="value-card">
          <div className="letter" aria-hidden="true">
            {v.letter || v.name.slice(0, 1)}
          </div>
          <h3>{v.name}</h3>
          <div className="sub">{v.sub}</div>
          {v.lines.map((l, j) => (
            <p key={j}>{l}</p>
          ))}
        </article>
      ))}
    </div>
  );
}
