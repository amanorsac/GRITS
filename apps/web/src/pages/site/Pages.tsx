import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../../components/ui';
import { BLOG, CONTACT, FOUNDER, FOUNDRY, INNER_COURT, MISSION, PILLARS, TAGLINES, VALUES, VISION } from '../../content/academy';
import { ghs, monthsLeft, priceFor } from '../../lib/format';
import type { Program } from '../../lib/types';
import { eventDate } from './Home';
import { PageHero, SiteShell, useSiteData } from './Shell';

export function About() {
  return (
    <SiteShell>
      <PageHero eyebrow="Who we are" title={FOUNDRY.title}>
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
          {PILLARS.map((p) => (
            <div key={p.name} className="pillar">
              <b>{p.n}</b>
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

      <section className="section">
        <div className="section-inner founder-v2">
          <div className="portrait">[FOUNDER PORTRAIT]</div>
          <div>
            <p className="eyebrow">Meet the founder</p>
            <h2>{FOUNDER.name}</h2>
            <p className="muted" style={{ fontWeight: 600 }}>
              {FOUNDER.title}
              <br />
              {FOUNDER.credentials}
            </p>
            {FOUNDER.bio.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <blockquote>“{FOUNDER.quote}”</blockquote>
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

function ProgramCard({ p }: { p: Program }) {
  const price = priceFor(p);
  const cta =
    p.slug === 'inner-court'
      ? { to: '/programs/inner-court', label: 'See the syllabus & enrol' }
      : { to: `/contact?topic=${p.slug}&subject=${encodeURIComponent(p.name)}`, label: p.slug === 'hershift' ? 'Join the waitlist' : p.slug === 'counselling' ? 'Book a session' : p.slug === 'royal-table' ? 'Book a table' : 'Enquire' };
  return (
    <article className={`card program-card${p.slug === 'inner-court' ? ' featured' : ''}`} id={p.slug}>
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
  return (
    <SiteShell>
      <PageHero eyebrow={INNER_COURT.eyebrow} title="Programs & services">
        <p>From a year-long journey for girls to a rite of passage for women — every program is built on the Five Pillars and the G.I.R.L.S. values.</p>
      </PageHero>
      <section className="section">
        <div className="section-inner">
          <div className="card card-maroon" style={{ padding: 32 }}>
            <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
              The Inner Court · {INNER_COURT.cohort}
            </p>
            <h2 style={{ color: '#fff' }}>{INNER_COURT.title}</h2>
            <p style={{ color: '#f5dbe5', maxWidth: 720 }}>{INNER_COURT.summons}</p>
            <p className="serif" style={{ color: 'var(--gold)', fontSize: '1.25rem' }}>
              “{INNER_COURT.quote}”
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 16 }}>
              {INNER_COURT.focus.map((f) => (
                <div key={f.name}>
                  <strong style={{ color: '#fff' }}>{f.name}</strong>
                  <div style={{ color: '#f1d4de' }}>{f.text}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#f1d4de', marginTop: 20, marginBottom: 0 }}>
              {INNER_COURT.ages} · {INNER_COURT.proRataNote}
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
  const now = Date.now();
  const upcoming = (data?.events ?? []).filter((e) => !e.starts_at || new Date(e.starts_at).getTime() > now);
  const past = (data?.events ?? []).filter((e) => e.starts_at && new Date(e.starts_at).getTime() <= now);
  const program = (slug: string | null) => data?.programs.find((p) => p.slug === slug);
  return (
    <SiteShell>
      <PageHero eyebrow="Grit & Grace Academy presents" title="Events">
        <p>Summits three times a year, the father–daughter Royal Table, and the Crown Council for everyone raising Ghana’s daughters.</p>
      </PageHero>
      <section className="section">
        <div className="section-inner stack" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {upcoming.length === 0 && data && <p className="muted">New dates are coming soon.</p>}
          {upcoming.map((e) => {
            const p = program(e.program_slug);
            return (
              <article key={e.id} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
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
                  <Link to={`/contact?topic=${e.program_slug ?? 'enquiry'}&subject=${encodeURIComponent(e.title)}`} className="btn btn-primary btn-block">
                    Register interest
                  </Link>
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
                      {eventDate(e)} · {e.venue}
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
  return (
    <SiteShell>
      <PageHero eyebrow="Stories & insights" title="Wisdom for raising Queens">
        <p>Practical articles on mentoring, parenting, faith, and empowering the next generation of purpose-driven girls.</p>
      </PageHero>
      <section className="section">
        <div className="section-inner">
          <div className="blog-grid">
            {BLOG.map((b) => (
              <a key={b.title} href={`${CONTACT.legacySite}/blog`} target="_blank" rel="noreferrer" className="card blog-card">
                <div className="cover" aria-hidden="true">
                  <span className="serif" style={{ fontSize: '2.4rem', color: 'var(--maroon)' }}>
                    {b.title[0]}
                  </span>
                </div>
                <div className="spread">
                  <span className="eyebrow" style={{ margin: 0 }}>
                    {b.tag}
                  </span>
                  <span className="muted small">{new Date(b.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <h3>{b.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {b.excerpt}
                </p>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Read more →</span>
              </a>
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
    <SiteShell>
      <PageHero eyebrow="Get in touch" title="We’d love to hear from you">
        <p>Questions about our mentoring programs, upcoming summits, counselling, or how you can support the Academy — our team is ready to connect.</p>
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
                {CONTACT.phones.map((p) => (
                  <div key={p.tel}>
                    <a href={`tel:${p.tel}`}>{p.label}</a>
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
                  <a href={CONTACT.instagram.url} target="_blank" rel="noreferrer">
                    {CONTACT.instagram.handle}
                  </a>
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
