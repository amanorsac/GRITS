import { Link } from 'react-router';
import { ghs, initials, monthsLeft, priceFor } from '../../lib/format';
import { useSite } from '../../lib/site';
import { PageHero, SiteShell, useSiteData } from './Shell';

// A course page in the spirit of Coursera's: what she'll learn, how it works,
// the syllabus month by month, who teaches it, and the questions parents ask.
export default function InnerCourtCourse() {
  const data = useSiteData();
  const FAQ = useSite('faq');
  const FOUNDER = useSite('founder');
  const HOW_IT_WORKS = useSite('how_it_works');
  const INNER_COURT = useSite('inner_court');
  const SYLLABUS = useSite('syllabus');
  const VALUES = useSite('values');
  const p = data?.programs.find((x) => x.slug === 'inner-court');
  const price = p ? priceFor(p) : null;
  const now = new Date();
  const currentMonth = p?.cohort_start
    ? Math.min(12, Math.max(1, (now.getUTCFullYear() - new Date(p.cohort_start).getUTCFullYear()) * 12 + now.getUTCMonth() - new Date(p.cohort_start).getUTCMonth() + 1))
    : null;

  return (
    <SiteShell title="The Inner Court">
      <PageHero eyebrow={`The Inner Court · ${INNER_COURT.cohort}`} title={INNER_COURT.title}>
        <p>{INNER_COURT.summons}</p>
      </PageHero>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-inner">
          <div className="card" style={{ marginTop: -40, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 20, alignItems: 'center' }}>
            <div>
              <div className="stat-label">Royal investment</div>
              <div className="stat">{ghs(price)}</div>
              {p?.pro_rata && price !== p.price_pesewas && <div className="muted small">{monthsLeft(p.cohort_end)} months left · {ghs(p.price_pesewas)}/year</div>}
            </div>
            <div>
              <div className="stat-label">Length</div>
              <div className="stat">{SYLLABUS.length || 12}</div>
              <div className="muted small">monthly modules</div>
            </div>
            <div>
              <div className="stat-label">Ages</div>
              <div className="stat" style={{ fontSize: '1.6rem' }}>{INNER_COURT.statAges}</div>
              <div className="muted small">{INNER_COURT.statAgesNote}</div>
            </div>
            <div>
              <div className="stat-label">Format</div>
              <div className="stat" style={{ fontSize: '1.6rem' }}>{INNER_COURT.format}</div>
              <div className="muted small">{INNER_COURT.formatNote}</div>
            </div>
            <Link to="/enrol" className="btn btn-primary" style={{ minHeight: 52 }}>
              Enrol her
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-inner two-col">
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <h2>What she’ll learn</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {INNER_COURT.focus.map((f, i) => (
                  <div key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <span className="status status-complete" style={{ padding: '4px 6px' }} aria-hidden="true" />
                    <div>
                      <strong>{f.name}</strong>
                      <div className="muted">{f.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2>Values she’ll carry</h2>
              <div className="row">
                {VALUES.map((v, i) => (
                  <span key={i} className="chip">
                    {v.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2>How it works</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {HOW_IT_WORKS.map((h, i) => (
                  <div key={i} className="card">
                    <h3>{h.title}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {h.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2>Syllabus</h2>
              <p className="muted">One month, one theme. Each builds on the Five Pillars.</p>
              <div className="card" style={{ padding: '4px 20px' }}>
                {SYLLABUS.map((m, i) => (
                  <details key={i} className="syllabus-row" open={m.month === currentMonth}>
                    <summary>
                      <span className="eyebrow" style={{ margin: 0, minWidth: 76 }}>
                        Month {m.month}
                      </span>
                      <strong style={{ flex: 1 }}>{m.title}</strong>
                      {m.month === currentMonth && <span className="status status-progress">This month</span>}
                    </summary>
                    <p style={{ margin: '0 0 14px 88px' }}>
                      {m.text} {m.value && <span className="muted">· {m.value}</span>}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            <div>
              <h2>Questions parents ask</h2>
              <div className="card" style={{ padding: '4px 20px' }}>
                {FAQ.map((f, i) => (
                  <details key={i} className="syllabus-row">
                    <summary>
                      <strong style={{ flex: 1 }}>{f.q}</strong>
                    </summary>
                    <p style={{ margin: '0 0 14px' }}>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <aside className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 90 }}>
            <section className="card card-maroon">
              <p className="eyebrow" style={{ color: 'var(--pink-bright)' }}>
                Included
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#f5dbe5' }}>
                {(p?.inclusions ?? []).map((i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {i}
                  </li>
                ))}
              </ul>
              <Link to="/enrol" className="btn btn-on-dark btn-block" style={{ marginTop: 16 }}>
                Secure her crown
              </Link>
            </section>
            <section className="card">
              <p className="eyebrow">Led by</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                {FOUNDER.portrait ? (
                  <img className="avatar" src={FOUNDER.portrait} alt="" style={{ width: 56, height: 56, objectFit: 'cover' }} />
                ) : (
                  <div className="avatar gold" style={{ width: 56, height: 56 }} aria-hidden="true">
                    {initials(FOUNDER.name)}
                  </div>
                )}
                <div>
                  <strong>{FOUNDER.name}</strong>
                  <div className="muted small">{FOUNDER.credentials}</div>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                …and a named mentor for every Circle.
              </p>
            </section>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}
