// The Palace → Public site: Website copy, Journal, Gallery, Events & Programs, Media library.
// Everything here writes through Supabase RLS (admin-only policies), so a non-admin can never save.
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import '../../cms.css';
import { DropZone, errMsg, ImagePicker, LinesEditor, ListEditor, useToast, useUnsavedWarning } from '../../components/cms';
import { FORMATTING_HINT } from '../../components/richtext';
import { Empty, ErrorBox, Loading, Status, Switch } from '../../components/ui';
import { isAdmin, useAuth } from '../../lib/auth';
import { must, useLoad } from '../../lib/hooks';
import { deleteMedia, formatBytes, isImageFile, listMedia, pathFromUrl, safeHref, uploadImage, youtubeId, type MediaFile } from '../../lib/media';
import {
  DEFAULTS,
  GALLERY_CATEGORIES,
  getSetting,
  hasSaved,
  loadSettings,
  longDate,
  resetSetting,
  saveSetting,
  settingUpdatedAt,
  slugify,
  type Article,
  type GalleryItem,
  type SettingKey,
  type SiteEvent,
  type SiteProgram,
} from '../../lib/site';
import { sb } from '../../lib/supabase';
import { ArticleView } from '../site/Article';
import { ytThumb } from '../site/Gallery';
import { invalidateSiteData } from '../site/Shell';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function AdminOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (!isAdmin(profile))
    return (
      <div className="card card-soft" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: '1.6rem' }}>This area is for admins</h1>
        <p style={{ margin: 0 }}>The public website is edited by the Academy’s admins. If you need something changed on the site, send a note to an admin through the Inbox.</p>
      </div>
    );
  return <>{children}</>;
}

function PageHead({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <header className="cms-head">
      <div>
        <h1>{title}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
          {intro}
        </p>
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  );
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <small id={id} className="hint">
      {children}
    </small>
  );
}

/** Text input with its label and optional hint, wired for screen readers. */
function TextField({
  label,
  value,
  onChange,
  hint,
  multiline,
  type = 'text',
  required,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  multiline?: boolean;
  type?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="req"> (required)</span>}
      </span>
      <Hint id={`${id}-h`}>{hint}</Hint>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} required={required} placeholder={placeholder} rows={rows} style={rows ? { minHeight: rows * 26 } : undefined} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} required={required} placeholder={placeholder} />
      )}
    </label>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{label}</strong>
        {hint && <div className="muted small">{hint}</div>}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════ Website copy

type F =
  | { k: string; label: string; t: 'text' | 'textarea' | 'url' | 'email' | 'number'; hint?: string }
  | { k: string; label: string; t: 'toggle'; hint?: string }
  | { k: string; label: string; t: 'image'; folder: string; hint?: string }
  | { k: string; label: string; t: 'lines'; item: string; multiline?: boolean; hint?: string }
  | { k: string; label: string; t: 'list'; item: string; fields: F[]; titleKey?: string; hint?: string }
  | { k: string; label: string; t: 'group'; fields: F[]; hint?: string };

type Section = {
  key: SettingKey;
  label: string;
  group: string;
  about: string;
  view: string;
  fields?: F[];
  list?: { item: string; fields: F[]; titleKey?: string };
};

const LINK_HINT = 'A page on this site such as /events, or a full web address starting with https://';

const SECTIONS: Section[] = [
  {
    key: 'announcement_bar',
    group: 'Across the site',
    label: 'Announcement bar',
    about: 'A short line shown above the menu on every public page — for a new cohort, an event, or a closing date.',
    view: '/',
    fields: [
      { k: 'enabled', label: 'Show the announcement', t: 'toggle' },
      { k: 'text', label: 'Announcement', t: 'text' },
      { k: 'linkLabel', label: 'Link text', t: 'text', hint: 'For example “Book your seat”. Leave empty for “Find out more”.' },
      { k: 'link', label: 'Link to', t: 'url', hint: LINK_HINT },
    ],
  },
  {
    key: 'contact',
    group: 'Across the site',
    label: 'Contact details',
    about: 'Shown in the footer and on the Contact page.',
    view: '/contact',
    fields: [
      { k: 'email', label: 'Email address', t: 'email' },
      {
        k: 'phones',
        label: 'Phone numbers',
        t: 'list',
        item: 'Phone',
        titleKey: 'label',
        fields: [
          { k: 'label', label: 'Number as shown', t: 'text', hint: 'For example +233 54 853 1412' },
          { k: 'tel', label: 'Number to dial (optional)', t: 'text', hint: 'Digits only, like +233548531412. Leave empty to use the number above.' },
        ],
      },
      {
        k: 'instagram',
        label: 'Instagram',
        t: 'group',
        fields: [
          { k: 'handle', label: 'Handle', t: 'text' },
          { k: 'url', label: 'Profile link', t: 'url' },
        ],
      },
      { k: 'location', label: 'Location', t: 'text' },
    ],
  },
  {
    key: 'taglines',
    group: 'Across the site',
    label: 'Taglines',
    about: 'The motto and signature line used in the footer, the About page and the home page.',
    view: '/about',
    fields: [
      { k: 'motto', label: 'Motto', t: 'text' },
      { k: 'signature', label: 'Signature line', t: 'text' },
    ],
  },
  {
    key: 'seo',
    group: 'Across the site',
    label: 'Search & sharing',
    about: 'What Google and link previews show for the site.',
    view: '/',
    fields: [
      { k: 'title', label: 'Site title', t: 'text', hint: 'About 60 characters.' },
      { k: 'description', label: 'Description', t: 'textarea', hint: 'One or two sentences, about 155 characters.' },
    ],
  },
  {
    key: 'hero',
    group: 'Home page',
    label: 'Hero (top of the page)',
    about: 'The first thing every visitor sees.',
    view: '/',
    fields: [
      { k: 'eyebrow', label: 'Small heading', t: 'text' },
      { k: 'line1', label: 'Headline — first line', t: 'text' },
      { k: 'line2', label: 'Headline — second line', t: 'text' },
      { k: 'emphasis', label: 'Headline — highlighted word', t: 'text', hint: 'Shown in pink italics at the end of the second line.' },
      { k: 'lead', label: 'Introduction', t: 'textarea' },
      { k: 'sublead', label: 'Second introduction', t: 'textarea' },
      { k: 'primaryCta', label: 'Main button text', t: 'text', hint: 'Goes to enrolment.' },
      { k: 'secondaryCta', label: 'Second button text', t: 'text', hint: 'Goes to the programs page.' },
      { k: 'image', label: 'Background photo (optional)', t: 'image', folder: 'site', hint: 'A wide landscape photo. It is darkened automatically so the words stay readable.' },
    ],
  },
  {
    key: 'scripture',
    group: 'Home page',
    label: 'Scripture',
    about: 'The verse under the hero.',
    view: '/',
    fields: [
      { k: 'eyebrow', label: 'Small heading', t: 'text' },
      { k: 'text', label: 'Verse', t: 'textarea' },
      { k: 'ref', label: 'Reference', t: 'text', hint: 'For example 1 Peter 2:9' },
    ],
  },
  {
    key: 'foundry',
    group: 'Home page',
    label: 'Who we are',
    about: 'The Identity Foundry story, on the home page and at the top of About.',
    view: '/#story',
    fields: [
      { k: 'eyebrow', label: 'Small heading', t: 'text' },
      { k: 'title', label: 'Heading', t: 'text' },
      { k: 'lead', label: 'Introduction', t: 'textarea' },
      { k: 'body', label: 'Paragraphs', t: 'lines', item: 'Paragraph', multiline: true },
      { k: 'cta', label: 'Button text', t: 'text' },
      { k: 'close', label: 'Closing lines (maroon card)', t: 'lines', item: 'Line' },
      { k: 'closeTag', label: 'Closing tag', t: 'text' },
    ],
  },
  {
    key: 'home',
    group: 'Home page',
    label: 'Section headings',
    about: 'Headings and short introductions for the other home page sections.',
    view: '/',
    fields: [
      { k: 'valuesEyebrow', label: 'Values — small heading', t: 'text' },
      { k: 'valuesTitle', label: 'Values — heading', t: 'text' },
      { k: 'valuesText', label: 'Values — introduction', t: 'textarea' },
      { k: 'programsEyebrow', label: 'Programs — small heading', t: 'text' },
      { k: 'programsTitle', label: 'Programs — heading', t: 'text' },
      { k: 'programsText', label: 'Programs — introduction', t: 'textarea' },
      { k: 'parentsEyebrow', label: 'Parents — small heading', t: 'text' },
      { k: 'parentsTitle', label: 'Parents — heading', t: 'text' },
      { k: 'parentsText', label: 'Parents — text', t: 'textarea' },
      { k: 'journalEyebrow', label: 'Journal — small heading', t: 'text' },
      { k: 'journalTitle', label: 'Journal — heading', t: 'text' },
      { k: 'ctaEyebrow', label: 'Closing band — small heading', t: 'text' },
      { k: 'ctaTitle', label: 'Closing band — heading', t: 'text' },
      { k: 'ctaText', label: 'Closing band — text', t: 'textarea' },
    ],
  },
  {
    key: 'founder',
    group: 'Home page',
    label: 'Founder',
    about: 'Meet the founder — on the home page, About and the Inner Court page.',
    view: '/about',
    fields: [
      { k: 'name', label: 'Name', t: 'text' },
      { k: 'title', label: 'Title', t: 'text' },
      { k: 'credentials', label: 'Credentials', t: 'text' },
      { k: 'bio', label: 'Biography', t: 'lines', item: 'Paragraph', multiline: true },
      { k: 'quote', label: 'Quote', t: 'textarea' },
      { k: 'portrait', label: 'Portrait photo', t: 'image', folder: 'site', hint: 'A portrait (taller than wide) works best.' },
      { k: 'portraitAlt', label: 'Portrait description', t: 'text', hint: 'Read aloud to people using screen readers.' },
    ],
  },
  {
    key: 'vision',
    group: 'About page',
    label: 'Vision',
    about: 'Our vision card on the About page.',
    view: '/about',
    fields: [
      { k: 'title', label: 'Heading', t: 'text' },
      { k: 'text', label: 'Text', t: 'textarea' },
    ],
  },
  {
    key: 'mission',
    group: 'About page',
    label: 'Mission',
    about: 'Our mission card on the About page.',
    view: '/about',
    fields: [
      { k: 'title', label: 'Heading', t: 'text' },
      { k: 'text', label: 'Text', t: 'textarea' },
    ],
  },
  {
    key: 'values',
    group: 'About page',
    label: 'G.I.R.L.S. values',
    about: 'The five values, on the home page, About and the Inner Court page.',
    view: '/about',
    list: {
      item: 'Value',
      titleKey: 'name',
      fields: [
        { k: 'letter', label: 'Letter', t: 'text' },
        { k: 'name', label: 'Name', t: 'text' },
        { k: 'sub', label: 'Subtitle', t: 'text' },
        { k: 'lines', label: 'Lines', t: 'lines', item: 'Line' },
      ],
    },
  },
  {
    key: 'pillars',
    group: 'About page',
    label: 'Five Pillars',
    about: 'The pillars on the About page.',
    view: '/about',
    list: {
      item: 'Pillar',
      titleKey: 'name',
      fields: [
        { k: 'n', label: 'Number', t: 'text', hint: 'For example 01' },
        { k: 'name', label: 'Name', t: 'text' },
        { k: 'sub', label: 'Subtitle', t: 'text' },
        { k: 'text', label: 'Text', t: 'textarea' },
      ],
    },
  },
  {
    key: 'inner_court',
    group: 'The Inner Court',
    label: 'Inner Court overview',
    about: 'The flagship program’s words on the Programs and Inner Court pages. Price and inclusions live under Events & programs.',
    view: '/programs/inner-court',
    fields: [
      { k: 'eyebrow', label: 'Small heading', t: 'text' },
      { k: 'title', label: 'Heading', t: 'text' },
      { k: 'summons', label: 'Introduction', t: 'textarea' },
      { k: 'quote', label: 'Quote', t: 'textarea' },
      {
        k: 'focus',
        label: 'What she’ll learn',
        t: 'list',
        item: 'Focus',
        titleKey: 'name',
        fields: [
          { k: 'name', label: 'Name', t: 'text' },
          { k: 'text', label: 'Description', t: 'text' },
        ],
      },
      { k: 'ages', label: 'Age groups (sentence)', t: 'text' },
      { k: 'cohort', label: 'Cohort dates', t: 'text', hint: 'For example February 2026 – January 2027' },
      { k: 'proRataNote', label: 'Joining mid-year note', t: 'textarea' },
      { k: 'statAges', label: 'Ages (fact box)', t: 'text' },
      { k: 'statAgesNote', label: 'Ages note (fact box)', t: 'text' },
      { k: 'format', label: 'Format (fact box)', t: 'text' },
      { k: 'formatNote', label: 'Format note (fact box)', t: 'text' },
    ],
  },
  {
    key: 'syllabus',
    group: 'The Inner Court',
    label: 'Syllabus',
    about: 'Month by month, on the Inner Court page. (The lessons themselves are in the Course studio.)',
    view: '/programs/inner-court',
    list: {
      item: 'Month',
      titleKey: 'title',
      fields: [
        { k: 'month', label: 'Month number', t: 'number' },
        { k: 'title', label: 'Theme', t: 'text' },
        { k: 'value', label: 'Value', t: 'text', hint: 'Gracefulness, Integrity, Resilience, Leadership or Spirituality' },
        { k: 'text', label: 'Description', t: 'text' },
      ],
    },
  },
  {
    key: 'how_it_works',
    group: 'The Inner Court',
    label: 'How it works',
    about: 'The “How it works” cards on the Inner Court page.',
    view: '/programs/inner-court',
    list: {
      item: 'Card',
      titleKey: 'title',
      fields: [
        { k: 'title', label: 'Heading', t: 'text' },
        { k: 'text', label: 'Text', t: 'textarea' },
      ],
    },
  },
  {
    key: 'faq',
    group: 'The Inner Court',
    label: 'Questions parents ask',
    about: 'The FAQ on the Inner Court page.',
    view: '/programs/inner-court',
    list: {
      item: 'Question',
      titleKey: 'q',
      fields: [
        { k: 'q', label: 'Question', t: 'text' },
        { k: 'a', label: 'Answer', t: 'textarea' },
      ],
    },
  },
  {
    key: 'pages',
    group: 'Other pages',
    label: 'Page headings',
    about: 'The heading and introduction at the top of Programs, Events, Journal, Gallery and Contact.',
    view: '/programs',
    fields: [
      { k: 'programsTitle', label: 'Programs — heading', t: 'text' },
      { k: 'programsText', label: 'Programs — introduction', t: 'textarea' },
      { k: 'eventsEyebrow', label: 'Events — small heading', t: 'text' },
      { k: 'eventsTitle', label: 'Events — heading', t: 'text' },
      { k: 'eventsText', label: 'Events — introduction', t: 'textarea' },
      { k: 'journalEyebrow', label: 'Journal — small heading', t: 'text' },
      { k: 'journalTitle', label: 'Journal — heading', t: 'text' },
      { k: 'journalText', label: 'Journal — introduction', t: 'textarea' },
      { k: 'galleryEyebrow', label: 'Gallery — small heading', t: 'text' },
      { k: 'galleryTitle', label: 'Gallery — heading', t: 'text' },
      { k: 'galleryText', label: 'Gallery — introduction', t: 'textarea' },
      { k: 'contactEyebrow', label: 'Contact — small heading', t: 'text' },
      { k: 'contactTitle', label: 'Contact — heading', t: 'text' },
      { k: 'contactText', label: 'Contact — introduction', t: 'textarea' },
    ],
  },
];

function blankFrom(fields: F[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => [f.k, f.t === 'toggle' ? false : f.t === 'number' ? 0 : f.t === 'lines' || f.t === 'list' ? [] : f.t === 'group' ? blankFrom(f.fields) : '']),
  );
}

/** The first problem with a draft, in words the Academy can act on. */
function validate(fields: F[], value: Record<string, unknown>, where = ''): string | null {
  for (const f of fields) {
    const v = value[f.k];
    const name = where ? `${where} → ${f.label}` : f.label;
    if (f.t === 'url' && typeof v === 'string' && v.trim() && !safeHref(v)) return `${name}: ${LINK_HINT.toLowerCase()}.`;
    if (f.t === 'email' && typeof v === 'string' && v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return `${name}: that doesn’t look like an email address.`;
    if (f.t === 'group' && v && typeof v === 'object') {
      const e = validate(f.fields, v as Record<string, unknown>, name);
      if (e) return e;
    }
    if (f.t === 'list' && Array.isArray(v)) {
      for (const [i, item] of v.entries()) {
        const e = validate(f.fields, item as Record<string, unknown>, `${name} ${i + 1}`);
        if (e) return e;
      }
    }
  }
  return null;
}

function FieldsEditor({ fields, value, onChange }: { fields: F[]; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div className="stack cms-fields">
      {fields.map((f) => (
        <FieldEditor key={f.k} f={f} value={value[f.k]} onChange={(v) => onChange({ ...value, [f.k]: v })} />
      ))}
    </div>
  );
}

function FieldEditor({ f, value, onChange }: { f: F; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  switch (f.t) {
    case 'text':
    case 'url':
    case 'email':
    case 'textarea':
      return <TextField label={f.label} hint={f.hint ?? (f.t === 'url' ? LINK_HINT : undefined)} value={String(value ?? '')} onChange={onChange} multiline={f.t === 'textarea'} type={f.t === 'email' ? 'email' : 'text'} />;
    case 'number':
      return (
        <label className="field field-narrow">
          <span>{f.label}</span>
          <Hint id={`${id}-h`}>{f.hint}</Hint>
          <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={f.hint ? `${id}-h` : undefined} />
        </label>
      );
    case 'toggle':
      return <ToggleRow label={f.label} hint={f.hint} checked={!!value} onChange={onChange} />;
    case 'image':
      return <ImagePicker label={f.label} hint={f.hint} folder={f.folder} value={String(value ?? '')} onChange={onChange} />;
    case 'lines':
      return (
        <fieldset className="cms-fieldset">
          <legend>{f.label}</legend>
          {f.hint && <p className="hint">{f.hint}</p>}
          <LinesEditor items={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} itemLabel={f.item} multiline={f.multiline} />
        </fieldset>
      );
    case 'list':
      return (
        <fieldset className="cms-fieldset">
          <legend>{f.label}</legend>
          {f.hint && <p className="hint">{f.hint}</p>}
          <ListEditor
            items={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
            onChange={onChange}
            itemLabel={f.item}
            blank={() => blankFrom(f.fields)}
            titleOf={(it) => (f.titleKey ? String(it[f.titleKey] ?? '') : '')}
            render={(it, set) => <FieldsEditor fields={f.fields} value={it} onChange={set} />}
          />
        </fieldset>
      );
    case 'group':
      return (
        <fieldset className="cms-fieldset">
          <legend>{f.label}</legend>
          <FieldsEditor fields={f.fields} value={(value ?? {}) as Record<string, unknown>} onChange={onChange} />
        </fieldset>
      );
  }
}

export function WebsiteEditor() {
  return (
    <AdminOnly>
      <WebsiteEditorInner />
    </AdminOnly>
  );
}

function WebsiteEditorInner() {
  const [params, setParams] = useSearchParams();
  const key = (SECTIONS.find((s) => s.key === params.get('s'))?.key ?? SECTIONS[0]!.key) as SettingKey;
  const section = SECTIONS.find((s) => s.key === key)!;
  const [ready, setReady] = useState(false);
  // The draft carries its section key, so switching sections never renders one section’s data in another’s form.
  const [edit, setEdit] = useState<{ key: SettingKey; saved: unknown; draft: unknown } | null>(null);
  const current = edit?.key === key ? edit : null;
  const saved = current?.saved ?? null;
  const draft = current?.draft ?? null;
  const setDraft = (v: unknown) => setEdit((e) => (e && e.key === key ? { ...e, draft: v } : e));
  const setSaved = (v: unknown) => setEdit((e) => (e && e.key === key ? { ...e, saved: v } : e));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadSettings(true).then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const v = clone(getSetting(key, DEFAULTS[key]));
    setEdit({ key, saved: v, draft: clone(v) });
    setError(null);
  }, [ready, key]);

  const dirty = ready && draft !== null && !same(draft, saved);
  useUnsavedWarning(dirty);

  function open(k: SettingKey) {
    if (k === key) return;
    if (dirty && !window.confirm('You have unsaved changes in this section. Leave without saving?')) return;
    setParams({ s: k });
  }

  async function save() {
    const problem = section.fields
      ? validate(section.fields, draft as Record<string, unknown>)
      : (draft as Record<string, unknown>[]).map((it, i) => validate(section.list!.fields, it, `${section.list!.item} ${i + 1}`)).find(Boolean) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveSetting(key, draft);
      setSaved(clone(draft));
      toast.show(`${section.label} saved — it’s live on the site now.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(`Put “${section.label}” back to the original words? Your saved changes to this section will be removed.`)) return;
    setBusy(true);
    try {
      await resetSetting(key);
      const v = clone(DEFAULTS[key]);
      setSaved(v);
      setDraft(clone(v));
      toast.show(`${section.label} is back to the original words.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const groups = Array.from(new Set(SECTIONS.map((s) => s.group)));
  const updated = settingUpdatedAt(key);

  return (
    <>
      <PageHead title="Website" intro="Every word and picture on the public site. Pick a section, change what you like, and press Save — it goes live straight away." />
      <div className="cms-split">
        <nav className="cms-sections" aria-label="Website sections">
          {groups.map((g) => (
            <div key={g}>
              <div className="cms-group">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <button key={s.key} type="button" className={`cms-section-btn${s.key === key ? ' active' : ''}`} aria-current={s.key === key ? 'true' : undefined} onClick={() => open(s.key)}>
                  <span>{s.label}</span>
                  {ready && hasSaved(s.key) && <span className="dot" title="Edited" aria-label="edited" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <section className="card cms-form" aria-labelledby="section-title">
          <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h2 id="section-title" style={{ marginBottom: 4 }}>
                {section.label}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {section.about}
              </p>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                {ready && (hasSaved(key) ? `Last saved ${updated ? new Date(updated).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}` : 'Showing the original words')}
              </p>
            </div>
            <a className="btn btn-ghost" href={section.view} target="_blank" rel="noreferrer">
              View on site ↗
            </a>
          </div>
          {!ready || draft === null ? (
            <Loading lines={6} />
          ) : (
            <form
              className="stack"
              style={{ marginTop: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {section.fields ? (
                <FieldsEditor fields={section.fields} value={draft as Record<string, unknown>} onChange={setDraft} />
              ) : (
                <ListEditor
                  items={draft as Record<string, unknown>[]}
                  onChange={setDraft}
                  itemLabel={section.list!.item}
                  blank={() => blankFrom(section.list!.fields)}
                  titleOf={(it) => (section.list!.titleKey ? String(it[section.list!.titleKey] ?? '') : '')}
                  render={(it, set) => <FieldsEditor fields={section.list!.fields} value={it} onChange={set} />}
                />
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="cms-actions">
                <button className="btn btn-primary" disabled={busy || !dirty}>
                  {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                </button>
                {dirty && (
                  <button type="button" className="btn btn-ghost" onClick={() => setDraft(clone(saved))} disabled={busy}>
                    Undo changes
                  </button>
                )}
                {hasSaved(key) && (
                  <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy} style={{ marginLeft: 'auto' }}>
                    Reset to default
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
      {toast.node}
    </>
  );
}

// ═══════════════════════════════════════════════════════════ Journal

type ArticleDraft = Omit<Article, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string };

const newArticle = (): ArticleDraft => ({
  slug: '',
  title: '',
  tag: '',
  excerpt: '',
  body: '',
  cover_url: null,
  author: 'Grace Abibath Nikoi',
  status: 'draft',
  published_at: null,
});

const dateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fromDateInput = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toISOString() : null);

function articleStatus(a: Pick<Article, 'status' | 'published_at'>) {
  if (a.status !== 'published') return <Status kind="locked">Draft</Status>;
  if (a.published_at && new Date(a.published_at).getTime() > Date.now()) return <Status kind="attention">Scheduled</Status>;
  return <Status kind="complete">Published</Status>;
}

export function JournalEditor() {
  return (
    <AdminOnly>
      <JournalEditorInner />
    </AdminOnly>
  );
}

function JournalEditorInner() {
  const { data, error, loading, reload } = useLoad(async () => must(await sb().from('articles').select('*').order('published_at', { ascending: false, nullsFirst: true })) as Article[]);
  const [editing, setEditing] = useState<ArticleDraft | null>(null);
  const [original, setOriginal] = useState<ArticleDraft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const dirty = !!editing && !same(editing, original);
  useUnsavedWarning(dirty);

  const tags = useMemo(() => Array.from(new Set((data ?? []).map((a) => a.tag).filter(Boolean))), [data]);

  function edit(a: ArticleDraft | null) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setEditing(a ? clone(a) : null);
    setOriginal(a ? clone(a) : null);
    setSlugTouched(!!a?.id);
    setPreview(false);
    setFormError(null);
  }

  const set = <K extends keyof ArticleDraft>(k: K, v: ArticleDraft[K]) =>
    setEditing((e) => {
      if (!e) return e;
      const next = { ...e, [k]: v };
      if (k === 'title' && !slugTouched) next.slug = slugify(String(v));
      return next;
    });

  async function persist(patch: Partial<ArticleDraft>, message: string) {
    if (!editing) return;
    const row = { ...editing, ...patch };
    if (!row.title.trim()) return setFormError('Please give the article a title.');
    row.slug = slugify(row.slug || row.title);
    if (!row.slug) return setFormError('The web address needs at least one letter or number.');
    setBusy(true);
    setFormError(null);
    const body = { slug: row.slug, title: row.title.trim(), tag: row.tag.trim(), excerpt: row.excerpt.trim(), body: row.body, cover_url: row.cover_url || null, author: row.author.trim(), status: row.status, published_at: row.published_at, updated_at: new Date().toISOString() };
    const res = row.id ? await sb().from('articles').update(body).eq('id', row.id).select().single() : await sb().from('articles').insert(body).select().single();
    setBusy(false);
    if (res.error) {
      setFormError(res.error.code === '23505' ? 'Another article already uses that web address. Please change it.' : res.error.message);
      return;
    }
    const savedRow = res.data as Article;
    setEditing(clone(savedRow));
    setOriginal(clone(savedRow));
    setSlugTouched(true);
    toast.show(message);
    reload();
  }

  async function remove() {
    if (!editing?.id || !window.confirm(`Delete “${editing.title}” for good? This cannot be undone.`)) return;
    setBusy(true);
    const { error: e } = await sb().from('articles').delete().eq('id', editing.id);
    setBusy(false);
    if (e) return setFormError(e.message);
    setEditing(null);
    setOriginal(null);
    toast.show('Article deleted.');
    reload();
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load the journal'} onRetry={reload} />;

  if (!editing)
    return (
      <>
        <PageHead title="Journal" intro="Articles for the public Journal. Drafts stay private until you publish them.">
          <button className="btn btn-primary" onClick={() => edit(newArticle())}>
            + New article
          </button>
        </PageHead>
        <section className="card">
          {data.length === 0 ? (
            <Empty>No articles yet. Write the first one.</Empty>
          ) : (
            <ul className="list">
              {data.map((a) => (
                <li key={a.id}>
                  <button type="button" className="cms-row-btn" onClick={() => edit(a)}>
                    {a.cover_url ? <img src={a.cover_url} alt="" className="cms-thumb" /> : <span className="cms-thumb cms-thumb-empty" aria-hidden="true">{a.title[0]}</span>}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong className="cms-row-title">{a.title}</strong>
                      <span className="muted small">
                        {a.tag}
                        {a.tag && ' · '}
                        {a.published_at ? longDate(a.published_at) : 'No date yet'}
                        {!a.body.trim() && ' · excerpt only'}
                      </span>
                    </span>
                    {articleStatus(a)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {toast.node}
      </>
    );

  const isPublished = editing.status === 'published';
  return (
    <>
      <PageHead title={editing.id ? 'Edit article' : 'New article'} intro="Write in plain text — the site does the formatting.">
        <button className="btn btn-ghost" onClick={() => edit(null)}>
          ← All articles
        </button>
        <button className="btn btn-secondary" aria-pressed={preview} onClick={() => setPreview(!preview)}>
          {preview ? 'Back to editing' : 'Preview'}
        </button>
        {editing.id && isPublished && (
          <a className="btn btn-ghost" href={`/journal/${editing.slug}`} target="_blank" rel="noreferrer">
            View on site ↗
          </a>
        )}
      </PageHead>
      {preview ? (
        <div className="cms-preview" aria-label="Preview">
          <ArticleView a={{ ...editing, created_at: editing.created_at ?? new Date().toISOString() }} />
        </div>
      ) : (
        <form
          className="cms-article-form"
          onSubmit={(e) => {
            e.preventDefault();
            void persist({}, 'Saved.');
          }}
        >
          <div className="card stack">
            <TextField label="Title" value={editing.title} onChange={(v) => set('title', v)} required />
            <TextField
              label="Web address"
              value={editing.slug}
              onChange={(v) => {
                setSlugTouched(true);
                set('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              }}
              hint={`gritandgrace…/journal/${editing.slug || 'your-article'}${isPublished ? ' — changing this breaks links people have shared.' : ''}`}
            />
            <TextField label="Excerpt" value={editing.excerpt} onChange={(v) => set('excerpt', v)} multiline hint="One or two sentences shown on the Journal page." />
            <TextField label="Article" value={editing.body} onChange={(v) => set('body', v)} multiline rows={18} hint={FORMATTING_HINT} />
          </div>
          <aside className="stack">
            <div className="card stack">
              <div className="spread">
                <strong>Status</strong>
                {articleStatus(editing)}
              </div>
              <label className="field">
                <span>Publish date</span>
                <input type="date" value={dateInput(editing.published_at)} onChange={(e) => set('published_at', fromDateInput(e.target.value))} />
              </label>
              <p className="hint" style={{ margin: 0 }}>
                A future date keeps a published article hidden until that day.
              </p>
              {formError && (
                <p className="error" role="alert">
                  {formError}
                </p>
              )}
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : isPublished ? 'Save changes' : 'Save draft'}
              </button>
              {isPublished ? (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => persist({ status: 'draft' }, 'Unpublished — it’s a draft again.')}>
                  Unpublish
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => persist({ status: 'published', published_at: editing.published_at ?? new Date().toISOString() }, 'Published — it’s on the Journal now.')}>
                  Publish
                </button>
              )}
              {editing.id && (
                <button type="button" className="btn btn-ghost danger-text" disabled={busy} onClick={remove}>
                  Delete article
                </button>
              )}
            </div>
            <div className="card stack">
              <TextField label="Tag" value={editing.tag} onChange={(v) => set('tag', v)} hint={tags.length ? `Used so far: ${tags.join(', ')}` : 'For example Parenting'} />
              <TextField label="Author" value={editing.author} onChange={(v) => set('author', v)} />
              <ImagePicker label="Cover photo" folder="journal" value={editing.cover_url} onChange={(url) => set('cover_url', url || null)} />
            </div>
          </aside>
        </form>
      )}
      {toast.node}
    </>
  );
}

// ═══════════════════════════════════════════════════════════ Gallery

export function GalleryEditor() {
  return (
    <AdminOnly>
      <GalleryEditorInner />
    </AdminOnly>
  );
}

function GalleryEditorInner() {
  const { data, error, loading, reload, setData } = useLoad(async () => must(await sb().from('gallery_items').select('*').order('position').order('created_at', { ascending: false })) as GalleryItem[]);
  const [category, setCategory] = useState<string>(GALLERY_CATEGORIES[0]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [video, setVideo] = useState({ url: '', caption: '', category: GALLERY_CATEGORIES[0] as string });
  const [videoError, setVideoError] = useState<string | null>(null);
  const toast = useToast();

  const items = data ?? [];
  const minPos = items.reduce((m, i) => Math.min(m, i.position), 0);

  async function uploadMany(files: File[]) {
    const images = files.filter(isImageFile);
    const skipped = files.filter((f) => !isImageFile(f)).map((f) => `${f.name}: not a photo`);
    setFailures(skipped);
    if (!images.length) return;
    setProgress({ done: 0, total: images.length });
    const errors: string[] = [...skipped];
    let added = 0;
    // One at a time: kinder to phones on mobile data, and the order is kept.
    for (const [i, f] of images.entries()) {
      try {
        const url = await uploadImage(f, 'gallery');
        const { error: e } = await sb()
          .from('gallery_items')
          .insert({ kind: 'image', url, caption: '', category, position: minPos - images.length + i });
        if (e) throw new Error(e.message);
        added++;
      } catch (e) {
        errors.push(`${f.name}: ${errMsg(e)}`);
      }
      setProgress({ done: i + 1, total: images.length });
    }
    setProgress(null);
    setFailures(errors);
    if (added) toast.show(`${added} photo${added === 1 ? '' : 's'} added to ${category}.`);
    reload();
  }

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    const id = youtubeId(video.url);
    if (!id) return setVideoError('That doesn’t look like a YouTube link. Copy the address from the video’s Share button.');
    setVideoError(null);
    const { error: err } = await sb()
      .from('gallery_items')
      .insert({ kind: 'video', url: `https://www.youtube.com/watch?v=${id}`, caption: video.caption.trim(), category: video.category, position: minPos - 1 });
    if (err) return setVideoError(err.message);
    setVideo({ ...video, url: '', caption: '' });
    toast.show('Video added.');
    reload();
  }

  async function update(item: GalleryItem, patch: Partial<GalleryItem>) {
    setData(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const { error: e } = await sb().from('gallery_items').update(patch).eq('id', item.id);
    if (e) {
      toast.show(e.message, 'error');
      reload();
    } else toast.show('Saved.');
  }

  async function move(index: number, d: number) {
    const next = items.slice();
    const [x] = next.splice(index, 1);
    next.splice(index + d, 0, x!);
    const renumbered = next.map((it, i) => ({ ...it, position: i }));
    setData(renumbered);
    const changed = renumbered.filter((it) => items.find((o) => o.id === it.id)?.position !== it.position);
    const results = await Promise.all(changed.map((it) => sb().from('gallery_items').update({ position: it.position }).eq('id', it.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.show(failed.error.message, 'error');
      reload();
    }
  }

  async function remove(item: GalleryItem) {
    if (!window.confirm(item.kind === 'image' ? 'Remove this photo from the gallery? The file is deleted too.' : 'Remove this video from the gallery?')) return;
    const { error: e } = await sb().from('gallery_items').delete().eq('id', item.id);
    if (e) return toast.show(e.message, 'error');
    const path = item.kind === 'image' ? pathFromUrl(item.url) : null;
    if (path?.startsWith('gallery/')) await deleteMedia(path).catch(() => undefined);
    setData(items.filter((i) => i.id !== item.id));
    toast.show('Removed.');
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load the gallery'} onRetry={reload} />;

  return (
    <>
      <PageHead title="Gallery" intro="Photos and videos on the public Gallery page. New items appear first; use the arrows to change the order.">
        <a className="btn btn-ghost" href="/gallery" target="_blank" rel="noreferrer">
          View on site ↗
        </a>
      </PageHead>
      <div className="grid cms-two">
        <section className="card stack" aria-labelledby="up-h">
          <h2 id="up-h" style={{ fontSize: '1.3rem' }}>
            Add photos
          </h2>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <DropZone multiple busy={!!progress} onFiles={uploadMany}>
            <p className="muted small" style={{ margin: 0, width: '100%' }}>
              Choose as many as you like. Each photo is resized for the web before it uploads.
            </p>
          </DropZone>
          {progress && (
            <div role="status" aria-live="polite">
              <div className="spread small">
                <span>
                  Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {failures.length > 0 && (
            <div className="error" role="alert">
              <strong>Some files were not added:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <form className="card stack" onSubmit={addVideo} aria-labelledby="vid-h">
          <h2 id="vid-h" style={{ fontSize: '1.3rem' }}>
            Add a YouTube video
          </h2>
          <TextField label="YouTube link" value={video.url} onChange={(v) => setVideo({ ...video, url: v })} placeholder="https://youtu.be/…" required />
          <TextField label="Caption" value={video.caption} onChange={(v) => setVideo({ ...video, caption: v })} />
          <label className="field">
            <span>Category</span>
            <select value={video.category} onChange={(e) => setVideo({ ...video, category: e.target.value })}>
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {videoError && (
            <p className="error" role="alert">
              {videoError}
            </p>
          )}
          <button className="btn btn-primary">Add video</button>
        </form>
      </div>

      <h2 style={{ marginTop: 32, fontSize: '1.3rem' }}>
        In the gallery <span className="muted">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <Empty>Nothing in the gallery yet.</Empty>
      ) : (
        <ul className="cms-gallery">
          {items.map((item, i) => {
            const vid = item.kind === 'video' ? youtubeId(item.url) : null;
            const thumb = vid ? ytThumb(vid) : item.url;
            return (
              <li key={item.id} className="card cms-gallery-item">
                <div className="cms-gallery-thumb">
                  <img src={thumb} alt="" loading="lazy" />
                  {item.kind === 'video' && <span className="status status-progress cms-badge">Video</span>}
                </div>
                <GalleryCaption key={item.caption} item={item} onSave={(caption) => update(item, { caption })} />
                <label className="field">
                  <span>Category</span>
                  <select value={item.category} onChange={(e) => update(item, { category: e.target.value })}>
                    {GALLERY_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                    {!(GALLERY_CATEGORIES as readonly string[]).includes(item.category) && <option>{item.category}</option>}
                  </select>
                </label>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" aria-label="Move later" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn btn-ghost danger-text" style={{ marginLeft: 'auto' }} onClick={() => remove(item)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {toast.node}
    </>
  );
}

function GalleryCaption({ item, onSave }: { item: GalleryItem; onSave: (caption: string) => void }) {
  const [v, setV] = useState(item.caption);
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>Caption</span>
      <input id={id} type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== item.caption && onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
    </label>
  );
}

// ═══════════════════════════════════════════════════════════ Events & programs

type EventDraft = Omit<SiteEvent, 'id'> & { id?: string; is_published: boolean; cover_url: string | null };

const newEvent = (): EventDraft => ({
  slug: '',
  title: '',
  tagline: '',
  description: '',
  starts_at: null,
  ends_at: null,
  date_label: null,
  venue: '',
  program_slug: null,
  register_url: null,
  cover_url: null,
  is_published: false,
});

// Ghana keeps GMT all year, so Accra time is UTC.
const toAccraInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fromAccraInput = (v: string) => (v ? new Date(`${v}:00Z`).toISOString() : null);

export function EventsEditor() {
  const [tab, setTab] = useState<'events' | 'programs'>('events');
  return (
    <AdminOnly>
      <PageHead title="Events & programs" intro="What’s coming up, and the programs families can join.">
        <div className="segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>
            Events
          </button>
          <button type="button" aria-pressed={tab === 'programs'} onClick={() => setTab('programs')}>
            Programs
          </button>
        </div>
      </PageHead>
      {tab === 'events' ? <EventsTab /> : <ProgramsTab />}
    </AdminOnly>
  );
}

function EventsTab() {
  const { data, error, loading, reload } = useLoad(async () => {
    const events = must(await sb().from('events').select('*').order('starts_at', { ascending: false, nullsFirst: true })) as SiteEvent[];
    const programs = must(await sb().from('programs').select('slug, name').order('position')) as { slug: string; name: string }[];
    return { events, programs };
  });
  const [editing, setEditing] = useState<EventDraft | null>(null);
  const [original, setOriginal] = useState<EventDraft | null>(null);
  const [dated, setDated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const dirty = !!editing && !same(editing, original);
  useUnsavedWarning(dirty);

  function edit(e: EventDraft | null) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setEditing(e ? clone(e) : null);
    setOriginal(e ? clone(e) : null);
    setDated(!e || !!e.starts_at || !e.date_label);
    setFormError(null);
  }
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const e = editing;
    if (!e.title.trim()) return setFormError('Please give the event a title.');
    if (dated && !e.starts_at) return setFormError('Please choose when it starts, or pick “Date not fixed yet”.');
    if (dated && e.ends_at && e.starts_at && e.ends_at < e.starts_at) return setFormError('The end time is before the start time.');
    if (e.register_url?.trim() && !safeHref(e.register_url)) return setFormError(`Registration link: ${LINK_HINT.toLowerCase()}.`);
    const year = e.starts_at ? new Date(e.starts_at).getUTCFullYear() : '';
    const slug = e.slug || slugify(`${e.title} ${year}`);
    const row = {
      slug,
      title: e.title.trim(),
      tagline: e.tagline.trim(),
      description: e.description.trim(),
      starts_at: dated ? e.starts_at : null,
      ends_at: dated ? e.ends_at : null,
      date_label: dated ? null : e.date_label?.trim() || null,
      venue: e.venue?.trim() || null,
      program_slug: e.program_slug || null,
      register_url: e.register_url?.trim() || null,
      cover_url: e.cover_url || null,
      is_published: e.is_published,
    };
    setBusy(true);
    setFormError(null);
    const res = e.id ? await sb().from('events').update(row).eq('id', e.id).select().single() : await sb().from('events').insert(row).select().single();
    setBusy(false);
    if (res.error) return setFormError(res.error.code === '23505' ? 'Another event already uses that web address — change the title slightly.' : res.error.message);
    const saved = res.data as EventDraft;
    setEditing(clone(saved));
    setOriginal(clone(saved));
    invalidateSiteData();
    toast.show(row.is_published ? 'Saved — it’s on the Events page.' : 'Saved as hidden. Switch on “Show on the site” when it’s ready.');
    reload();
  }

  async function remove() {
    if (!editing?.id || !window.confirm(`Delete “${editing.title}”? This cannot be undone.`)) return;
    const { error: e } = await sb().from('events').delete().eq('id', editing.id);
    if (e) return setFormError(e.message);
    invalidateSiteData();
    setEditing(null);
    setOriginal(null);
    toast.show('Event deleted.');
    reload();
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load events'} onRetry={reload} />;

  if (!editing)
    return (
      <>
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => edit(newEvent())}>
            + New event
          </button>
          <a className="btn btn-ghost" href="/events" target="_blank" rel="noreferrer">
            View on site ↗
          </a>
        </div>
        <section className="card">
          {data.events.length === 0 ? (
            <Empty>No events yet.</Empty>
          ) : (
            <ul className="list">
              {data.events.map((e) => {
                const past = e.starts_at && new Date(e.starts_at).getTime() < Date.now();
                return (
                  <li key={e.id}>
                    <button type="button" className="cms-row-btn" onClick={() => edit({ ...newEvent(), ...e, cover_url: e.cover_url ?? null, is_published: e.is_published ?? true })}>
                      {e.cover_url ? <img src={e.cover_url} alt="" className="cms-thumb" /> : <span className="cms-thumb cms-thumb-empty" aria-hidden="true">{e.title[0]}</span>}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong className="cms-row-title">{e.title}</strong>
                        <span className="muted small">
                          {e.starts_at ? new Date(e.starts_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' }) : e.date_label || 'No date'}
                          {e.venue ? ` · ${e.venue}` : ''}
                        </span>
                      </span>
                      {e.is_published === false ? <Status kind="locked">Hidden</Status> : past ? <Status kind="attention">Past</Status> : <Status kind="complete">On the site</Status>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {toast.node}
      </>
    );

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={() => edit(null)}>
          ← All events
        </button>
      </div>
      <form className="cms-article-form" onSubmit={save}>
        <div className="card stack">
          <h2 style={{ fontSize: '1.4rem' }}>{editing.id ? 'Edit event' : 'New event'}</h2>
          <TextField label="Title" value={editing.title} onChange={(v) => set('title', v)} required />
          <TextField label="Tagline" value={editing.tagline} onChange={(v) => set('tagline', v)} hint="A short line under the title, like “A Night of Legacy & Love”." />
          <TextField label="Description" value={editing.description} onChange={(v) => set('description', v)} multiline rows={6} />
          <fieldset className="cms-fieldset">
            <legend>When</legend>
            <div className="row" role="radiogroup" aria-label="Date">
              <label className="check" style={{ padding: 0 }}>
                <input type="radio" name="dated" checked={dated} onChange={() => setDated(true)} /> <span>Exact date &amp; time</span>
              </label>
              <label className="check" style={{ padding: 0 }}>
                <input type="radio" name="dated" checked={!dated} onChange={() => setDated(false)} /> <span>Date not fixed yet</span>
              </label>
            </div>
            {dated ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 12 }}>
                <label className="field">
                  <span>Starts (Accra time)</span>
                  <input type="datetime-local" value={toAccraInput(editing.starts_at)} onChange={(e) => set('starts_at', fromAccraInput(e.target.value))} />
                </label>
                <label className="field">
                  <span>Ends (optional)</span>
                  <input type="datetime-local" value={toAccraInput(editing.ends_at)} onChange={(e) => set('ends_at', fromAccraInput(e.target.value))} />
                </label>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <TextField label="What to show instead of a date" value={editing.date_label ?? ''} onChange={(v) => set('date_label', v)} placeholder="Coming 2027" />
              </div>
            )}
          </fieldset>
          <TextField label="Venue" value={editing.venue ?? ''} onChange={(v) => set('venue', v)} placeholder="Airport View Hotel, Accra" />
        </div>
        <aside className="stack">
          <div className="card stack">
            <ToggleRow label="Show on the site" hint="Hidden events are only visible here." checked={editing.is_published} onChange={(v) => set('is_published', v)} />
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save event'}
            </button>
            {editing.id && (
              <button type="button" className="btn btn-ghost danger-text" onClick={remove} disabled={busy}>
                Delete event
              </button>
            )}
          </div>
          <div className="card stack">
            <label className="field">
              <span>Linked program</span>
              <select value={editing.program_slug ?? ''} onChange={(e) => set('program_slug', e.target.value || null)}>
                <option value="">None</option>
                {data.programs.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint" style={{ margin: 0 }}>
              The program’s “what’s included” list is shown with the event.
            </p>
            <TextField label="Registration link (optional)" value={editing.register_url ?? ''} onChange={(v) => set('register_url', v)} hint="Leave empty and “Register interest” opens our contact form." />
            <ImagePicker label="Cover photo" folder="events" value={editing.cover_url} onChange={(url) => set('cover_url', url || null)} />
          </div>
        </aside>
      </form>
      {toast.node}
    </>
  );
}

type ProgramDraft = Omit<SiteProgram, 'id'> & { id?: string; cover_url: string | null };
const KINDS = [
  ['mentoring', 'Mentoring program'],
  ['intensive', 'Intensive'],
  ['event', 'Event'],
  ['service', 'Service'],
] as const;

function ProgramsTab() {
  const { data, error, loading, reload } = useLoad(async () => must(await sb().from('programs').select('*').order('position')) as SiteProgram[]);
  const [editing, setEditing] = useState<ProgramDraft | null>(null);
  const [original, setOriginal] = useState<ProgramDraft | null>(null);
  const [priceText, setPriceText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const dirty = !!editing && (!same(editing, original) || priceText !== priceOf(original));
  useUnsavedWarning(dirty);

  function priceOf(p: ProgramDraft | null) {
    return p?.price_pesewas != null ? String(p.price_pesewas / 100) : '';
  }
  function edit(p: ProgramDraft | null) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setEditing(p ? clone(p) : null);
    setOriginal(p ? clone(p) : null);
    setPriceText(priceOf(p));
    setFormError(null);
  }
  const set = <K extends keyof ProgramDraft>(k: K, v: ProgramDraft[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const p = editing;
    if (!p.name.trim()) return setFormError('Please give the program a name.');
    const price = priceText.trim() === '' ? null : Number(priceText.replace(/,/g, ''));
    if (price != null && (!Number.isFinite(price) || price < 0)) return setFormError('The price should be a number of cedis, like 2999.');
    if (p.pro_rata && (!p.cohort_start || !p.cohort_end)) return setFormError('Pro-rata pricing needs the cohort’s start and end dates.');
    if (p.cohort_start && p.cohort_end && p.cohort_end < p.cohort_start) return setFormError('The cohort ends before it starts.');
    const row = {
      name: p.name.trim(),
      kind: p.kind,
      summary: p.summary.trim(),
      audience: p.audience.trim(),
      duration_label: p.duration_label.trim(),
      price_pesewas: price == null ? null : Math.round(price * 100),
      instalments: Math.min(12, Math.max(1, Math.round(p.instalments || 1))),
      pro_rata: p.pro_rata,
      cohort_start: p.cohort_start || null,
      cohort_end: p.cohort_end || null,
      inclusions: p.inclusions.map((i) => i.trim()).filter(Boolean),
      is_open: p.is_open,
      cover_url: p.cover_url || null,
      position: Math.round(p.position || 0),
    };
    setBusy(true);
    setFormError(null);
    const slug = p.slug || slugify(p.name);
    const res = p.id ? await sb().from('programs').update(row).eq('id', p.id).select().single() : await sb().from('programs').insert({ ...row, slug }).select().single();
    setBusy(false);
    if (res.error) return setFormError(res.error.code === '23505' ? 'A program with that name already exists.' : res.error.message);
    const saved = res.data as ProgramDraft;
    setEditing(clone(saved));
    setOriginal(clone(saved));
    setPriceText(priceOf(saved));
    invalidateSiteData();
    toast.show(`${saved.name} saved.`);
    reload();
  }

  if (loading && !data) return <Loading lines={6} />;
  if (error || !data) return <ErrorBox error={error ?? 'Could not load programs'} onRetry={reload} />;

  if (!editing)
    return (
      <>
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn-primary"
            onClick={() =>
              edit({
                slug: '',
                name: '',
                kind: 'service',
                summary: '',
                duration_label: '',
                price_pesewas: null,
                instalments: 1,
                is_open: true,
                audience: '',
                pro_rata: false,
                cohort_start: null,
                cohort_end: null,
                inclusions: [],
                position: (data.at(-1)?.position ?? 0) + 1,
                cover_url: null,
              })
            }
          >
            + New program
          </button>
          <a className="btn btn-ghost" href="/programs" target="_blank" rel="noreferrer">
            View on site ↗
          </a>
        </div>
        <section className="card">
          <ul className="list">
            {data.map((p) => (
              <li key={p.id}>
                <button type="button" className="cms-row-btn" onClick={() => edit({ ...p, cover_url: p.cover_url ?? null })}>
                  {p.cover_url ? <img src={p.cover_url} alt="" className="cms-thumb" /> : <span className="cms-thumb cms-thumb-empty" aria-hidden="true">{p.name[0]}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong className="cms-row-title">{p.name}</strong>
                    <span className="muted small">
                      {p.price_pesewas != null ? `GHS ${(p.price_pesewas / 100).toLocaleString('en-GH')}` : 'No price'}
                      {p.duration_label ? ` · ${p.duration_label}` : ''}
                      {p.audience ? ` · ${p.audience}` : ''}
                    </span>
                  </span>
                  {p.is_open ? <Status kind="complete">Open</Status> : <Status kind="attention">Waitlist</Status>}
                </button>
              </li>
            ))}
          </ul>
        </section>
        {toast.node}
      </>
    );

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={() => edit(null)}>
          ← All programs
        </button>
      </div>
      <form className="cms-article-form" onSubmit={save}>
        <div className="card stack">
          <h2 style={{ fontSize: '1.4rem' }}>{editing.id ? editing.name || 'Program' : 'New program'}</h2>
          <TextField label="Name" value={editing.name} onChange={(v) => set('name', v)} required />
          <TextField label="Summary" value={editing.summary} onChange={(v) => set('summary', v)} multiline rows={5} />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <TextField label="Who it’s for" value={editing.audience} onChange={(v) => set('audience', v)} placeholder="Girls 8–12 and 13–17" />
            <TextField label="Length" value={editing.duration_label} onChange={(v) => set('duration_label', v)} placeholder="12 months" />
          </div>
          <fieldset className="cms-fieldset">
            <legend>What’s included</legend>
            <LinesEditor items={editing.inclusions} onChange={(v) => set('inclusions', v)} itemLabel="Inclusion" />
          </fieldset>
          <fieldset className="cms-fieldset">
            <legend>Price</legend>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <TextField label="Price (GHS)" value={priceText} onChange={setPriceText} hint="Whole year / full price. Leave empty if there is no price." placeholder="2999" />
              <label className="field">
                <span>Instalments</span>
                <input type="number" min={1} max={12} value={editing.instalments} onChange={(e) => set('instalments', Number(e.target.value))} />
              </label>
            </div>
            <ToggleRow label="Pro-rata pricing" hint="Families joining mid-cohort pay only for the months left." checked={editing.pro_rata} onChange={(v) => set('pro_rata', v)} />
            {editing.pro_rata && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <label className="field">
                  <span>Cohort starts</span>
                  <input type="date" value={editing.cohort_start ?? ''} onChange={(e) => set('cohort_start', e.target.value || null)} />
                </label>
                <label className="field">
                  <span>Cohort ends</span>
                  <input type="date" value={editing.cohort_end ?? ''} onChange={(e) => set('cohort_end', e.target.value || null)} />
                </label>
              </div>
            )}
          </fieldset>
        </div>
        <aside className="stack">
          <div className="card stack">
            <ToggleRow label="Open for enrolment" hint="Off shows “Waitlist open”." checked={editing.is_open} onChange={(v) => set('is_open', v)} />
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save program'}
            </button>
          </div>
          <div className="card stack">
            <label className="field">
              <span>Type</span>
              <select value={editing.kind} onChange={(e) => set('kind', e.target.value)}>
                {KINDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
                {!KINDS.some(([k]) => k === editing.kind) && <option value={editing.kind}>{editing.kind}</option>}
              </select>
            </label>
            <label className="field">
              <span>Order on the page</span>
              <input type="number" value={editing.position} onChange={(e) => set('position', Number(e.target.value))} />
            </label>
            <p className="hint" style={{ margin: 0 }}>
              Lower numbers come first.
            </p>
            <ImagePicker label="Cover photo" folder="programs" value={editing.cover_url} onChange={(url) => set('cover_url', url || null)} />
          </div>
        </aside>
      </form>
      {toast.node}
    </>
  );
}

// ═══════════════════════════════════════════════════════════ Media library

const FOLDERS = ['library', 'site', 'gallery', 'journal', 'events', 'programs'];

export function MediaLibrary() {
  return (
    <AdminOnly>
      <MediaLibraryInner />
    </AdminOnly>
  );
}

function MediaLibraryInner() {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState('all');
  const [uploadTo, setUploadTo] = useState('library');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setError(null);
    listMedia()
      .then(setFiles)
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function upload(list: File[]) {
    const images = list.filter(isImageFile);
    if (!images.length) return toast.show('Only photos can be uploaded here.', 'error');
    setProgress({ done: 0, total: images.length });
    const errors: string[] = [];
    for (const [i, f] of images.entries()) {
      try {
        await uploadImage(f, uploadTo);
      } catch (e) {
        errors.push(`${f.name}: ${errMsg(e)}`);
      }
      setProgress({ done: i + 1, total: images.length });
    }
    setProgress(null);
    if (errors.length) toast.show(errors.join(' · '), 'error');
    else toast.show(`${images.length} uploaded.`);
    load();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.show('Link copied.');
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  async function remove(f: MediaFile) {
    if (!window.confirm(`Delete ${f.name}? Any page still using this image will show a gap instead.`)) return;
    try {
      await deleteMedia(f.path);
      setFiles((fs) => (fs ?? []).filter((x) => x.path !== f.path));
      toast.show('Deleted.');
    } catch (e) {
      toast.show(errMsg(e), 'error');
    }
  }

  const folders = Array.from(new Set((files ?? []).map((f) => f.folder))).sort();
  const shown = (files ?? []).filter((f) => folder === 'all' || f.folder === folder);
  const total = shown.reduce((n, f) => n + (f.size ?? 0), 0);

  return (
    <>
      <PageHead title="Media library" intro="Every image uploaded for the public site. Photos are resized for the web automatically." />
      <section className="card stack" style={{ marginBottom: 24 }}>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(180px, 260px) 1fr', alignItems: 'end' }}>
          <label className="field">
            <span>Upload into</span>
            <select value={uploadTo} onChange={(e) => setUploadTo(e.target.value)}>
              {FOLDERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <DropZone multiple busy={!!progress} onFiles={upload} />
        </div>
        {progress && (
          <div role="status" aria-live="polite">
            <span className="small">
              Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </span>
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </section>
      {error && <ErrorBox error={error} onRetry={load} />}
      {!files && !error && <Loading lines={4} />}
      {files && (
        <>
          <div className="spread" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            <div className="row" role="group" aria-label="Folder">
              {['all', ...folders].map((f) => (
                <button key={f} type="button" className="chip chip-lg" aria-pressed={folder === f} onClick={() => setFolder(f)}>
                  {f === 'all' ? 'All' : f} <span className="chip-count">{f === 'all' ? files.length : files.filter((x) => x.folder === f).length}</span>
                </button>
              ))}
            </div>
            <span className="muted small">
              {shown.length} file{shown.length === 1 ? '' : 's'} · {formatBytes(total)}
            </span>
          </div>
          {shown.length === 0 ? (
            <Empty>No images here yet.</Empty>
          ) : (
            <ul className="media-grid media-grid-lg">
              {shown.map((f) => (
                <li key={f.path} className="card media-card">
                  <a href={f.url} target="_blank" rel="noreferrer" className="media-card-img" aria-label={`Open ${f.name} in a new tab`}>
                    <img src={f.url} alt="" loading="lazy" />
                  </a>
                  <div className="small">
                    <div className="media-name" title={f.path}>
                      {f.path}
                    </div>
                    <div className="muted">
                      {formatBytes(f.size)}
                      {f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => copy(f.url)}>
                      Copy link
                    </button>
                    <button type="button" className="btn btn-ghost danger-text" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="muted small" style={{ marginTop: 24 }}>
        Tip: to change a photo on the site, open the right section under <Link to="/palace/website">Website</Link> and use “Choose from library”.
      </p>
      {toast.node}
    </>
  );
}
