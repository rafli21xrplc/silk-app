import Link from 'next/link';
import { CalendarCheck2, ChevronRight, FileText, MapPin, Scale, ShieldCheck } from 'lucide-react';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorCard } from '@/components/doctor-card';
import { EstimateChip } from '@/components/price';
import { SearchForm } from '@/components/search-form';
import { Section } from '@/components/section';
import { categoryIcon, categoryTone, IconTile, serviceIcon } from '@/components/service-icon';
import { formatShortDate, priceRangeText } from '@/lib/format';
import { HOME_PRICE_SLUGS, QUICK_LINKS } from '@/lib/home';
import { anyDemo, getArticles, getService, searchPractitioners, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

// Dinamis: banner "data demo" harus mencerminkan status API saat ini, bukan saat build.
// Respons API yang berhasil tetap di-cache 5 menit oleh fetchApi.
export const dynamic = 'force-dynamic';

const HOW_ICONS = [CalendarCheck2, FileText, ShieldCheck];

export default async function HomePage() {
  const [services, doctors, articles] = await Promise.all([
    Promise.all(HOME_PRICE_SLUGS.map((slug) => getService(slug))),
    // Dokter dengan biaya konsultasi tercantum, urut nama (bawaan). Tidak pernah memakai data pembayaran.
    searchPractitioners({ fee: '1' }, 6),
    getArticles(),
  ]);
  const prices = services
    .filter((s) => s !== null)
    .map((s) => ({ ...s.data, summary: summarizeCities(s.data.cities) }))
    .filter((s) => s.summary.minPrice !== null);

  return (
    <>
      <header className="pt-safe bg-gradient-to-b from-primary-100 via-primary-50 to-canvas px-4 pb-6">
        <div className="flex h-14 items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-primary-800">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-800 text-white shadow-soft">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12h4l3-8 4 16 3-8h4" />
              </svg>
            </span>
            {t.site.name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[0.72rem] font-semibold text-primary-800 shadow-soft">
            <MapPin className="size-3.5" aria-hidden="true" />
            {t.site.region}
          </span>
        </div>
        <h1 className="mt-3 mb-2 text-[1.75rem] leading-[1.12] font-extrabold tracking-[-0.03em]">{t.home.heroTitle}</h1>
        <p className="m-0 mb-4 text-[0.92rem] text-ink-soft">{t.home.heroBody}</p>
        <SearchForm placeholder={t.home.searchPlaceholder} />
      </header>

      <DemoNotice show={anyDemo(...services, doctors, articles)} date={snapshotDate()} />

      <Section id="kebutuhan" title={t.home.quickTitle}>
        <ul className="m-0 grid list-none grid-cols-3 gap-2.5 px-4">
          {QUICK_LINKS.map((q) => (
            <li key={q.key}>
              <Link
                href={q.href}
                className="tap flex h-full flex-col items-center gap-2 rounded-2xl border border-line/70 bg-white px-2 py-3.5 text-center text-[0.78rem] leading-tight font-semibold text-ink no-underline shadow-soft"
              >
                <IconTile icon={categoryIcon(q.key)} tone={categoryTone(q.key)} />
                {t.quick[q.key]}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {prices.length > 0 && (
        <Section id="biaya" title={t.home.pricesTitle} hint={t.home.pricesHint} href="/layanan">
          <ul className="no-scrollbar m-0 flex snap-x snap-mandatory scroll-px-4 list-none gap-3 overflow-x-auto px-4 pb-2" data-popular-prices>
            {prices.map((s) => (
              <li key={s.slug} className="w-[13.5rem] shrink-0 snap-start">
                <Link
                  href={`/layanan/${s.slug}`}
                  className="tap flex h-full flex-col gap-2.5 rounded-card border border-line/80 bg-white p-4 text-ink no-underline shadow-soft"
                >
                  <span className="flex items-center gap-2.5">
                    <IconTile icon={serviceIcon(s.slug)} tone={categoryTone(s.category.slug)} size="sm" />
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{s.name}</span>
                  </span>
                  <span className="mt-auto grid gap-1">
                    <EstimateChip />
                    <span className="text-[1.05rem] font-bold tracking-tight tabular-nums">{priceRangeText(s.summary.minPrice, s.summary.maxPrice)}</span>
                    <span className="text-[0.75rem] text-muted">{t.home.priceFacilities(s.summary.facilityCount)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {doctors.items.length > 0 && (
        <Section id="dokter" title={t.home.doctorsTitle} hint={t.home.doctorsHint} href="/dokter">
          <ul className="no-scrollbar m-0 flex snap-x snap-mandatory scroll-px-4 list-none gap-3 overflow-x-auto px-4 pb-2">
            {doctors.items.map((d) => (
              <li key={d.slug} className="shrink-0 snap-start">
                <DoctorCard doctor={d} compact />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {articles.data.length > 0 && (
        <Section id="artikel" title={t.home.articlesTitle} href="/artikel">
          <ul className="m-0 grid list-none gap-2.5 px-4">
            {articles.data.slice(0, 3).map((a) => (
              <li key={a.slug}>
                <Link href={`/artikel/${a.slug}`} className="tap flex items-center gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-ink no-underline shadow-soft">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-semibold">{a.title}</span>
                    <span className="text-[0.75rem] text-muted">
                      {t.articles.minutes(a.readingMinutes)} · {formatShortDate(a.publishedAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="cara" title={t.home.howTitle}>
        <ol className="m-0 grid list-none gap-2.5 px-4">
          {t.home.how.map((h, i) => {
            const Icon = HOW_ICONS[i] ?? ShieldCheck;
            return (
              <li key={h.title} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="block text-[0.8rem] text-muted">{h.body}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      <section aria-labelledby="netral" className="mx-4 mt-7 flex items-start gap-3 rounded-card bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lift">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
          <Scale className="size-5" aria-hidden="true" />
        </span>
        <span>
          <h2 id="netral" className="m-0 mb-1 text-base font-bold">
            {t.home.neutralTitle}
          </h2>
          <p className="m-0 text-[0.82rem] text-primary-50">{t.home.neutralBody}</p>
          <Link href="/info" className="mt-2 inline-flex items-center text-sm font-semibold text-white">
            {t.info.methodTitle}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </span>
      </section>
    </>
  );
}
