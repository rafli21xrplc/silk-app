'use client';

import { Search, SearchX, X } from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { filterCatalog, groupByCategory, type CatalogItem } from '@/lib/service-summary';
import { t } from '@/messages/id';
import { ServiceCard } from './service-card';
import { categoryIcon, categoryTone, IconTile } from './service-visual';

/**
 * Katalog layanan: kolom cari + chip kategori, hasil dikelompokkan per kategori.
 * Tanpa JS, semua kartu tetap ter-render dari server (cari dan saring hanya penyempurnaan).
 */
export function ServiceCatalog({ services }: { services: CatalogItem[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const deferred = useDeferredValue(query.trim());
  const results = filterCatalog(services, deferred, category);
  const groups = groupByCategory(results);
  const categories = groupByCategory(services);
  const filtering = deferred !== '' || category !== '';
  const inputId = useId();
  const reset = () => {
    setQuery('');
    setCategory('');
  };

  const chip = (slug: string, label: string, count: number) => {
    const active = category === slug;
    const Icon = slug ? categoryIcon(slug) : null;
    return (
      <button
        key={slug || 'semua'}
        type="button"
        aria-pressed={active}
        onClick={() => setCategory(slug)}
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-full border py-2 pr-2 pl-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
          active
            ? 'border-primary-700 bg-primary-700 text-white shadow-soft'
            : 'border-line bg-white text-ink-soft hover:border-primary-200 hover:bg-primary-50 hover:text-ink',
        )}
      >
        {Icon && <Icon className="size-4" aria-hidden="true" />}
        {label}
        <span
          className={cn(
            'min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums',
            active ? 'bg-white/20 text-white' : 'bg-surface-2 text-muted',
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="mb-8 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-sm">
            <label htmlFor={inputId} className="sr-only">
              {t.services.searchLabel}
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
              placeholder={t.services.searchPlaceholder}
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
                <span className="sr-only">{t.services.clearSearch}</span>
              </button>
            )}
          </div>
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {filtering ? t.services.results(results.length) : t.services.count(services.length)}
          </p>
        </div>
        {categories.length > 1 && (
          // Ponsel: chip digeser horizontal.
          <div
            role="group"
            aria-label={t.services.filterLabel}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {chip('', t.services.all, services.length)}
            {categories.map((c) => chip(c.slug, c.name, c.items.length))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t.services.noResultsTitle}
          action={
            <button type="button" className={buttonVariants({ variant: 'soft', size: 'sm' })} onClick={reset}>
              {t.services.resetFilters}
            </button>
          }
        >
          {t.services.noResults}
        </EmptyState>
      ) : (
        <div className="grid gap-12">
          {groups.map((g) => (
            <section key={g.slug} aria-labelledby={`kat-${g.slug}`} className="animate-rise">
              <div className="mb-5 flex items-center gap-3">
                <IconTile icon={categoryIcon(g.slug)} tone={categoryTone(g.slug)} size="sm" />
                <h2 id={`kat-${g.slug}`} className="m-0 text-xl">
                  {g.name}
                </h2>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold text-muted tabular-nums">
                  {g.items.length}
                </span>
                <span aria-hidden="true" className="ml-1 h-px flex-1 bg-line" />
              </div>
              <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <ServiceCard service={s} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
