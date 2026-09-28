import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Crown } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { ghs } from '../lib/format';
import { sb } from '../lib/supabase';
import type { Program } from '../lib/types';

const VALUES = [
  ['G', 'Grace', 'Carrying herself well'],
  ['I', 'Integrity', 'Who she is unwatched'],
  ['R', 'Resilience', 'Getting back up'],
  ['L', 'Leadership', 'Going first'],
  ['S', 'Spirituality', 'Rooted in who God says she is'],
] as const;

export function SiteNav() {
  const { profile } = useAuth();
  return (
    <header className="site-nav">
      <Link to="/" className="brandmark">
        <Crown size={30} /> Grit &amp; Grace Girls Academy
      </Link>
      <nav aria-label="Main">
        <a href="/#programs">Programs</a>
        <a href="/#story">Our story</a>
        <a href="/#parents">For parents</a>
        {profile ? (
          <Link className="btn btn-on-dark" to={homeFor(profile)}>
            My account
          </Link>
        ) : (
          <Link className="btn btn-on-dark" to="/login">
            Member login
          </Link>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="section-inner spread">
        <div className="row">
          <Crown size={26} />
          <strong className="serif" style={{ color: '#fff' }}>
            Grit &amp; Grace Girls Academy
          </strong>
        </div>
        <p style={{ margin: 0 }}>
          Accra, Ghana · <a href="tel:+233548531412">+233 54 853 1412</a> ·{' '}
          <a href="mailto:grace@gritgracegirlsacademy.com">grace@gritgracegirlsacademy.com</a>
        </p>
        <nav className="row" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/safeguarding">Child Safeguarding Policy</Link>
          <Link to="/verify">Verify a certificate</Link>
        </nav>
      </div>
    </footer>
  );
}

function Waitlist() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program: 'hershift', email }) });
      const j = (await res.json()) as { error?: string };
      setState(res.ok ? 'done' : j.error ?? 'Could not join the waitlist');
    } catch {
      setState('Could not reach the server — try again');
    }
  }
  if (state === 'done') return <p className="notice">You are on the list. We will email you first when the next cohort opens.</p>;
  return (
    <form onSubmit={submit} className="stack">
      <label className="field">
        <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Your email</span>
        <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {state !== 'idle' && state !== 'busy' && <p className="error">{state}</p>}
      <button className="btn btn-secondary btn-block" disabled={state === 'busy'}>
        Join the waitlist
      </button>
    </form>
  );
}

export default function Landing() {
  const [programs, setPrograms] = useState<Record<string, Program>>({});
  useEffect(() => {
    sb()
      .from('programs')
      .select('*')
      .then(({ data }) => setPrograms(Object.fromEntries(((data as Program[]) ?? []).map((p) => [p.slug, p]))));
  }, []);
  const inner = programs['inner-court'];
  const table = programs['royal-table'];

  return (
    <>
      <SiteNav />
      <section className="hero">
        <div className="hero-inner">
          <div>
            <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
              The first identity foundry for African girls
            </p>
            <h1>
              We don&rsquo;t just raise girls.
              <br />
              We raise <em>Queens.</em>
            </h1>
            <p className="lead">
              Faith-based mentoring for preteen and teenage girls — intellectually sharp, emotionally grounded, spiritually wise, socially confident.
            </p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link to="/enrol" className="btn btn-on-dark" style={{ minHeight: 52, padding: '0 28px' }}>
                Secure her crown
              </Link>
              <a href="#programs" className="btn btn-secondary btn-pill" style={{ color: '#fff' }}>
                See the programs
              </a>
            </div>
          </div>
          <figure className="founder" style={{ margin: 0 }}>
            <div className="portrait">[FOUNDER PORTRAIT]</div>
            <figcaption>
              <strong className="serif" style={{ fontSize: '1.2rem' }}>
                Grace Abibath Nikoi
              </strong>
              <div className="eyebrow" style={{ color: 'var(--gold)' }}>
                The Exceptional Teen Mentor
              </div>
            </figcaption>
          </figure>
        </div>
        <div className="facts">
          <div>
            <b>[N]</b>Queens mentored
          </div>
          <div>
            <b>12</b>Month journey
          </div>
          <div>
            <b>5</b>Core values — G.I.R.L.S.
          </div>
          <div>
            <b>Accra</b>Ghana, and online
          </div>
        </div>
      </section>

      <section className="section" id="programs">
        <div className="section-inner">
          <p className="eyebrow">Programs</p>
          <h2>Where she becomes who she is</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            There is a gap between what school teaches and what home provides. We fill it with wisdom, values and life skills.
          </p>
          <div className="programs">
            <article className="card program" style={{ borderColor: 'var(--maroon)', borderWidth: 2 }}>
              <div className="spread">
                <span className="status status-progress">Flagship</span>
                <span className="muted">12 months</span>
              </div>
              <h3>The Inner Court</h3>
              <p>
                A year-long transformational mentoring journey through Gracefulness, Integrity, Resilience, Leadership and Spirituality. Monthly modules, live sessions, and a Circle of her own.
              </p>
              <div>
                <div className="price">{ghs(inner?.price_pesewas)}</div>
                <div className="muted">
                  or {inner?.instalments ?? '[N]'} monthly payments
                </div>
              </div>
              <Link to="/enrol" className="btn btn-primary">
                Enrol her
              </Link>
            </article>
            <article className="card program">
              <span className="status status-attention">Waitlist open</span>
              <h3>HerShift</h3>
              <p>A shorter, intensive shift for girls at a turning point. Join the waitlist and be first to hear when the next cohort opens.</p>
              <Waitlist />
            </article>
            <article className="card program">
              <div className="spread">
                <span className="status status-complete">Event</span>
                <span className="muted">One evening</span>
              </div>
              <h3>The Royal Table</h3>
              <p>A father–daughter evening. One ticket covers them both — dinner, a keynote, and a conversation most families never quite get to.</p>
              <div>
                <div className="price">{ghs(table?.price_pesewas)}</div>
                <div className="muted">father + daughter</div>
              </div>
              <a className="btn btn-secondary" href="mailto:grace@gritgracegirlsacademy.com?subject=The%20Royal%20Table%20—%20reserve%20seats">
                Reserve seats
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="section band" id="story">
        <div className="section-inner">
          <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
            Smart is not the same as wise
          </p>
          <h2>You can raise brilliant girls who are still naïve</h2>
          <p style={{ maxWidth: 720 }}>
            Social pressure, digital exposure, emotional swings — our girls are navigating more than we see. In a world where everything is accessible, discernment is not optional. It is a survival skill.
          </p>
          <p style={{ maxWidth: 720, color: '#fff', fontWeight: 600 }}>We guide girls to ask the right questions, filter wisely, and choose boldly.</p>
          <div className="values">
            {VALUES.map(([letter, name, line]) => (
              <div className="value" key={name}>
                <b>{letter}</b>
                <strong style={{ color: 'var(--text)' }}>{name}</strong>
                <div className="muted">{line}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="parents">
        <div className="section-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'center' }}>
          <div>
            <p className="eyebrow">For parents</p>
            <h2>Watch her grow, week by week</h2>
            <p>
              Her progress, her attendance, her certificates, and a measured before-and-after across all five values — in your own parent portal. Not a mystery. Not a WhatsApp group.
            </p>
            <Link to="/gate" className="btn btn-primary">
              See the parent view
            </Link>
          </div>
          <div className="card">
            <p className="eyebrow">Your weekly digest</p>
            <p className="serif" style={{ fontSize: '1.25rem' }}>
              This week Ama completed 2 lessons, attended the live session, and earned her Integrity badge.
            </p>
            <div className="stack">
              {[
                ['Gracefulness', 62],
                ['Integrity', 71],
                ['Resilience', 68],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="spread">
                    <span>{k}</span>
                    <span className="muted">+{Math.round(Number(v) / 3)}</span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 12 }}>
              Her journal and her messages with her mentor stay private — you see that they exist, not what she wrote.
            </p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
