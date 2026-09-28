import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon, Loading } from '../../components/ui';
import { ghs, monthsLeft, priceFor } from '../../lib/format';
import { safeHref } from '../../lib/media';
import { longDate, useSite, type SiteProgram } from '../../lib/site';
import { eventDate, useArticles, ValueGrid } from './Home';
import { Cover, FounderPortrait, PageHero, RegisterLink, SiteShell, telOf, useSiteData } from './Shell';

export function About() {
  const FOUNDRY = useSite('foundry');
  const VISION = useSite('vision');
  const MISSION = useSite('mission');
  const PILLARS = useSite('pillars');
  const VALUES = useSite('values');
  const FOUNDER = useSite('founder');
  const TAGLINES = useSite('taglines');
  return (
    <SiteShell title="About">
      <PageHero eyebrow={FOUNDRY.eyebrow} title={FOUNDRY.title}>
        <p>{FOUNDRY.lead}</p>
      </PageHero>

      <section className="section">
        <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <article className="card">
            <p className="eyebrow">Our vision</p>
            <h2>{VISION.title}</h2>
            <p style={{ margin: 0 }}>{VISION.text}</p>
          </article>
          <article className="card">
            <p className="eyebrow">Our mission</p>
            <h2>{MISSION.title}</h2>
            <p style={{ margin: 0 }}>{MISSION.text}</p>
          </article>
        </div>
      </section>

      <section className="section band-blush">
        <div className="section-inner" style={{ maxWidth: 900 }}>
          <p className="eyebrow">The foundation</p>
          <h2>The Five Pillars</h2>
          <p className="muted">The pillars that form the foundation of every royal daughter.</p>
          {PILLARS.map((p, i) => (
            <div key={i} className="pillar">
              <b>{p.n || String(i + 1).padStart(2, '0')}</b>
              <div>
                <h3 style={{ marginBottom: 2 }}>{p.name}</h3>
                <div className="sub">{p.sub}</div>
                <p style={{ margin: 0 }}>{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section band-plum">
        <div className="section-inner">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            The G.I.R.L.S. values
          </p>
          <h2>The essence of who she becomes</h2>
          <ValueGrid values={VALUES} />
        </div>
      </section>

      <section className="section">
        <div className="section-inner founder-v2">
          <FounderPortrait />
          <div>
            <p className="eyebrow">Meet the founder</p>
            <h2>{FOUNDER.name}</h2>
            <p className="muted" style={{ fontWeight: 600 }}>
              {FOUNDER.title}
              {FOUNDER.title && FOUNDER.credentials && <br />}
              {FOUNDER.credentials}
            </p>
            {FOUNDER.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {FOUNDER.quote && <blockquote>“{FOUNDER.quote}”</blockquote>}
            <p className="serif" style={{ marginTop: 24, color: 'var(--maroon)' }}>
              {TAGLINES.signature}
            </p>
            <Link to="/enrol" className="btn btn-primary">
              Join the Inner Court
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ProgramCard({ p }: { p: SiteProgram }) {
  const price = priceFor(p);
  const cta =
    p.slug === 'inner-court'
      ? { to: '/programs/inner-court', label: 'See the syllabus & enrol' }
      : { to: `/contact?topic=${p.slug}&subject=${encodeURIComponent(p.name)}`, label: p.slug === 'hershift' ? 'Join the waitlist' : p.slug === 'counselling' ? 'Book a session' : p.slug === 'royal-table' ? 'Book a table' : 'Enquire' };
  return (
    <article className={`card program-card${p.slug === 'inner-court' ? ' featured' : ''}`} id={p.slug}>
      <Cover url={p.cover_url} />
      <div className="spread">
        <span className={`status ${p.is_open ? 'status-complete' : 'status-attention'}`}>{p.is_open ? p.duration_label : 'Waitlist open'}</span>
        <span className="muted">{p.audience}</span>
      </div>
      <h3>{p.name}</h3>
      <p style={{ margin: 0 }}>{p.summary}</p>
      {price != null && (
        <div>
          <div className="price">{ghs(price)}</div>
          {p.pro_rata && (
            <div className="muted">
              {monthsLeft(p.cohort_end)} months left in this cohort · {ghs(p.price_pesewas)} for a full year
            </div>
          )}
        </div>
      )}
      {p.inclusions.length > 0 && (
        <ul>
          {p.inclusions.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      <Link to={cta.to} className={`btn ${p.slug === 'inner-court' ? 'btn-primary' : 'btn-secondary'}`}>
        {cta.label}
      </Link>
    </article>
  );
}

export function Programs() {
  const data = useSiteData();
  const INNER_COURT = useSite('inner_court');
  const P = useSite('pages');
  return (
    <SiteShell title="Programs">
      <PageHero eyebrow={INNER_COURT.eyebrow} title={P.programsTitle}>
        <p>{P.programsText}</p>
      </PageHero>
      <section className="section">
        <div className="section-inner">
          <div className="card card-maroon" style={{ padding: 32 }}>
            <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
              The Inner Court · {INNER_COURT.cohort}
            </p>
            <h2 style={{ color: '#fff' }}>{INNER_COURT.title}</h2>
            <p style={{ color: '#f5dbe5', maxWidth: 720 }}>{INNER_COURT.summons}</p>
            {INNER_COURT.quote && (
              <p className="serif" style={{ color: 'var(--gold)', fontSize: '1.25rem' }}>
                “{INNER_COURT.quote}”
              </p>
            )}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 16 }}>
              {INNER_COURT.focus.map((f, i) => (
                <div key={i}>
                  <strong style={{ color: '#fff' }}>{f.name}</strong>
                  <div style={{ color: '#f1d4de' }}>{f.text}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#f1d4de', marginTop: 20, marginBottom: 0 }}>
              {[INNER_COURT.ages, INNER_COURT.proRataNote].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="program-grid">{data?.programs.map((p) => <ProgramCard key={p.slug} p={p} />)}</div>
        </div>
      </section>
    </SiteShell>
  );
}

export function Events() {
  const data = useSiteData();
  const P = useSite('pages');
  const now = Date.now();
  const upcoming = (data?.events ?? []).filter((e) => !e.starts_at || new Date(e.starts_at).getTime() > now);
  const past = (data?.events ?? []).filter((e) => e.starts_at && new Date(e.starts_at).getTime() <= now);
  const program = (slug: string | null) => data?.programs.find((p) => p.slug === slug);
  return (
    <SiteShell title="Events">
      <PageHero eyebrow={P.eventsEyebrow} title={P.eventsTitle}>
        <p>{P.eventsText}</p>
      </PageHero>
      <section className="section">
        <div className="section-inner stack" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {upcoming.length === 0 && data && <p className="muted">New dates are coming soon.</p>}
          {upcoming.map((e) => {
            const p = program(e.program_slug);
            return (
              <article key={e.id} className={`card event-card${e.cover_url ? ' has-cover' : ''}`}>
                <Cover url={e.cover_url} className="event-cover" />
                <div className="event-card-body">
                  <div>
                    <p className="eyebrow">Upcoming</p>
                    <h2 style={{ marginBottom: 4 }}>{e.title}</h2>
                    <p className="serif" style={{ fontSize: '1.2rem', color: 'var(--pink)' }}>
                      {e.tagline}
                    </p>
                    <p>{e.description}</p>
                  </div>
                  <div className="card" style={{ background: 'var(--surface-2)' }}>
                    <p className="eyebrow">Event logistics</p>
                    <p style={{ margin: '0 0 6px' }}>
                      <strong>When:</strong> {eventDate(e)}
                    </p>
                    {e.venue && (
                      <p style={{ margin: '0 0 6px' }}>
                        <strong>Where:</strong> {e.venue}
                      </p>
                    )}
                    {p && p.inclusions.length > 0 && (
                      <ul style={{ paddingLeft: 20 }}>
                        {p.inclusions.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    )}
                    <RegisterLink event={e} className="btn btn-primary btn-block" />
                  </div>
                </div>
              </article>
            );
          })}
          {data?.programs
            .filter((p) => p.slug === 'summits')
            .map((p) => <ProgramCard key={p.slug} p={p} />)}
          {past.length > 0 && (
            <div>
              <h3 style={{ marginTop: 20 }}>Recent</h3>
              {past.map((e) => (
                <div key={e.id} className="contact-row">
                  <div className="ico">
                    <Icon name="check" />
                  </div>
                  <div>
                    <strong>{e.title}</strong> — {e.tagline}
                    <div className="muted">
                      {eventDate(e)}
                      {e.venue ? ` · ${e.venue}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}

export function Journal() {
  const P = useSite('pages');
  const { list, error } = useArticles();
  return (
    <SiteShell title="Journal">
      <PageHero eyebrow={P.journalEyebrow} title={P.journalTitle}>
        <p>{P.journalText}</p>
      </PageHero>
      <section className="section">
        <div className="section-inner">
          {!list && !error && <Loading lines={4} />}
          {error && <p className="muted">The journal could not be loaded just now. Please try again in a moment.</p>}
          {list && list.length === 0 && <p className="muted">New articles are on their way.</p>}
          <div className="blog-grid">
            {list?.map((b) => (
              <Link key={b.id} to={`/journal/${b.slug}`} className="card blog-card">
                {b.cover_url ? (
                  <Cover url={b.cover_url} className="blog-cover-img" />
                ) : (
                  <div className="cover" aria-hidden="true">
                    <span className="serif" style={{ fontSize: '2.4rem', color: 'var(--maroon)' }}>
                      {b.title[0]}
                    </span>
                  </div>
                )}
                <div className="spread">
                  <span className="eyebrow" style={{ margin: 0 }}>
                    {b.tag}
                  </span>
                  <span className="muted small">{longDate(b.published_at ?? b.created_at)}</span>
                </div>
                <h3>{b.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {b.excerpt}
                </p>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

const TOPIC_LABEL: Record<string, string> = {
  enquiry: 'General enquiry',
  'inner-court': 'The Inner Court',
  counselling: 'One-on-one counselling',
  summits: 'Summits',
  'royal-table': 'The Royal Table',
  'crown-council': 'The Crown Council',
  hershift: 'HerShift waitlist',
};

export function Contact() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    topic: TOPIC_LABEL[params.get('topic') ?? ''] ? params.get('topic')! : 'enquiry',
    subject: params.get('subject') ?? '',
    message: '',
    website: '',
  });
  const CONTACT = useSite('contact');
  const P = useSite('pages');
  const ig = safeHref(CONTACT.instagram.url);
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | string>('idle');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = (await res.json()) as { error?: string };
      setState(res.ok ? 'sent' : j.error ?? 'Could not send');
    } catch {
      setState('Could not reach us — please call instead.');
    }
  }

  return (
    <SiteShell title="Contact">
      <PageHero eyebrow={P.contactEyebrow} title={P.contactTitle}>
        <p>{P.contactText}</p>
      </PageHero>
      <section className="section">
        <div className="section-inner contact-grid">
          <div>
            <div className="contact-row">
              <div className="ico">
                <Icon name="home" />
              </div>
              <div>
                <strong>Our location</strong>
                <div className="muted">{CONTACT.location}</div>
              </div>
            </div>
            <div className="contact-row">
              <div className="ico">
                <Icon name="bell" />
              </div>
              <div>
                <strong>Phone</strong>
                {CONTACT.phones.map((p, i) => (
                  <div key={i}>
                    <a href={`tel:${telOf(p)}`}>{p.label}</a>
                  </div>
                ))}
              </div>
            </div>
            <div className="contact-row">
              <div className="ico">
                <Icon name="file" />
              </div>
              <div>
                <strong>Email</strong>
                <div>
                  <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                </div>
              </div>
            </div>
            <div className="contact-row" style={{ borderBottom: 0 }}>
              <div className="ico">
                <Icon name="users" />
              </div>
              <div>
                <strong>Instagram</strong>
                <div>
                  {ig ? (
                    <a href={ig} target="_blank" rel="noreferrer">
                      {CONTACT.instagram.handle}
                    </a>
                  ) : (
                    CONTACT.instagram.handle
                  )}
                </div>
              </div>
            </div>
          </div>

          {state === 'sent' ? (
            <div className="card card-soft">
              <h2>Thank you, {form.name.split(' ')[0]}.</h2>
              <p style={{ margin: 0 }}>Your message is with the Academy. We’ll reply to {form.email} soon.</p>
            </div>
          ) : (
            <form className="card stack" onSubmit={submit}>
              <h2 style={{ marginBottom: 0 }}>Send us a message</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label className="field">
                  <span>Your name</span>
                  <input type="text" required autoComplete="name" value={form.name} onChange={set('name')} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
                </label>
                <label className="field">
                  <span>Phone (optional)</span>
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
                </label>
                <label className="field">
                  <span>About</span>
                  <select value={form.topic} onChange={set('topic')}>
                    {Object.entries(TOPIC_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Subject</span>
                <input type="text" value={form.subject} onChange={set('subject')} />
              </label>
              <label className="field">
                <span>Message</span>
                <textarea required value={form.message} onChange={set('message')} style={{ minHeight: 140 }} />
              </label>
              <label className="hp" aria-hidden="true">
                Website
                <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </label>
              {state !== 'idle' && state !== 'busy' && <p className="error">{state}</p>}
              <button className="btn btn-primary" disabled={state === 'busy'}>
                {state === 'busy' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
