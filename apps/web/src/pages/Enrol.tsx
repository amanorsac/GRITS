import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Crown, Switch } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ghs, monthsLeft, priceFor } from '../lib/format';
import { sb } from '../lib/supabase';
import type { Program } from '../lib/types';

// The Academy's age groups: 8–12 and 13–17.
type Band = '8-12' | '13-17';
const DRAFT_KEY = 'gg-enrol-draft';

function bandFor(birthYear: number): Band {
  const age = new Date().getFullYear() - birthYear;
  return age <= 12 ? '8-12' : '13-17';
}

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as null | { child_name: string; birth_year: string };
  } catch {
    return null;
  }
}

export default function Enrol() {
  const { session, profile } = useAuth();
  const draft = loadDraft();
  const [step, setStep] = useState(1);
  const [program, setProgram] = useState<Program | null>(null);
  const [parent, setParent] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [child, setChild] = useState({ child_name: draft?.child_name ?? '', birth_year: draft?.birth_year ?? '' });
  const [perms, setPerms] = useState({ circle: true, court: false, mentor_dm: true });
  const [consent, setConsent] = useState(false);
  const [digest, setDigest] = useState(true);
  const [channel, setChannel] = useState<'mobile_money' | 'card'>('mobile_money');
  const [plan, setPlan] = useState<'full' | 'instalments'>('full');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    sb().from('programs').select('*').eq('slug', 'inner-court').single().then(({ data }) => setProgram(data as Program));
  }, []);

  // Signed-in parents skip step 1.
  useEffect(() => {
    if (session && profile?.role === 'parent' && step === 1) setStep(child.child_name ? 3 : 2);
  }, [session, profile, step, child.child_name]);

  const band = child.birth_year ? bandFor(Number(child.birth_year)) : null;
  const firstName = child.child_name.split(' ')[0] || 'her';
  const age = child.birth_year ? new Date().getFullYear() - Number(child.birth_year) : null;

  useEffect(() => {
    // Community stays locked under 13 until the parent switches it on.
    if (band) setPerms((p) => ({ ...p, court: band !== '8-12' }));
  }, [band]);

  async function submitParent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await sb().auth.signUp({
      email: parent.email.trim(),
      password: parent.password,
      options: { data: { full_name: parent.full_name.trim(), phone: parent.phone.trim() }, emailRedirectTo: `${location.origin}/enrol` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (!data.session) {
      setConfirmEmail(true);
      return;
    }
    setStep(2);
  }

  function submitChild(e: FormEvent) {
    e.preventDefault();
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(child));
    setStep(3);
  }

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!consent) return setError('Please confirm consent to continue.');
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ authorization_url: string }>('/enrol', {
        body: {
          program: 'inner-court',
          child_name: child.child_name,
          birth_year: Number(child.birth_year) || undefined,
          age_band: band,
          permissions: perms,
          consent_data: consent,
          weekly_digest: digest,
          plan,
          channel,
        },
      });
      sessionStorage.removeItem(DRAFT_KEY);
      location.href = res.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const price = program ? priceFor(program) : null;
  const parts = program?.instalments ?? 1;

  return (
    <div className="split">
      <aside>
        <Link to="/" className="brandmark" style={{ marginBottom: 32 }}>
          <Crown size={30} /> Grit &amp; Grace
        </Link>
        <h2 style={{ color: '#fff' }}>Enrolment starts with you, not with her</h2>
        <p>You create the account, you hold the consent, and you decide what she can access. She joins with a code you give her.</p>
        <ol className="steps" style={{ marginTop: 28 }}>
          {[
            ['Your details', 'Name, phone, email'],
            ['About her', 'Age band sets what unlocks'],
            ['Permissions & payment', 'Mobile money or card'],
          ].map(([t, s], i) => (
            <li key={t} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
              <b>{i + 1}</b>
              <div>
                <strong>{t}</strong>
                <div style={{ color: '#f1d4de' }}>{s}</div>
              </div>
            </li>
          ))}
        </ol>
        <p style={{ marginTop: 32 }} className="eyebrow">
          <span style={{ color: 'var(--pink-bright)' }}>Already a member?</span>
        </p>
        <Link to="/login" style={{ color: '#fff' }}>
          Log in with your email or username
        </Link>
      </aside>

      <main>
        <p className="eyebrow">Step {step} of 3</p>

        {step === 1 &&
          (confirmEmail ? (
            <div className="card">
              <h2>Check your email</h2>
              <p>We sent a confirmation link to {parent.email}. Open it on this device and you will come straight back here to continue.</p>
            </div>
          ) : (
            <form className="stack" onSubmit={submitParent}>
              <h2>Your details</h2>
              <label className="field">
                <span>Your full name</span>
                <input type="text" required autoComplete="name" value={parent.full_name} onChange={(e) => setParent({ ...parent, full_name: e.target.value })} />
              </label>
              <label className="field">
                <span>Phone (for mobile money)</span>
                <input type="tel" required autoComplete="tel" placeholder="+233 …" value={parent.phone} onChange={(e) => setParent({ ...parent, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" required autoComplete="email" value={parent.email} onChange={(e) => setParent({ ...parent, email: e.target.value })} />
              </label>
              <label className="field">
                <span>Create a password</span>
                <input type="password" required minLength={8} autoComplete="new-password" value={parent.password} onChange={(e) => setParent({ ...parent, password: e.target.value })} />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn btn-primary" disabled={busy}>
                Continue
              </button>
            </form>
          ))}

        {step === 2 && (
          <form className="stack" onSubmit={submitChild}>
            <h2>About her</h2>
            <label className="field">
              <span>Her name</span>
              <input type="text" required value={child.child_name} onChange={(e) => setChild({ ...child, child_name: e.target.value })} />
            </label>
            <label className="field">
              <span>Year she was born</span>
              <input
                type="number"
                required
                min={new Date().getFullYear() - 17}
                max={new Date().getFullYear() - 8}
                value={child.birth_year}
                onChange={(e) => setChild({ ...child, birth_year: e.target.value })}
              />
            </label>
            {band && (
              <p className="notice">
                Age group {band}. {band === '8-12' ? 'Community features stay locked until you switch them on.' : 'The main community feed is on; you can switch it off.'}
              </p>
            )}
            <button className="btn btn-primary">Continue</button>
          </form>
        )}

        {step === 3 && (
          <form className="stack" onSubmit={pay}>
            <h2>What {firstName} can do inside</h2>
            <p className="muted">
              {age ? `She is ${age}, so ` : ''}
              {band === '8-12' ? 'community features stay locked until you switch them on. ' : ''}You can change any of this later from your parent portal.
            </p>
            <div>
              <div className="perm">
                <div>
                  <strong>Lessons and live sessions</strong>
                  <div className="muted">Always on for enrolled members</div>
                </div>
                <Switch checked disabled label="Lessons and live sessions" onChange={() => {}} />
              </div>
              <div className="perm">
                <div>
                  <strong>Her Circle</strong>
                  <div className="muted">A private group of 8–12 girls with a mentor</div>
                </div>
                <Switch checked={perms.circle} label="Her Circle" onChange={(v) => setPerms({ ...perms, circle: v })} />
              </div>
              <div className="perm">
                <div>
                  <strong>The Court — main community feed</strong>
                  <div className="muted">Moderated. Off by default under 13.</div>
                </div>
                <Switch checked={perms.court} label="The Court" onChange={(v) => setPerms({ ...perms, court: v })} />
              </div>
              <div className="perm">
                <div>
                  <strong>Direct messages to her mentor</strong>
                  <div className="muted">She starts the thread. Every message is logged.</div>
                </div>
                <Switch checked={perms.mentor_dm} label="Direct messages to her mentor" onChange={(v) => setPerms({ ...perms, mentor_dm: v })} />
              </div>
            </div>

            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <p className="eyebrow">Before you continue</p>
              <label className="check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                <span>
                  I am {firstName}&rsquo;s parent or legal guardian and I consent to the Academy processing her personal data as described in the <Link to="/privacy">Privacy Policy</Link> and{' '}
                  <Link to="/safeguarding">Child Safeguarding Policy</Link>.
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} />
                <span>Send me the weekly digest of her progress. (Optional — you can stop this any time.)</span>
              </label>
            </div>

            <div className="pay-options" role="radiogroup" aria-label="Payment method">
              <label className="pay-option">
                <input type="radio" name="channel" checked={channel === 'mobile_money'} onChange={() => setChannel('mobile_money')} /> <strong>Mobile money</strong>
                <div className="muted">MTN MoMo · Telecel · AirtelTigo</div>
              </label>
              <label className="pay-option">
                <input type="radio" name="channel" checked={channel === 'card'} onChange={() => setChannel('card')} /> <strong>Card</strong>
                <div className="muted">Visa · Mastercard</div>
              </label>
            </div>

            <div className="card">
              <div className="spread">
                <strong>The Inner Court · Royal investment</strong>
              </div>
              {program?.pro_rata && price !== program.price_pesewas && (
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Join at any time — {monthsLeft(program.cohort_end)} months remain in this cohort, so you pay {ghs(price)} instead of {ghs(program.price_pesewas)} for the full year.
                </p>
              )}
              <div className="pay-options" style={{ marginTop: 12 }}>
                <label className="pay-option">
                  <input type="radio" name="plan" checked={plan === 'full'} onChange={() => setPlan('full')} /> <strong>{ghs(price)}</strong>
                  <div className="muted">Pay in full</div>
                </label>
                {parts > 1 && (
                <label className="pay-option">
                  <input type="radio" name="plan" checked={plan === 'instalments'} onChange={() => setPlan('instalments')} />{' '}
                  <strong>
                    {parts} × {price ? ghs(Math.ceil(price / parts)) : 'GHS [X]'}
                  </strong>
                  <div className="muted">Monthly instalments</div>
                </label>
                )}
              </div>
            </div>

            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy || !consent}>
              {busy ? 'Opening secure checkout…' : 'Pay and create her account'}
            </button>
            <p className="muted small">Payments are processed by Paystack. We never see your card or wallet PIN.</p>
          </form>
        )}
      </main>
    </div>
  );
}

export function EnrolComplete() {
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const [state, setState] = useState<{ status: string; code?: string; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    api<{ status: string; payment: { enrolments: { join_codes: { code: string; child_name: string }[] } | null } }>(
      `/paystack/verify?reference=${encodeURIComponent(reference)}`,
    )
      .then((r) => {
        const jc = r.payment?.enrolments?.join_codes?.[0];
        setState({ status: r.status, code: jc?.code, name: jc?.child_name });
      })
      .catch((e) => setError(e.message));
  }, [reference]);

  return (
    <div className="center-page">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <Crown size={56} />
        {error && <p className="error">{error}</p>}
        {!state && !error && <p>Confirming your payment…</p>}
        {state?.status === 'success' && (
          <>
            <h2>Her crown is secured</h2>
            {state.code ? (
              <>
                <p>Give {state.name?.split(' ')[0] ?? 'her'} this code. She uses it once, in the app or at gritandgrace/join, to create her own account.</p>
                <p className="serif" style={{ fontSize: '1.8rem', letterSpacing: 3, color: 'var(--maroon)' }}>
                  {state.code}
                </p>
              </>
            ) : (
              <p>Payment received — thank you.</p>
            )}
            <p className="muted">We have emailed you the code too.</p>
            <Link to="/gate" className="btn btn-primary">
              Go to your parent portal
            </Link>
          </>
        )}
        {state && state.status !== 'success' && (
          <>
            <h2>Payment not completed</h2>
            <p>Paystack reports this payment as “{state.status}”. You have not been charged twice — try again from your parent portal.</p>
            <Link to="/gate" className="btn btn-primary">
              Go to your parent portal
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
