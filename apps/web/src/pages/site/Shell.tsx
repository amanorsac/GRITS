import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Crown, Icon } from '../../components/ui';
import { homeFor, useAuth } from '../../lib/auth';
import { safeHref } from '../../lib/media';
import { useSite, type SiteEvent, type SiteProgram } from '../../lib/site';
import { sb } from '../../lib/supabase';

const NAV = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/programs', 'Programs'],
  ['/events', 'Events'],
  ['/journal', 'Journal'],
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
] as const;

/** An optional one-line notice above the header, switched on in The Palace. */
export function AnnouncementBar() {
  const a = useSite('announcement_bar');
  if (!a.enabled || !a.text.trim()) return null;
  const href = safeHref(a.link);
  const label = a.linkLabel.trim() || 'Find out more';
  return (
    <div className="announcement" role="region" aria-label="Announcement">
      <span>{a.text}</span>
      {href &&
        (href.startsWith('/') ? (
          <Link to={href}>{label} →</Link>
        ) : (
          <a href={href} target="_blank" rel="noreferrer">
            {label} →
          </a>
        ))}
    </div>
  );
}

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
  const TAGLINES = useSite('taglines');
  const CONTACT = useSite('contact');
  const ig = safeHref(CONTACT.instagram.url);
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
          <Link to="/gallery">Gallery</Link>
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
          {CONTACT.email && <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
          {CONTACT.phones.map((p, i) => (
            <a key={i} href={`tel:${telOf(p)}`}>
              {p.label}
            </a>
          ))}
          {ig && (
            <a href={ig} target="_blank" rel="noreferrer">
              Instagram {CONTACT.instagram.handle}
            </a>
          )}
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

/** A phone's dialable number: the saved one, or the digits of its label. */
export function telOf(p: { label: string; tel: string }) {
  return (p.tel || p.label).replace(/[^\d+]/g, '');
}

export function SiteShell({ children, title }: { children: ReactNode; title?: string }) {
  const { pathname } = useLocation();
  const seo = useSite('seo');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    document.title = title ? `${title} · Grit & Grace Girls Academy` : seo.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
  }, [title, seo.title, seo.description]);
  return (
    <>
      <a href="#content" className="skip">
        Skip to content
      </a>
      <AnnouncementBar />
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
let cache: Promise<{ programs: SiteProgram[]; events: SiteEvent[] }> | null = null;
export function loadSiteData() {
  cache ??= Promise.all([
    sb().from('programs').select('*').order('position'),
    // Admins can read drafts through RLS, so ask for published events explicitly.
    sb().from('events').select('*').eq('is_published', true).order('starts_at', { ascending: true, nullsFirst: false }),
  ]).then(([p, e]) => ({ programs: (p.data ?? []) as SiteProgram[], events: (e.data ?? []) as SiteEvent[] }));
  return cache;
}

/** The Palace calls this after editing programs or events so the site shows the change. */
export function invalidateSiteData() {
  cache = null;
}

export function useSiteData() {
  const [data, setData] = useState<{ programs: SiteProgram[]; events: SiteEvent[] } | null>(null);
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
export function nextEvent(events: SiteEvent[]) {
  const now = Date.now();
  return (
    events.find((e) => e.starts_at && new Date(e.starts_at).getTime() > now) ??
    events.find((e) => !e.starts_at && e.date_label) ??
    null
  );
}

/** "Register interest" goes to the event's own registration page when it has one, else our contact form. */
export function RegisterLink({ event, className, children }: { event: SiteEvent; className: string; children?: ReactNode }) {
  const href = safeHref(event.register_url);
  const label = children ?? (href ? 'Register now' : 'Register interest');
  if (href && !href.startsWith('/'))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    );
  return (
    <Link to={href ?? `/contact?topic=${event.program_slug ?? 'enquiry'}&subject=${encodeURIComponent(event.title)}`} className={className}>
      {label}
    </Link>
  );
}

/** A card's cover photo when one has been set in The Palace. Decorative: the card's heading names it. */
export function Cover({ url, className = 'card-cover' }: { url: string | null | undefined; className?: string }) {
  if (!url) return null;
  return <img className={className} src={url} alt="" loading="lazy" decoding="async" />;
}

export function FounderPortrait() {
  const f = useSite('founder');
  if (f.portrait)
    return (
      <div className="portrait has-image">
        <img src={f.portrait} alt={f.portraitAlt || f.name} loading="lazy" decoding="async" />
      </div>
    );
  return (
    <div className="portrait" aria-hidden="true">
      <Crown size={56} />
    </div>
  );
}
