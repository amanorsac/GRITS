import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FOUNDER, FOUNDRY, INNER_COURT, SCRIPTURE, TAGLINES, VALUES, BLOG } from '../../content/academy';
import { ghs, priceFor } from '../../lib/format';
import type { AcademyEvent } from '../../lib/types';
import { nextEvent, SiteShell, useSiteData } from './Shell';

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

function Spotlight({ event }: { event: AcademyEvent }) {
  const c = useCountdown(event.starts_at);
  return (
    <aside className="spotlight" aria-label="Next event">
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
      <Link to={`/contact?topic=${event.program_slug ?? 'enquiry'}&subject=${encodeURIComponent(event.title)}`} className="btn btn-on-dark btn-block">
        Register interest
      </Link>
    </aside>
  );
}

export default function Home() {
  const data = useSiteData();
  const inner = data?.programs.find((p) => p.slug === 'inner-court');
  const event = data ? nextEvent(data.events) : null;
  const price = inner ? priceFor(inner) : null;

  return (
    <SiteShell>
      <section className="hero-v2">
        <div className="hero-inner">
          <div>
            <p className="eyebrow eyebrow-line">Welcome home</p>
            <h1>
              We don&rsquo;t just raise girls.
              <br />
              We raise <em>Queens.</em>
            </h1>
            <p className="lead">{TAGLINES.welcome}</p>
            <p className="lead" style={{ fontSize: '1.05rem', opacity: 0.85 }}>
              Faith-based mentoring for girls 8–17 — intellectually sharp, emotionally grounded, spiritually wise, socially confident.
            </p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link to="/enrol" className="btn btn-on-dark" style={{ minHeight: 52, padding: '0 28px' }}>
                Secure her crown today
              </Link>
              <Link to="/programs" className="btn btn-secondary btn-pill" style={{ color: '#fff' }}>
                Explore the programs
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
          A royal priesthood · Chosen &amp; beloved
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
            {FOUNDRY.body.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <Link to="/about" className="btn btn-secondary">
              Discover our story
            </Link>
          </div>
          <div className="card card-maroon" style={{ padding: 32 }}>
            {FOUNDRY.close.map((l) => (
              <p key={l} className="serif" style={{ fontSize: '1.6rem', margin: '0 0 6px', color: '#fff' }}>
                {l}
              </p>
            ))}
            <p className="eyebrow" style={{ color: 'var(--gold)', marginTop: 16, marginBottom: 0 }}>
              This is the foundry.
            </p>
          </div>
        </div>
      </section>

      <section className="section band-plum" id="values">
        <div className="section-inner">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            The Inner Court · The golden pillars
          </p>
          <h2>G.I.R.L.S. — the essence of who she becomes</h2>
          <p style={{ maxWidth: 680 }}>A 12-month transformational mentoring journey designed to nurture confident, purpose-driven, emotionally intelligent young queens.</p>
          <div className="value-grid">
            {VALUES.map((v) => (
              <article key={v.name} className="value-card">
                <div className="letter" aria-hidden="true">
                  {v.letter}
                </div>
                <h3>{v.name}</h3>
                <div className="sub">{v.sub}</div>
                {v.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="programs">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="eyebrow">Programs</p>
              <h2>Where she becomes who she is</h2>
              <p className="muted" style={{ maxWidth: 640, margin: 0 }}>
                There is a gap between what school teaches and what home provides. We fill it with wisdom, values and life skills.
              </p>
            </div>
            <Link to="/programs">All programs and services →</Link>
          </div>
          <div className="program-grid">
            <article className="card program-card featured">
              <div className="spread">
                <span className="status status-progress">Flagship · enrolling</span>
                <span className="muted">12 months</span>
              </div>
              <h3>The Inner Court</h3>
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
            <p className="eyebrow">For parents</p>
            <h2>Watch her grow, week by week</h2>
            <p>
              Her progress, her attendance, her certificates, and a measured before-and-after across all five values — in your own parent portal. Plus the Parents Power Circle. Not a mystery. Not a WhatsApp group.
            </p>
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
          <div className="portrait">[FOUNDER PORTRAIT]</div>
          <div>
            <p className="eyebrow">Meet the founder</p>
            <h2>{FOUNDER.name}</h2>
            <p className="muted" style={{ fontWeight: 600 }}>
              {FOUNDER.title} · {FOUNDER.credentials}
            </p>
            {FOUNDER.bio.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <blockquote>“{FOUNDER.quote}”</blockquote>
          </div>
        </div>
      </section>

      <section className="section band-blush" id="journal">
        <div className="section-inner">
          <div className="section-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow">Stories &amp; insights</p>
              <h2>Wisdom for raising Queens</h2>
            </div>
            <Link to="/journal">Read the journal →</Link>
          </div>
          <div className="blog-grid">
            {BLOG.slice(0, 3).map((b) => (
              <Link key={b.title} to="/journal" className="card blog-card">
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
            Ready to join the movement?
          </p>
          <h2>Because when leaders unite, daughters rise.</h2>
          <p style={{ maxWidth: 560, margin: '0 auto 24px' }}>Secure her crown today and connect with a network dedicated to making a generational impact.</p>
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
