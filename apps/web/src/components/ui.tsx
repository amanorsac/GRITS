import type { ReactNode, SVGProps } from 'react';
import { Navigate, useLocation } from 'react-router';
import { homeFor, useAuth } from '../lib/auth';
import type { Role } from '../lib/types';

export function Crown({ size = 28, color = 'var(--gold)', ...rest }: { size?: number; color?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 40 32" aria-hidden="true" {...rest}>
      <path d="M4 26 1 8l10 7 9-13 9 13 10-7-3 18z" fill={color} />
      <rect x="4" y="27.5" width="32" height="4" rx="1.5" fill={color} />
      <circle cx="1.5" cy="7" r="2.5" fill="var(--pink-bright)" />
      <circle cx="20" cy="2.5" r="2.5" fill="var(--pink-bright)" />
      <circle cx="38.5" cy="7" r="2.5" fill="var(--pink-bright)" />
    </svg>
  );
}

const PATHS: Record<string, string> = {
  home: 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  book: 'M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h6z',
  court: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',
  live: 'M3 7h13v10H3zM16 10l5-3v10l-5-3',
  journal: 'M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2L6 8.2 4 8 3 11l2 1v1.8l-2 1 1 3 2-.2 1.3 1.3-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.3-1.3 2 .2 1-3-2-1z',
  logout: 'M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 1 1 8 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  play: 'M7 4v16l13-8z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  back: 'M15 5l-7 7 7 7',
  gate: 'M4 21V9l8-6 8 6v12M9 21v-6h6v6',
  megaphone: 'M3 10v4h4l7 5V5L7 10zM18 8a5 5 0 0 1 0 8',
};

export function Icon({ name, size = 22, ...rest }: { name: keyof typeof PATHS | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name] ?? PATHS.grid} />
    </svg>
  );
}

// Four reactions, all positive. There is no downvote anywhere.
export const REACTIONS = [
  { kind: 'crown', label: 'Crown' },
  { kind: 'heart', label: 'Heart' },
  { kind: 'praying', label: 'Praying' },
  { kind: 'amen', label: 'Amen' },
] as const;

export function ReactionGlyph({ kind }: { kind: string }) {
  if (kind === 'crown') return <Crown size={18} />;
  if (kind === 'heart') return <Icon name="heart" size={18} style={{ color: 'var(--pink)' }} />;
  if (kind === 'praying')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3v9l-4 5v4M12 3v9l4 5v4M8 8l-3 6 3 3M16 8l3 6-3 3" />
      </svg>
    );
  return <span className="serif" style={{ fontWeight: 700, color: 'var(--gold)' }} aria-hidden="true">A</span>;
}

type StatusKind = 'complete' | 'progress' | 'attention' | 'safety' | 'locked';
export function Status({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  return <span className={`status status-${kind}`}>{children}</span>;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 32 : 18, width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      {error}{' '}
      {onRetry && (
        <button className="linkish" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Only these roles may see what is inside. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();
  if (loading || (session && !profile)) {
    return (
      <div className="center-page">
        <Crown size={48} />
      </div>
    );
  }
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!profile || !roles.includes(profile.role)) return <Navigate to={homeFor(profile)} replace />;
  return <>{children}</>;
}
