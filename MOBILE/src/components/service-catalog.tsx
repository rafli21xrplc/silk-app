'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { categoryPhoto } from '@/demo/photos';
import { cn } from '@/lib/cn';
import type { CityRange } from '@/lib/range';
import { normalizeTerm } from '@/lib/search';
import { t } from '@/messages/id';
import { Empty } from './empty';
import { ServiceCard } from './service-card';

export interface CatalogItem {
  slug: string;
  name: string;
  aliases: string[];
  category: { slug: string; name: string };
  minPrice: number | null;
  maxPrice: number | null;
  facilityCount: number;
  cities: CityRange[];
}

type Category = { slug: string; name: string; count: number };

/**
 * Katalog layanan: ubin kategori berfoto sebagai saringan, lalu kartu harga 2 kolom per kategori.
 * Layanan tanpa harga diringkas menjadi satu baris tautan per kategori, bukan baris "Belum ada" berulang.
 */
export function ServiceCatalog({ items, categories, initialCategory }: { items: CatalogItem[]; categories: Category[]; initialCategory: string }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(categories.some((c) => c.slug === initialCategory) ? initialCategory : '');
  const term = normalizeTerm(q);
  const shown = useMemo(
    () =>
      items.filter((s) => (!cat || s.category.slug === cat) && (!term || normalizeTerm(`${s.name} ${s.aliases.join(' ')} ${s.category.name}`).includes(term))),
    [items, cat, term],
  );
  // Tanpa saringan: dikelompokkan per kategori (urutan dari server). Dengan saringan/kata kunci: satu kelompok.
  const groups =
    cat || term
      ? [{ slug: '', name: '', items: shown }]
      : categories.map((c) => ({ ...c, items: shown.filter((s) => s.category.slug === c.slug) })).filter((g) => g.items.length > 0);
  const tiles = [{ slug: '', name: t.services.all, count: items.length }, ...categories];
  // Tautan ?kategori=…: geser ubin terpilih ke layar (hanya horizontal, halaman tidak ikut bergulir).
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rail.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed=true]');
    if (el && on && on.offsetLeft + on.offsetWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - 16;
    // Hanya saat dimuat; pilihan berikutnya sudah terlihat karena diketuk pengguna.
  }, []);

  return (
    <>
      <div className="pt-safe sticky top-0 z-20 border-b border-line/60 bg-canvas/95 px-4 py-3 backdrop-blur">
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
      </div>

      <div ref={rail} className="no-scrollbar mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1" role="group" aria-label={t.search.category}>
        {tiles.map((c) => {
          const photo = categoryPhoto(c.slug);
          const on = cat === c.slug;
          return (
            <button
              key={c.slug || 'semua'}
              type="button"
              aria-pressed={on}
              data-category={c.slug || 'semua'}
              onClick={() => setCat(c.slug)}
              className="w-[5.75rem] shrink-0 snap-start text-left"
            >
              <span
                className={cn(
                  'relative grid h-16 place-items-center overflow-hidden rounded-xl transition-shadow',
                  photo ? 'bg-surface-2' : on ? 'bg-ink text-white' : 'bg-white text-ink',
                  on ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : '',
                )}
              >
                {photo ? (
                  <img src={photo.square} alt="" className="absolute inset-0 size-full object-cover" decoding="async" />
                ) : (
                  <span className="text-xl font-bold tabular-nums">{c.count}</span>
                )}
              </span>
              <span className={cn('mt-1.5 line-clamp-2 block text-xs leading-tight', on ? 'font-bold text-ink' : 'font-medium text-ink-soft')}>
                {c.slug ? (t.quick[c.slug] ?? c.name) : c.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="m-0 px-5 pt-2 text-xs text-muted">{t.services.spreadLegend}</p>

      {shown.length === 0 ? (
        <div className="pt-4">
          <Empty text={t.services.none} />
        </div>
      ) : (
        groups.map((g, i) => {
          const priced = g.items.filter((s) => s.minPrice !== null);
          const unpriced = g.items.filter((s) => s.minPrice === null);
          const id = `kategori-${g.slug || 'hasil'}`;
          return (
            <section key={id} aria-labelledby={g.name ? id : undefined} className={i === 0 ? 'mt-5' : 'mt-7'}>
              {g.name && (
                <div className="flex items-baseline justify-between gap-3 px-5 pb-2.5">
                  <h3 id={id} className="m-0 text-base font-bold">
                    {g.name}
                  </h3>
                  <span className="text-xs text-muted">{t.home.serviceTotal(g.items.length)}</span>
                </div>
              )}
              {priced.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-2 gap-3 px-4 py-0">
                  {priced.map((s, j) => {
                    // Jumlah ganjil: kartu terakhir melebar agar tidak ada sel kosong di grid.
                    const wide = priced.length % 2 === 1 && j === priced.length - 1;
                    return (
                      <li key={s.slug} className={cn('flex', wide && 'col-span-2')} data-service>
                        <ServiceCard service={s} wide={wide} className="w-full" />
                      </li>
                    );
                  })}
                </ul>
              )}
              {unpriced.length > 0 && (
                <div className={cn('mx-4 rounded-2xl border border-dashed border-line-strong px-4 py-3', priced.length > 0 && 'mt-3')}>
                  <p className="m-0 text-xs font-semibold text-muted">{t.services.noPriceTitle(unpriced.length)}</p>
                  <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-1 gap-y-1 p-0 text-sm">
                    {unpriced.map((s, j) => (
                      <li key={s.slug} data-service>
                        <Link href={`/layanan/${s.slug}`} className="text-ink-soft underline decoration-line-strong underline-offset-4">
                          {s.name}
                        </Link>
                        {j < unpriced.length - 1 && <span className="text-muted"> · </span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
