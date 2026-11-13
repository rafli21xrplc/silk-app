'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { priceRangeShort } from '@/lib/format';
import { normalizeTerm } from '@/lib/search';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { ListGroup, ListRow } from './list';

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
  // Tanpa saringan: dikelompokkan per kategori (urutan dari server). Dengan saringan/kata kunci: satu daftar.
  const groups =
    cat || term
      ? [{ slug: '', name: '', items: shown }]
      : categories.map((c) => ({ ...c, items: shown.filter((s) => s.category.slug === c.slug) })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="pt-safe sticky top-0 z-20 grid gap-2.5 border-b border-line/60 bg-canvas/95 px-4 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{t.services.searchPlaceholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.services.searchPlaceholder}
            enterKeyHint="search"
            className="h-12 w-full rounded-xl border border-line bg-white pr-4 pl-12 text-base outline-none placeholder:text-muted focus:border-primary-400"
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
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                cat === c.slug ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft active:bg-surface',
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
        groups.map((g, i) => (
          <ListGroup
            key={g.slug || 'hasil'}
            id={`kategori-${g.slug || 'hasil'}`}
            level={3}
            title={g.name || undefined}
            aside={g.name ? <span className="text-xs text-muted">{g.items.length}</span> : undefined}
            className={i === 0 ? 'mt-4' : 'mt-6'}
          >
            {g.items.map((s) => {
              const range = priceRangeShort(s.minPrice, s.maxPrice);
              return (
                <ListRow
                  key={s.slug}
                  marker="service"
                  href={`/layanan/${s.slug}`}
                  chevron={false}
                  title={s.name}
                  sub={s.facilityCount > 0 ? t.services.facilities(s.facilityCount) : undefined}
                  trailing={
                    range ? <span className="text-base font-semibold tabular-nums">{range}</span> : <span className="text-sm text-muted">{t.services.noPriceShort}</span>
                  }
                />
              );
            })}
          </ListGroup>
        ))
      )}
    </>
  );
}
