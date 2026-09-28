import { PageHero, SiteShell } from './site/Shell';

// Drafts for the Academy's review. [BRACKETS] are values the Academy still needs to supply.
const DOCS = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      ['Who we are', 'Grit & Grace Girls Academy, Accra, Ghana ("the Academy"). This policy builds on the Academy’s Privacy Policy effective 5 January 2026. Data controller registration with the Data Protection Commission of Ghana: [DPC REGISTRATION NUMBER]. Contact: grace@gritgracegirlsacademy.com, +233 54 853 1412.'],
      ['Whose data', 'Parents and guardians who enrol a girl, the girls themselves (members), and our mentors and staff. Children’s data is special personal data under the Data Protection Act, 2012 (Act 843); we process it only with a parent’s or guardian’s consent, which is recorded, dated and can be changed at any time from the parent portal.'],
      ['What we collect', 'Parent: name, phone, email, payment records (card and mobile money details are handled by Paystack; we never see them). Member: first name, chosen username, age band and birth year, lesson progress, attendance, certificates, assessments, and what she writes in the community. Her journal and her messages with her mentor are stored so she can read them back; her parent cannot read them.'],
      ['Why', 'To deliver the mentoring program, keep girls safe, show parents progress, take payment, and meet our legal obligations. We do not sell data, show advertising, or use data to profile girls for anyone else.'],
      ['Who we share with', 'Service providers who host or process data for us under contract: Supabase (database), Cloudflare (hosting), Paystack (payments), Bunny.net (video), 8x8 Jitsi as a Service (live sessions), Resend (email), OpenAI (automated safety checks on community posts — text is checked, not stored for training). Data may be processed outside Ghana under appropriate safeguards.'],
      ['Safety', 'Community posts are checked automatically and by a person. Anything that suggests a girl may be at risk is sent to our safeguarding lead, and we may contact her parent or the appropriate authorities if we believe she is in danger.'],
      ['How long', 'While she is enrolled, and for [N] years after, unless you ask us to delete it sooner. Payment records are kept as required by law.'],
      ['Your rights', 'You can see, correct, or ask us to delete your data and your daughter’s. Members can request deletion from the app (Me → Delete my account); we confirm with the parent before completing it. Write to grace@gritgracegirlsacademy.com.'],
    ],
  },
  terms: {
    title: 'Terms of Enrolment',
    body: [
      ['The program', 'The Inner Court is a 12-month mentoring program with monthly modules, live sessions and a Circle. Content unlocks month by month.'],
      ['Payment', 'Fees are shown in Ghana cedis and payable by mobile money or card through Paystack, in full or in instalments. [REFUND POLICY].'],
      ['Accounts', 'The parent or guardian holds the account and the consent. A girl’s account is created with the join code her parent gives her. Accounts are personal and must not be shared.'],
      ['Community', 'Kindness is the rule. There is no dislike button; posts are checked before they appear. We may remove posts, pause posting, or end membership to keep the community safe.'],
      ['Content', 'All lessons, videos and materials belong to the Academy and are for enrolled members only. Please do not record, download or share them outside the Academy.'],
    ],
  },
  safeguarding: {
    title: 'Child Safeguarding Policy',
    body: [
      ['Our commitment', 'Every girl in the Academy has the right to be safe. Safeguarding is everyone’s responsibility — staff, mentors, volunteers and parents.'],
      ['Named lead', 'Safeguarding lead: Grace Nikoi, +233 54 853 1412. Deputy: [DEPUTY NAME].'],
      ['Mentors', 'All mentors are vetted [VETTING PROCESS] before they work with girls. Mentors never ask girls to move a conversation off the platform, never ask for phone numbers or photos, and never meet a girl one-to-one outside an Academy activity.'],
      ['On the platform', 'Direct messages can only be started by a girl, only with her own Circle’s mentor, only if her parent allows it, and are logged. Automated checks look for signs that a girl is at risk or that someone is trying to contact her privately; those go straight to the safeguarding lead and cannot be dismissed without a documented response.'],
      ['Talk to someone', 'Every girl can reach a real adult privately from any screen. If a girl is in immediate danger, call the Ghana Child Helpline on 116 or the police on 191.'],
      ['Reporting a concern', 'Anyone worried about a girl should contact the safeguarding lead the same day. We record every concern and what we did about it.'],
    ],
  },
} as const;

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  return (
    <SiteShell>
      <PageHero eyebrow="Draft for review · September 2026" title={d.title} />
      <div className="section">
        <div className="section-inner" style={{ maxWidth: 760 }}>
          {d.body.map(([h, p]) => (
            <section key={h} style={{ marginTop: 24 }}>
              <h3>{h}</h3>
              <p>{p}</p>
            </section>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
