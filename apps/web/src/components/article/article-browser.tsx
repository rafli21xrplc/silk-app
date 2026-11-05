'use client';

import { Search, SearchX, X } from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import type { ArticleSummary } from '@/lib/sanity';
import { matchesQuery } from '@/lib/search-text';
import { t } from '@/messages/id';
import { ArticleCard, FeaturedArticle } from './article-card';

/** Cari judul/deskripsi artikel di browser (daftar maksimal 50, sudah dikirim server). */
export function filterArticles(articles: ArticleSummary[], query: string): ArticleSummary[] {
  return articles.filter((a) => matchesQuery(`${a.title} ${a.description}`, query));
}

/**
 * Daftar artikel: artikel terbaru ditonjolkan, sisanya grid. Saat mencari, semua hasil tampil sebagai grid.
 * Tanpa JS, semua kartu tetap ter-render dari server (kolom cari hanya penyempurnaan).
 */
export function ArticleBrowser({ articles }: { articles: ArticleSummary[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const results = filterArticles(articles, deferred);
  const searching = deferred !== '';
  const [featured, ...rest] = results;
  const inputId = useId();

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={inputId} className="sr-only">
            {t.articles.searchLabel}
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.articles.searchPlaceholder}
            maxLength={80}
            className="w-full rounded-full border-line bg-white py-3 pr-11 pl-11 shadow-soft [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">{t.articles.clearSearch}</span>
            </button>
          )}
        </div>
        <p className="m-0 text-sm text-muted" aria-live="polite">
          {searching
            ? t.articles.results(results.length, deferred)
            : t.articles.count(articles.length)}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t.articles.noResultsTitle}
          action={
            <button
              type="button"
              className={buttonVariants({ variant: 'soft', size: 'sm' })}
              onClick={() => setQuery('')}
            >
              {t.articles.clearSearch}
            </button>
          }
        >
          {t.articles.noResults}
        </EmptyState>
      ) : searching ? (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((a) => (
            <li key={a.slug} className="animate-rise">
              <ArticleCard article={a} headingLevel="h2" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {featured && <FeaturedArticle article={featured} />}
          {rest.length > 0 && (
            <ul className="m-0 mt-6 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <li key={a.slug}>
                  <ArticleCard article={a} headingLevel="h2" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
