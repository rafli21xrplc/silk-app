import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Receipt } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { JsonLd } from '@/components/json-ld';
import { CityPriceCard } from '@/components/service/city-price-card';
import { categoryTone, IconTile, serviceIcon } from '@/components/service/service-visual';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { absoluteUrl } from '@/lib/seo';
import { priceRangeText, summarizeCities } from '@/lib/service-summary';
import { listServices, loadService } from '@/lib/services';
import { t } from '@/messages/id';

type Params = Promise<{ slug: string }>;
export const revalidate = 3600;

/** Tidak ada prerender saat build; halaman dibuat saat diminta pertama kali lalu di-cache (ISR). */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await loadService((await params).slug);
  if (!s) return { title: t.notFound.title, robots: { index: false } };
  const cities = s.cities.map((c) => c.city).join(', ');
  return {
    title: `Tarif ${s.name}${cities ? ` di ${cities}` : ''}`,
    description: `${s.description ?? s.name}. Ringkasan rentang harga per wilayah dengan tanggal verifikasi.`,
    alternates: { canonical: `/layanan/${s.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [s, all] = await Promise.all([loadService(slug), listServices().catch(() => [])]);
  if (!s) notFound();

  const tone = categoryTone(s.category.slug);
  const summary = summarizeCities(s.cities);
  const overall = priceRangeText(summary.minPrice, summary.maxPrice);
  const scale =
    summary.minPrice !== null ? { min: summary.minPrice, max: summary.maxPrice ?? summary.minPrice } : null;
  const related = all.filter((x) => x.category.slug === s.category.slug && x.slug !== s.slug).slice(0, 4);
  const facts = [
    { label: t.services.facilitiesWithTariff, value: String(summary.facilityCount) },
    { label: t.services.cities, value: String(summary.cityCount) },
  ];

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { name: 'Beranda', path: '/' },
          { name: t.nav.services, path: '/layanan' },
          { name: s.name, path: `/layanan/${s.slug}` },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MedicalProcedure',
          name: s.name,
          url: absoluteUrl(`/layanan/${s.slug}`),
          ...(s.description ? { description: s.description } : {}),
          ...(s.aliases.length ? { alternateName: s.aliases } : {}),
        }}
      />

      {/* Kepala: warna mengikuti kategori; panel ringkasan di kanan (desktop) atau di bawah (ponsel). */}
      <header
        className={cn(
          'relative isolate mb-10 grid items-center gap-8 overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br via-white to-canvas px-6 py-8 shadow-soft sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_360px]',
          tone.from,
        )}
      >
        <span aria-hidden="true" className="absolute -top-20 -right-16 -z-10 size-72 rounded-full bg-white/60 blur-2xl" />
        <span
          aria-hidden="true"
          className={cn('absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full opacity-70 blur-3xl', tone.bg)}
        />
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <IconTile icon={serviceIcon(s.slug)} tone={tone} size="lg" className="shadow-soft ring-4 ring-white/70" />
            <span className="rounded-full bg-white/85 px-3.5 py-1.5 text-sm font-semibold text-ink-soft shadow-soft backdrop-blur">
              {s.category.name}
            </span>
          </div>
          <h1 className="mb-3 text-[clamp(1.9rem,1.3rem+2.4vw,2.9rem)] leading-[1.1] font-extrabold tracking-[-0.03em]">
            {s.name}
          </h1>
          {s.description && <p className="m-0 max-w-2xl text-lg text-ink-soft">{s.description}</p>}
          {s.aliases.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{t.services.aliases}</span>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {s.aliases.map((a) => (
                  <li key={a} className="rounded-full border border-line bg-white/80 px-2.5 py-0.5 font-medium text-ink-soft">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {s.cities.length > 0 && (
          <div className="rounded-card border border-white bg-white/85 p-5 shadow-soft backdrop-blur sm:p-6">
            <p className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">{t.services.overall}</p>
            <p className="m-0 mt-1 text-[clamp(1.35rem,1.15rem+0.8vw,1.75rem)] leading-tight font-extrabold tracking-[-0.01em] text-ink tabular-nums">
              {overall ?? <span className="text-lg font-semibold text-muted">{t.price.ask}</span>}
            </p>
            <dl className="m-0 mt-5 grid grid-cols-2 gap-2.5 border-t border-line pt-4">
              {facts.map((f) => (
                <div key={f.label} className="flex min-w-0 flex-col justify-between gap-1 rounded-2xl bg-surface/70 px-3.5 py-2.5">
                  <dt className="text-xs leading-snug text-muted">{f.label}</dt>
                  <dd className="m-0 text-lg font-bold text-ink tabular-nums">{f.value}</dd>
                </div>
              ))}
              <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1 pt-1 text-sm">
                <dt className="text-muted">{t.services.latest}</dt>
                <dd className="m-0 font-semibold text-ink">{formatDate(summary.latestVerifiedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </header>

      <section aria-labelledby="ringkasan-wilayah">
        <h2 id="ringkasan-wilayah" className="mb-1">
          {t.services.cityTable}
        </h2>
        <p className="m-0 text-muted">{t.services.cityHint}</p>
        <DisclaimerBanner />
        {s.cities.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t.services.noneTitle}
            action={
              <Link href="/cari" className={buttonVariants({ variant: 'soft', size: 'sm' })}>
                {t.services.noneAction}
              </Link>
            }
          >
            {t.services.none}
          </EmptyState>
        ) : (
          <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2">
            {s.cities.map((c) => (
              <li key={c.city} className="animate-rise">
                <CityPriceCard serviceSlug={s.slug} city={c} scale={scale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section aria-labelledby="layanan-terkait" className="mt-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="layanan-terkait" className="m-0 text-xl">
              {t.services.related(s.category.name)}
            </h2>
            <Link
              href="/layanan"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline"
            >
              {t.services.allServices} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/layanan/${r.slug}`}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-line/80 bg-white p-4 text-ink no-underline shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
                >
                  <IconTile icon={serviceIcon(r.slug)} tone={tone} size="sm" />
                  <span className="min-w-0 flex-1 leading-snug font-semibold">{r.name}</span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-primary-600 transition-transform duration-300 ease-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
