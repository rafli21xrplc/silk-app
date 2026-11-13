'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { priceRangeText } from '@/lib/format';
import { normalizeTerm } from '@/lib/search';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { categoryTone, IconTile, serviceIcon } from './service-icon';

export interface CatalogItem {
  slug: string;
  name: string;
  aliases: string[];
  category: { slug: string; name: string };
  minPrice: number | null;
  maxPrice: number | null;
  facilityCount: number;
}

/** Katalog layanan: cari di nama/alias, saring kategori, harga per layanan langsung terlihat. */
export function ServiceCatalog({ items, categories, initialCategory }: { items: CatalogItem[]; categories: { slug: string; name: string }[]; initialCategory: string }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(categories.some((c) => c.slug === initialCategory) ? initialCategory : '');
  const term = normalizeTerm(q);
  const shown = useMemo(
    () =>
      items.filter(
        (s) => (!cat || s.category.slug === cat) && (!term || normalizeTerm(`${s.name} ${s.aliases.join(' ')} ${s.category.name}`).includes(term)),
      ),
    [items, cat, term],
  );

  return (
    <>
      <div className="sticky top-0 z-20 grid gap-2.5 border-b border-line/60 bg-canvas/95 px-4 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{t.services.searchPlaceholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.services.searchPlaceholder}
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl border border-line bg-white pr-4 pl-12 text-[0.95rem] shadow-soft outline-none placeholder:text-muted focus:border-primary-400"
          />
        </label>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t.search.category}>
          {[{ slug: '', name: t.services.all }, ...categories].map((c) => (
            <button
              key={c.slug || 'semua'}
              type="button"
              aria-pressed={cat === c.slug}
              onClick={() => setCat(c.slug)}
              className={cn(
                'tap h-9 shrink-0 rounded-full border px-3.5 text-[0.8rem] font-semibold',
                cat === c.slug ? 'border-primary-600 bg-primary-600 text-white' : 'border-line bg-white text-ink-soft',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="pt-4">
          <Empty text={t.services.none} />
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-2.5 px-4 pt-4">
          {shown.map((s) => {
            const range = priceRangeText(s.minPrice, s.maxPrice);
            return (
              <li key={s.slug}>
                <Link href={`/layanan/${s.slug}`} className="tap flex items-center gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-ink no-underline shadow-soft" data-service>
                  <IconTile icon={serviceIcon(s.slug)} tone={categoryTone(s.category.slug)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-semibold">{s.name}</span>
                    {range ? (
                      <span className="block text-[0.85rem] font-bold tabular-nums">{range}</span>
                    ) : (
                      <span className="block text-[0.8rem] text-muted">{t.services.noPrice}</span>
                    )}
                    <span className="block text-[0.72rem] text-muted">
                      {s.category.name}
                      {s.facilityCount > 0 && ` · ${t.services.facilities(s.facilityCount)}`}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
