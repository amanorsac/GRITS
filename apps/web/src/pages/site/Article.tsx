import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArticleBody } from '../../components/richtext';
import { Loading } from '../../components/ui';
import { longDate, type Article as ArticleRow } from '../../lib/site';
import { sb } from '../../lib/supabase';
import { SiteShell } from './Shell';

/** The article itself — shared with the Journal editor's live preview. */
export function ArticleView({ a }: { a: Pick<ArticleRow, 'title' | 'tag' | 'excerpt' | 'body' | 'cover_url' | 'author' | 'published_at' | 'created_at'> }) {
  return (
    <article className="article">
      <header className="page-hero article-hero">
        <div className="page-hero-inner article-inner">
          <p className="eyebrow eyebrow-line">{a.tag || 'Journal'}</p>
          <h1>{a.title || 'Untitled article'}</h1>
          <p className="article-meta">
            {a.author && <span>By {a.author}</span>}
            {a.author && (a.published_at || a.created_at) && <span aria-hidden="true"> · </span>}
            <time dateTime={a.published_at ?? a.created_at}>{longDate(a.published_at ?? a.created_at)}</time>
          </p>
        </div>
      </header>
      {a.cover_url && (
        <div className="article-inner article-cover">
          <img src={a.cover_url} alt="" decoding="async" />
        </div>
      )}
      <div className="section" style={{ paddingTop: a.cover_url ? 32 : undefined }}>
        <div className="article-inner">
          {a.body.trim() ? (
            <ArticleBody text={a.body} />
          ) : (
            <div className="prose">
              {a.excerpt && <p className="article-lead">{a.excerpt}</p>}
              <p className="notice">Full article coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Article() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<{ slug: string; article: ArticleRow | null; error?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    sb()
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        const a = data as ArticleRow | null;
        const visible = a && (!a.published_at || new Date(a.published_at).getTime() <= Date.now()) ? a : null;
        setState({ slug, article: visible, error: error?.message });
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const current = state?.slug === slug ? state : null;

  return (
    <SiteShell title={current?.article?.title ?? 'Journal'}>
      {!current && (
        <div className="section">
          <div className="article-inner">
            <Loading lines={6} />
          </div>
        </div>
      )}
      {current?.article && <ArticleView a={current.article} />}
      {current && !current.article && (
        <div className="section">
          <div className="article-inner">
            <h1>{current.error ? 'This article could not be loaded' : 'Article not found'}</h1>
            <p className="muted">{current.error ? 'Please try again in a moment.' : 'It may have moved or not been published yet.'}</p>
          </div>
        </div>
      )}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="article-inner">
          <Link to="/journal" className="btn btn-secondary">
            ← All articles
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
