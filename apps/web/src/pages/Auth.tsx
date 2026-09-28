import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Crown } from '../components/ui';
import { homeFor, useAuth } from '../lib/auth';
import { loginEmail, sb } from '../lib/supabase';
import type { Profile } from '../lib/types';

function AuthFrame({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="center-page" style={{ background: 'linear-gradient(170deg, var(--maroon), var(--maroon-deep))' }}>
      <div className="card auth-card">
        <Link to="/" className="row" style={{ textDecoration: 'none', marginBottom: 16 }}>
          <Crown size={30} />
          <strong className="serif" style={{ color: 'var(--text)', fontSize: '1.15rem' }}>
            Grit &amp; Grace
          </strong>
        </Link>
        <h2>{title}</h2>
        {lead && <p className="muted">{lead}</p>}
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (session && profile) navigate(params.get('next') ?? homeFor(profile), { replace: true });
  }, [session, profile, navigate, params]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await sb().auth.signInWithPassword({ email: loginEmail(id), password });
    setBusy(false);
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'That username or password is not right.' : error.message);
      return;
    }
    const { data: p } = await sb().from('profiles').select('*').eq('id', data.user.id).single();
    navigate(params.get('next') ?? homeFor(p as Profile), { replace: true });
  }

  async function reset() {
    if (!id.includes('@')) {
      setError('Girls: ask your parent to reset your password from The Gate. Parents: enter your email above first.');
      return;
    }
    await sb().auth.resetPasswordForEmail(id.trim(), { redirectTo: `${location.origin}/account/password` });
    setResetSent(true);
  }

  return (
    <AuthFrame title="Welcome back" lead="Girls sign in with the username you chose. Parents and mentors use your email.">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Username or email</span>
          <input type="text" autoComplete="username" required value={id} onChange={(e) => setId(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        {resetSent && <p className="notice">Check your email for a link to set a new password.</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="spread" style={{ marginTop: 12 }}>
        <button className="linkish" onClick={reset}>
          Forgot password?
        </button>
        <Link to="/join">I have a join code</Link>
      </div>
      <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
        New here? <Link to="/enrol">Enrolment starts with a parent</Link>.
      </p>
    </AuthFrame>
  );
}

export function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ code: params.get('code') ?? '', username: '', display_name: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(j.error ?? 'Could not create your account');
      const { error } = await sb().auth.signInWithPassword({ email: j.email!, password: form.password });
      if (error) throw error;
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthFrame title="Claim your crown" lead="Your parent has a code for you. Choose a username only you and your mentor will know you by.">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Join code</span>
          <input type="text" required placeholder="QUEEN-XXXX-XXXX" value={form.code} onChange={set('code')} style={{ textTransform: 'uppercase', letterSpacing: 2 }} />
        </label>
        <label className="field">
          <span>Choose a username</span>
          <input type="text" required pattern="[a-zA-Z0-9._]{3,24}" title="3–24 letters, numbers, dots or underscores" autoComplete="username" value={form.username} onChange={set('username')} />
        </label>
        <label className="field">
          <span>What should we call you?</span>
          <input type="text" placeholder="Your first name" value={form.display_name} onChange={set('display_name')} />
        </label>
        <label className="field">
          <span>Password (8 or more characters)</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create my account'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
        Please don&rsquo;t use your full name or phone number as your username.
      </p>
    </AuthFrame>
  );
}

export function SetPassword() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await sb().auth.updateUser({ password });
    if (error) setError(error.message);
    else navigate(homeFor(profile), { replace: true });
  }
  return (
    <AuthFrame title="Set your password">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>New password</span>
          <input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block">Save password</button>
      </form>
    </AuthFrame>
  );
}

export function VerifyCertificate() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState<null | 'none' | { title: string; member_name: string; issued_at: string }>(null);
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const { data } = await sb().rpc('verify_certificate', { p_code: code.trim() });
    const row = (data as { title: string; member_name: string; issued_at: string }[] | null)?.[0];
    setResult(row ?? 'none');
  }
  return (
    <AuthFrame title="Verify a certificate" lead="Every Grit & Grace certificate carries a code like GG-3F82.">
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Certificate code</span>
          <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: 'uppercase' }} />
        </label>
        <button className="btn btn-primary btn-block">Check</button>
      </form>
      {result === 'none' && <p className="error" style={{ marginTop: 12 }}>No certificate has that code.</p>}
      {result && result !== 'none' && (
        <div className="notice" style={{ marginTop: 12 }}>
          <strong>Verified.</strong> {result.member_name} — {result.title}, issued {new Date(result.issued_at).toLocaleDateString('en-GB', { dateStyle: 'long' })}.
        </div>
      )}
    </AuthFrame>
  );
}
