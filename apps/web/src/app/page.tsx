import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardCheck,
  Droplets,
  FileText,
  FlaskConical,
  HeartPulse,
  MapPin,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { HeroGlow } from '@/components/motion/hero-glow';
import { Reveal } from '@/components/motion/reveal';
import { SearchBar } from '@/components/search-bar';
import { serviceIcon } from '@/components/service/service-visual';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ServiceListItem } from '@/lib/types';
import { t } from '@/messages/id';

export const revalidate = 3600;

const TRUST_ICONS = [CalendarCheck2, FileText, ShieldCheck];
const CITIES = [
  { name: 'Kota Malang', slug: 'kota-malang', tone: 'bg-mint text-mint-ink' },
  { name: 'Kabupaten Malang', slug: 'kabupaten-malang', tone: 'bg-sky text-sky-ink' },
];

/** Warna pastel ubin bergiliran; pasangan teks/latar lolos AA. */
const TONES = ['bg-mint text-mint-ink', 'bg-sky text-sky-ink', 'bg-peach text-peach-ink', 'bg-lilac text-lilac-ink', 'bg-lemon text-lemon-ink'];


export default async function HomePage() {
  const services = await apiGet<ServiceListItem[]>('/services?limit=12', { tags: ['services'] })
    .then((r) => r.data)
    .catch(() => [] as ServiceListItem[]);
  return (
    <>
      {/* Hero: panel pastel. Judul tidak dianimasikan (elemen LCP); elemen pendukung naik halus lewat CSS. */}
      <section className="container -mt-2 sm:-mt-4">
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#eef7f8] to-sky px-5 pt-10 pb-8 shadow-soft sm:rounded-[2.5rem] sm:px-10 sm:pt-16 sm:pb-12 lg:px-16">
          <HeroGlow />
          <div className="max-w-2xl lg:max-w-[600px]">
            <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-primary-800 shadow-soft backdrop-blur">
              <MapPin className="size-4" aria-hidden="true" />
              {t.home.eyebrow}
            </p>
            <h1 className="text-[clamp(2rem,1.3rem+3.2vw,3.25rem)] leading-[1.08] font-extrabold tracking-[-0.035em]">{t.home.heroTitle}</h1>
            <p className="mt-3 max-w-2xl animate-rise text-[1.02rem] text-ink-soft [animation-delay:80ms] sm:text-lg">{t.home.heroBody}</p>
          </div>
          <div className="relative z-10 mt-7 max-w-3xl animate-rise [animation-delay:160ms]">
            <SearchBar variant="hero" />
          </div>
          <HeroArt />
        </div>
      </section>

      <div className="container">
        {services.length > 0 && (
          <section aria-labelledby="pemeriksaan" className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="pemeriksaan" className="mt-0 mb-1">
                  {t.categories.title}
                </h2>
                <p className="m-0 text-muted">{t.categories.hint}</p>
              </div>
              <Link href="/layanan" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline">
                {t.nav.services} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <Reveal>
              {/* Ponsel: geser horizontal; desktop: grid. */}
              <ul className="-mx-4 mt-6 flex snap-x list-none gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4">
                {services.map((s, i) => {
                  const Icon = serviceIcon(s.slug);
                  return (
                    <li key={s.slug} data-reveal className="w-[38%] shrink-0 snap-start sm:w-auto">
                      <Link
                        href={`/layanan/${s.slug}`}
                        className="group flex h-full flex-col items-center gap-3 rounded-card border border-line/80 bg-white px-3 py-5 text-center text-ink no-underline shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-1 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
                      >
                        <span className={cn('grid size-14 place-items-center rounded-2xl transition-transform duration-300 ease-soft group-hover:scale-110', TONES[i % TONES.length])}>
                          <Icon className="size-6" aria-hidden="true" />
                        </span>
                        <span className="text-[0.92rem] leading-snug font-semibold">{s.name}</span>
                        <span className="-mt-2 text-xs text-muted">{s.category.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </section>
        )}

        <Reveal className="mt-12">
          <ul className="grid list-none gap-3 p-0 md:grid-cols-3">
            {t.home.trustPoints.map((p, i) => {
              const Icon = TRUST_ICONS[i] ?? ShieldCheck;
              return (
                <li key={p.title} data-reveal className="flex items-start gap-4 rounded-card bg-white p-5 shadow-soft">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', TONES[i % TONES.length])}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-[0.92rem] text-muted">{p.body}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <section aria-labelledby="wilayah" className="mt-14">
          <h2 id="wilayah" className="mt-0 mb-1">
            {t.home.cities}
          </h2>
          <p className="text-muted">{t.home.citiesHint}</p>
          <Reveal>
            <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
              {CITIES.map((c) => (
                <li key={c.slug} data-reveal>
                  <Link
                    href={`/cari?city=${c.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-card border border-line/80 bg-white p-5 text-ink no-underline shadow-soft transition-[box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:text-ink hover:no-underline hover:shadow-lift"
                  >
                    <span className="flex items-center gap-4">
                      <span className={cn('grid size-12 place-items-center rounded-2xl', c.tone)}>
                        <MapPin className="size-5" aria-hidden="true" />
                      </span>
                      <span className="text-lg font-semibold">{c.name}</span>
                    </span>
                    <span className="grid size-9 place-items-center rounded-full bg-surface text-primary-700 transition-transform duration-300 ease-soft group-hover:translate-x-1">
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section aria-labelledby="cara" className="mt-14">
          <h2 id="cara" className="mt-0">
            {t.home.howTitle}
          </h2>
          <Reveal>
            <ol className="mt-5 grid list-none gap-3 p-0 md:grid-cols-3">
              {t.home.how.map((line, i) => (
                <li key={line} data-reveal className="relative overflow-hidden rounded-card bg-white p-6 shadow-soft">
                  <span className="absolute -top-3 -right-1 text-[5.5rem] leading-none font-extrabold text-primary-100 select-none" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="relative mt-0 mb-1.5">{t.home.howHeads[i]}</h3>
                  <p className="relative m-0 text-[0.95rem] text-muted">{line}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <Reveal className="mt-14">
          <section
            aria-labelledby="netral"
            className="flex flex-col gap-6 rounded-[2rem] bg-gradient-to-br from-primary-600 to-primary-800 p-7 text-white shadow-lift sm:flex-row sm:items-center sm:justify-between sm:p-10"
          >
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
                <Scale className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 id="netral" className="mt-0 mb-2 text-white">
                  {t.home.neutralTitle}
                </h2>
                <p className="m-0 max-w-xl text-primary-50">{t.home.neutralBody}</p>
              </div>
            </div>
            <Link
              href="/metodologi"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 font-semibold text-primary-800 no-underline transition-colors hover:bg-primary-50 hover:text-primary-900 hover:no-underline"
            >
              {t.home.methodCta} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </Reveal>
      </div>
    </>
  );
}

/** Komposisi ubin ikon melayang di sisi kanan hero (desktop). Dekoratif; disembunyikan dari pembaca layar. */
function HeroArt() {
  const tile = 'absolute grid place-items-center rounded-[1.6rem] shadow-lift ring-4 ring-white/70 animate-float';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 right-10 hidden h-[340px] w-[340px] -translate-y-[58%] lg:block xl:right-20">
      <div className={cn(tile, 'top-6 left-10 size-24 bg-mint text-mint-ink')}>
        <Droplets className="size-10" />
      </div>
      <div className={cn(tile, 'top-0 right-4 size-20 bg-sky text-sky-ink [animation-delay:-2s]')}>
        <FlaskConical className="size-9" />
      </div>
      <div className={cn(tile, 'bottom-16 left-0 size-20 bg-peach text-peach-ink [animation-delay:-4s]')}>
        <ClipboardCheck className="size-9" />
      </div>
      <div className={cn(tile, 'right-0 bottom-24 size-[4.5rem] bg-lilac text-lilac-ink [animation-delay:-1s]')}>
        <HeartPulse className="size-8" />
      </div>
      <div className="absolute bottom-0 left-24 w-[220px] animate-float rounded-3xl bg-white/95 p-4 shadow-lift [animation-delay:-3s]">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-8 place-items-center rounded-xl bg-ok-soft text-ok">
            <ShieldCheck className="size-4" />
          </span>
          {t.home.trustPoints[2]?.title}
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-full rounded-full bg-surface-2" />
          <div className="h-2 w-3/4 rounded-full bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
