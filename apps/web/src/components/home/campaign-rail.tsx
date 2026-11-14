'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Campaign, CampaignTheme } from '@silk/shared';
import { cn } from '@/lib/cn';
import { CAMPAIGN_PHOTOS, photoSrc } from '@/lib/photos';
import { t } from '@/messages/id';

const THEMES: Record<CampaignTheme, { card: string; cta: string }> = {
  mint: { card: 'bg-mint text-mint-ink', cta: 'bg-mint-ink text-white' },
  sky: { card: 'bg-sky text-sky-ink', cta: 'bg-sky-ink text-white' },
  peach: { card: 'bg-peach text-peach-ink', cta: 'bg-peach-ink text-white' },
  lilac: { card: 'bg-lilac text-lilac-ink', cta: 'bg-lilac-ink text-white' },
  lemon: { card: 'bg-lemon text-lemon-ink', cta: 'bg-lemon-ink text-white' },
  ink: { card: 'bg-primary-800 text-white', cta: 'bg-white text-primary-800' },
};


/**
 * Banner campaign SILK di beranda desktop: deret geser dengan tombol sebelumnya/berikutnya.
 * Tidak berganti otomatis (beberapa banner sudah terlihat sekaligus). Campaign adalah konten SILK sendiri,
 * bukan promo berbayar, dan tidak memengaruhi urutan hasil.
 */
export function CampaignRail({ campaigns }: { campaigns: Campaign[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  if (campaigns.length === 0) return null;
  const h = t.home;

  return (
    <section aria-labelledby="info-silk" className="mt-10" data-campaigns>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="info-silk" className="m-0">
          {h.campaignsTitle}
        </h2>
        <div className="flex gap-2">
          {([-1, 1] as const).map((dir) => {
            const Icon = dir < 0 ? ChevronLeft : ChevronRight;
            const disabled = dir < 0 ? edge.start : edge.end;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => page(dir)}
                disabled={disabled}
                aria-controls="info-silk-track"
                aria-label={dir < 0 ? h.campaignsPrev : h.campaignsNext}
                className="grid size-10 place-items-center rounded-full border border-line bg-white text-ink shadow-soft transition-colors hover:border-primary-200 hover:text-primary-700 disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
              >
                <Icon className="size-5" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      <ul
        ref={track}
        id="info-silk-track"
        onScroll={sync}
        className="m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto p-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {campaigns.map((c) => {
          const theme = THEMES[c.theme];
          return (
            <li key={c.id} data-campaign={c.id} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
              <Link
                href={c.href.web}
                className={cn(
                  'group flex h-full flex-col overflow-hidden rounded-[1.75rem] no-underline shadow-soft transition-[transform,box-shadow] duration-300 ease-soft hover:-translate-y-0.5 hover:no-underline hover:shadow-lift',
                  theme.card,
                )}
              >
                <span className="relative block h-40 overflow-hidden">
                  <img
                    src={photoSrc(CAMPAIGN_PHOTOS[c.art], 'wide')}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.03]"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-ink shadow-soft">{c.eyebrow}</span>
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-lg leading-snug font-bold">{c.title}</span>
                  <span className="mt-1 mb-4 text-sm leading-snug opacity-85">{c.body}</span>
                  <span className={cn('mt-auto inline-flex items-center gap-1 self-start rounded-full px-4 py-2 text-sm font-bold', theme.cta)}>
                    {c.cta}
                    <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
