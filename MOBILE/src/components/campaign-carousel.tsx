'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpenText, ChevronRight, Pause, Play, Store, type LucideIcon } from 'lucide-react';
import type { CampaignArt, CampaignTheme } from '@silk/shared';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

export interface CampaignSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  theme: CampaignTheme;
  art: CampaignArt;
  /** Foto ilustrasi (dipilih di server); null = ikon. */
  image: string | null;
}

const THEMES: Record<CampaignTheme, { card: string; cta: string; blob: string }> = {
  mint: { card: 'bg-mint text-mint-ink', cta: 'bg-mint-ink text-white', blob: 'bg-white/45' },
  sky: { card: 'bg-sky text-sky-ink', cta: 'bg-sky-ink text-white', blob: 'bg-white/45' },
  peach: { card: 'bg-peach text-peach-ink', cta: 'bg-peach-ink text-white', blob: 'bg-white/45' },
  lilac: { card: 'bg-lilac text-lilac-ink', cta: 'bg-lilac-ink text-white', blob: 'bg-white/45' },
  lemon: { card: 'bg-lemon text-lemon-ink', cta: 'bg-lemon-ink text-white', blob: 'bg-white/50' },
  ink: { card: 'bg-primary-800 text-white', cta: 'bg-white text-primary-800', blob: 'bg-white/10' },
};

const ICONS: Partial<Record<CampaignArt, LucideIcon>> = { partner: Store, guide: BookOpenText };

const INTERVAL_MS = 5000;

/**
 * Banner campaign SILK yang bisa digeser (scroll-snap, banner berikutnya mengintip di kanan).
 * Berganti otomatis tiap 5 detik; berhenti saat disentuh, disorot kursor, difokus, tab disembunyikan,
 * atau pengguna memilih "hentikan". Tidak berganti otomatis bila pengguna meminta gerak dikurangi.
 */
export function CampaignCarousel({ slides }: { slides: CampaignSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hold, setHold] = useState(false);
  // Anggap gerak dikurangi sampai preferensi terbaca di klien: tidak ada pergantian sebelum hidrasi.
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const n = slides.length;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    const vis = () => setHidden(document.hidden);
    sync();
    mq.addEventListener('change', sync);
    document.addEventListener('visibilitychange', vis);
    return () => {
      mq.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  // Indikator mengikuti banner yang paling terlihat, termasuk saat digeser jari.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setIndex(items.indexOf(e.target as HTMLElement));
      },
      { root: el, threshold: 0.6 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [n]);

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      const item = el?.children[i] as HTMLElement | undefined;
      if (!el || !item) return;
      el.scrollTo({ left: item.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced],
  );

  const playing = n > 1 && !stopped && !reduced;
  useEffect(() => {
    if (!playing || hold || hidden) return;
    const id = window.setTimeout(() => goTo((index + 1) % n), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [playing, hold, hidden, index, n, goTo]);

  if (n === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.campaign.label}
      data-campaigns
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHold(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHold(false)}
      onTouchStart={() => setHold(true)}
      onTouchEnd={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
    >
      <div
        ref={track}
        aria-live={playing ? 'off' : 'polite'}
        className="no-scrollbar relative flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4"
      >
        {slides.map((s, i) => {
          const theme = THEMES[s.theme];
          const Icon = ICONS[s.art];
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={t.campaign.slide(i + 1, n)}
              data-campaign={s.id}
              className="w-[86%] shrink-0 snap-start"
            >
              <Link
                href={s.href}
                className={cn('tap relative flex h-full min-h-44 flex-col overflow-hidden rounded-3xl p-4 no-underline', theme.card)}
              >
                <span aria-hidden="true" className={cn('absolute -top-10 -right-8 size-32 rounded-full', theme.blob)} />
                {s.image ? (
                  <img
                    src={s.image}
                    alt=""
                    className="absolute -right-5 -bottom-5 size-32 rounded-full border-4 border-white/80 object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                ) : Icon ? (
                  <span aria-hidden="true" className={cn('absolute -right-3 -bottom-3 grid size-28 place-items-center rounded-full', theme.blob)}>
                    <Icon className="size-12" strokeWidth={1.8} />
                  </span>
                ) : null}
                <span className="relative max-w-[66%] text-[0.7rem] leading-tight font-bold tracking-wide uppercase opacity-80">{s.eyebrow}</span>
                <span className="relative mt-1.5 max-w-[66%] text-lg leading-snug font-bold">{s.title}</span>
                <span className="relative mt-1 mb-3 line-clamp-2 max-w-[62%] text-xs leading-snug opacity-85">{s.body}</span>
                <span className={cn('relative mt-auto inline-flex items-center gap-0.5 self-start rounded-full py-1.5 pr-2.5 pl-3.5 text-xs font-bold', theme.cta)}>
                  {s.cta}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="mt-2 flex items-center justify-between px-3">
          <div className="flex items-center">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={t.campaign.goTo(i + 1)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="grid h-6 place-items-center px-1"
              >
                <span className={cn('block h-1.5 rounded-full transition-all duration-300', i === index ? 'w-5 bg-primary-600' : 'w-1.5 bg-line-strong')} />
              </button>
            ))}
          </div>
          {!reduced && (
            <button
              type="button"
              onClick={() => setStopped((v) => !v)}
              aria-label={stopped ? t.campaign.play : t.campaign.pause}
              className="grid size-8 place-items-center rounded-full text-muted hover:text-ink"
            >
              {stopped ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
