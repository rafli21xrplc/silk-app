import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorRow } from '@/components/doctor-card';
import { ListGroup, ListRow } from '@/components/list';
import { SearchForm } from '@/components/search-form';
import { formatShortDate, priceRangeShort } from '@/lib/format';
import { HOME_PRICE_SLUGS, QUICK_LINKS } from '@/lib/home';
import { anyDemo, getArticles, getService, searchPractitioners, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

// Dinamis: banner "data demo" harus mencerminkan status API saat ini, bukan saat build.
// Respons API yang berhasil tetap di-cache 5 menit oleh fetchApi.
export const dynamic = 'force-dynamic';

const SeeAll = ({ href }: { href: string }) => (
  <Link href={href} className="text-sm font-semibold text-primary-700 no-underline">
    {t.common.seeAll}
  </Link>
);

/** Beranda sebagai alat: cari, pintasan, lalu angka dan dokter. Penjelasan metodologi ada di Info. */
export default async function HomePage() {
  const [services, doctors, articles] = await Promise.all([
    Promise.all(HOME_PRICE_SLUGS.map((slug) => getService(slug))),
    // Dokter dengan biaya konsultasi tercantum, urut nama (bawaan). Tidak pernah memakai data pembayaran.
    searchPractitioners({ fee: '1' }, 4),
    getArticles(),
  ]);
  const prices = services
    .filter((s) => s !== null)
    .map((s) => ({ ...s.data, summary: summarizeCities(s.data.cities) }))
    .filter((s) => s.summary.minPrice !== null);

  return (
    <>
      <header className="pt-safe px-5">
        <div className="flex h-14 items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-primary-800">
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
            {t.site.name}
          </span>
          <span className="text-xs font-medium text-muted">{t.site.region}</span>
        </div>
        <h1 className="mt-4 mb-5 text-3xl leading-[1.1] font-bold tracking-tight">{t.home.heroTitle}</h1>
      </header>
      <div className="px-4">
        <SearchForm placeholder={t.home.searchPlaceholder} />
      </div>
      <nav aria-label={t.home.categoriesLabel} className="mt-3 flex gap-5 px-5 text-sm font-semibold">
        <Link href="/cari?dekat=1" className="text-primary-700 no-underline">
          {t.home.shortcuts.near}
        </Link>
        <Link href="/dokter" className="text-primary-700 no-underline">
          {t.home.shortcuts.doctors}
        </Link>
      </nav>

      <DemoNotice show={anyDemo(...services, doctors, articles)} date={snapshotDate()} />

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t.home.categoriesLabel}>
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.key}
            href={q.href}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-soft no-underline active:bg-surface"
          >
            {t.quick[q.key]}
          </Link>
        ))}
      </div>

      {prices.length > 0 && (
        <ListGroup id="biaya" title={t.home.pricesTitle} aside={<SeeAll href="/layanan" />} note={t.home.pricesNote} className="mt-7">
          {prices.map((s) => (
            <ListRow
              key={s.slug}
              marker="popular-price"
              href={`/layanan/${s.slug}`}
              chevron={false}
              title={s.name}
              trailing={
                <>
                  <span className="block text-base font-semibold tabular-nums">{priceRangeShort(s.summary.minPrice, s.summary.maxPrice)}</span>
                  <span className="block text-xs text-muted">{t.services.facilities(s.summary.facilityCount)}</span>
                </>
              }
            />
          ))}
        </ListGroup>
      )}

      {doctors.items.length > 0 && (
        <ListGroup id="dokter" title={t.home.doctorsTitle} aside={<SeeAll href="/dokter?fee=1" />} className="mt-8">
          {doctors.items.map((d) => (
            <DoctorRow key={d.slug} doctor={d} />
          ))}
        </ListGroup>
      )}

      {articles.data.length > 0 && (
        <ListGroup id="artikel" title={t.home.articlesTitle} aside={<SeeAll href="/artikel" />} className="mt-8">
          {articles.data.slice(0, 3).map((a) => (
            <ListRow
              key={a.slug}
              href={`/artikel/${a.slug}`}
              title={a.title}
              sub={`${t.articles.minutes(a.readingMinutes)} · ${formatShortDate(a.publishedAt)}`}
            />
          ))}
        </ListGroup>
      )}

      <p className="m-0 mt-8 px-5 text-xs text-muted">
        {t.home.footnote}{' '}
        <Link href="/info" className="inline-flex items-center font-semibold text-primary-700 no-underline">
          {t.home.footnoteLink}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}
