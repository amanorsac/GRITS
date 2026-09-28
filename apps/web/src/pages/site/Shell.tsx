import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Crown, Icon } from '../../components/ui';
import { CONTACT, TAGLINES } from '../../content/academy';
import { homeFor, useAuth } from '../../lib/auth';
import { sb } from '../../lib/supabase';
import type { AcademyEvent, Program } from '../../lib/types';

const NAV = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/programs', 'Programs'],
  ['/events', 'Events'],
  ['/journal', 'Journal'],
  ['/contact', 'Contact'],
] as const;

export function SiteHeader() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const links = NAV.map(([to, label]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : undefined)}>
      {label}
    </NavLink>
  ));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brandmark" aria-label="Grit & Grace Girls Academy — home">
          <Crown size={30} />
          <span>Grit &amp; Grace</span>
        </Link>
        <nav className="pillnav" aria-label="Main">
          {links}
        </nav>
        {profile ? (
          <Link className="login-link" to={homeFor(profile)}>
            My account
          </Link>
        ) : (
          <Link className="login-link" to="/login">
            Member login
          </Link>
        )}
        <Link to="/enrol" className="btn btn-on-dark cta-desktop">
          Secure her crown
        </Link>
        <button className="menu-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      <nav id="mobile-menu" className="mobile-menu" hidden={!open} aria-label="Main">
        {links}
        <Link to={profile ? homeFor(profile) : '/login'}>{profile ? 'My account' : 'Member login'}</Link>
        <Link to="/enrol" className="btn btn-on-dark" style={{ marginTop: 8 }}>
          Secure her crown
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer-v2">
      <div className="cols">
        <div>
          <Link to="/" className="brandmark" style={{ marginBottom: 12 }}>
            <Crown size={28} /> Grit &amp; Grace Girls Academy
          </Link>
          <p style={{ maxWidth: 320 }}>{TAGLINES.signature}</p>
          <p className="serif" style={{ color: 'var(--gold)', margin: 0 }}>
            {TAGLINES.motto}
          </p>
        </div>
        <div>
          <h4>Academy</h4>
          <Link to="/about">Our story</Link>
          <Link to="/programs">Programs</Link>
          <Link to="/events">Events</Link>
          <Link to="/journal">Journal</Link>
        </div>
        <div>
          <h4>Families</h4>
          <Link to="/enrol">Enrol your daughter</Link>
          <Link to="/login">Member login</Link>
          <Link to="/gate">Parent portal</Link>
          <Link to="/verify">Verify a certificate</Link>
        </div>
        <div>
          <h4>Contact</h4>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          {CONTACT.phones.map((p) => (
            <a key={p.tel} href={`tel:${p.tel}`}>
              {p.label}
            </a>
          ))}
          <a href={CONTACT.instagram.url} target="_blank" rel="noreferrer">
            Instagram {CONTACT.instagram.handle}
          </a>
          <span style={{ display: 'block', paddingTop: 6 }}>{CONTACT.location}</span>
        </div>
      </div>
      <div className="legal">
        <span>© {new Date().getFullYear()} Grit &amp; Grace Girls Academy</span>
        <span className="row" style={{ gap: 18 }}>
          <Link to="/privacy" style={{ display: 'inline' }}>
            Privacy
          </Link>
          <Link to="/terms" style={{ display: 'inline' }}>
            Terms
          </Link>
          <Link to="/safeguarding" style={{ display: 'inline' }}>
            Child Safeguarding Policy
          </Link>
        </span>
      </div>
    </footer>
  );
}

/** The Academy site had a floating "leave a message" widget; ours opens our own contact page. */
export function TalkToUs() {
  const { pathname } = useLocation();
  if (pathname === '/contact') return null;
  return (
    <Link to="/contact" className="fab" aria-label="Talk to us">
      <Icon name="court" size={22} />
      <span>Talk to us</span>
    </Link>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a href="#content" className="skip">
        Skip to content
      </a>
      <SiteHeader />
      <main id="content">{children}</main>
      <SiteFooter />
      <TalkToUs />
    </>
  );
}

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <div className="page-hero-inner">
        <p className="eyebrow eyebrow-line">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

/** Programs and events are public (RLS allows anon read), cached for the session. */
let cache: Promise<{ programs: Program[]; events: AcademyEvent[] }> | null = null;
export function loadSiteData() {
  cache ??= Promise.all([
    sb().from('programs').select('*').order('position'),
    sb().from('events').select('*').order('starts_at', { ascending: true, nullsFirst: false }),
  ]).then(([p, e]) => ({ programs: (p.data ?? []) as Program[], events: (e.data ?? []) as AcademyEvent[] }));
  return cache;
}

export function useSiteData() {
  const [data, setData] = useState<{ programs: Program[]; events: AcademyEvent[] } | null>(null);
  useEffect(() => {
    let alive = true;
    loadSiteData().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

/** The next event with a date in the future, else one that is announced without a date. */
export function nextEvent(events: AcademyEvent[]) {
  const now = Date.now();
  return (
    events.find((e) => e.starts_at && new Date(e.starts_at).getTime() > now) ??
    events.find((e) => !e.starts_at && e.date_label) ??
    null
  );
}
