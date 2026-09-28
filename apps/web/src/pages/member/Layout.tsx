import { Link, NavLink, Outlet } from 'react-router';
import { Crown, Icon } from '../../components/ui';
import { isStaff, useAuth } from '../../lib/auth';
import { initials } from '../../lib/format';

const NAV = [
  ['/app', 'home', 'Home', true],
  ['/app/academy', 'book', 'The Academy', false],
  ['/app/court', 'court', 'The Court', false],
  ['/app/live', 'live', 'The Throne Room', false],
  ['/app/journal', 'journal', 'My Journal', false],
] as const;

export default function MemberLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Member">
        <Link to="/app" className="brand">
          <Crown size={28} /> Grit &amp; Grace
        </Link>
        {NAV.map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
            <Icon name={icon} /> <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/app/help" className={({ isActive }) => `nav extra${isActive ? ' active' : ''}`}>
          <Icon name="help" /> <span>Talk to someone</span>
        </NavLink>
        {isStaff(profile) && (
          <Link to="/palace" className="nav extra">
            <Icon name="shield" /> <span>The Palace</span>
          </Link>
        )}
        <div className="foot">
          <div className="avatar">{initials(profile?.display_name || profile?.full_name || '')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{profile?.display_name}</div>
            <div style={{ fontSize: '.85rem', color: '#e8bccb' }}>Crown Level {profile?.crown_level ?? 1}</div>
          </div>
          <button className="nav" style={{ width: 44, padding: 0, justifyContent: 'center' }} onClick={signOut} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </div>
      </nav>
      <div>
        <div className="topbar">
          <Link to="/app" className="row" style={{ textDecoration: 'none' }}>
            <Crown size={24} /> <strong className="serif">Grit &amp; Grace</strong>
          </Link>
          <div className="row">
            <Link to="/app/help">Talk to someone</Link>
            <button className="linkish" style={{ color: '#fff' }} onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
