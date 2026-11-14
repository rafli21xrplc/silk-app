'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BedDouble, BookOpenText, ChevronLeft, ChevronRight, ClipboardPlus, FlaskConical, Stethoscope, Store, type LucideIcon } from 'lucide-react';
import type { Campaign, CampaignArt, CampaignTheme } from '@silk/shared';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

const THEMES: Record<CampaignTheme, { card: string; cta: string; blob: string }> = {
  mint: { card: 'bg-mint text-mint-ink', cta: 'bg-mint-ink text-white', blob: 'bg-white/55' },
  sky: { card: 'bg-sky text-sky-ink', cta: 'bg-sky-ink text-white', blob: 'bg-white/55' },
  peach: { card: 'bg-peach text-peach-ink', cta: 'bg-peach-ink text-white', blob: 'bg-white/55' },
  lilac: { card: 'bg-lilac text-lilac-ink', cta: 'bg-lilac-ink text-white', blob: 'bg-white/55' },
  lemon: { card: 'bg-lemon text-lemon-ink', cta: 'bg-lemon-ink text-white', blob: 'bg-white/60' },
  ink: { card: 'bg-primary-800 text-white', cta: 'bg-white text-primary-800', blob: 'bg-white/10' },
};

const ART: Record<CampaignArt, LucideIcon> = {
  lab: FlaskConical,
  mcu: ClipboardPlus,
  doctor: Stethoscope,
  hospital: BedDouble,
  partner: Store,
  guide: BookOpenText,
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
          const Icon = ART[c.art];
          return (
            <li key={c.id} data-campaign={c.id} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
              <Link
                href={c.href.web}
                className={cn(
                  'group relative flex h-full min-h-52 flex-col overflow-hidden rounded-[1.75rem] p-6 no-underline transition-transform duration-300 ease-soft hover:-translate-y-0.5 hover:no-underline',
                  theme.card,
                )}
              >
                <span aria-hidden="true" className={cn('absolute -top-12 -right-10 size-40 rounded-full', theme.blob)} />
                <span aria-hidden="true" className={cn('absolute -right-4 -bottom-6 grid size-32 place-items-center rounded-full', theme.blob)}>
                  <Icon className="size-14" strokeWidth={1.6} />
                </span>
                <span className="relative max-w-[75%] text-xs font-bold tracking-wide uppercase opacity-80">{c.eyebrow}</span>
                <span className="relative mt-2 max-w-[78%] text-xl leading-snug font-bold">{c.title}</span>
                <span className="relative mt-1.5 mb-5 max-w-[70%] text-sm leading-snug opacity-85">{c.body}</span>
                <span className={cn('relative mt-auto inline-flex items-center gap-1 self-start rounded-full px-4 py-2 text-sm font-bold', theme.cta)}>
                  {c.cta}
                  <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
