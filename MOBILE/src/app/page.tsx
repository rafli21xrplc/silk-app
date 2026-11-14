import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CategoryBento } from '@/components/category-tiles';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorTile } from '@/components/doctor-tile';
import { FacilityRow } from '@/components/facility-card';
import { ListGroup } from '@/components/list';
import { Rail, RailItem, SectionHead } from '@/components/rail';
import { SearchForm } from '@/components/search-form';
import { ServiceCard } from '@/components/service-card';
import { formatShortDate } from '@/lib/format';
import { HOME_PRICE_SLUGS } from '@/lib/home';
import { anyDemo, getArticles, getCategories, getPractitioner, getService, searchFacilities, searchPractitioners, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

// Dinamis: banner "data demo" harus mencerminkan status API saat ini, bukan saat build.
// Respons API yang berhasil tetap di-cache 5 menit oleh fetchApi.
export const dynamic = 'force-dynamic';

/**
 * Beranda sebagai alat, dengan ritme bentuk yang berganti (evaluasi UI/UX §10): ubin kategori berfoto,
 * karusel kartu harga, karusel dokter, satu daftar faskes, lalu bacaan. Penjelasan metodologi ada di Info.
 */
export default async function HomePage() {
  const [services, doctors, facilities, categories, articles] = await Promise.all([
    Promise.all(HOME_PRICE_SLUGS.map((slug) => getService(slug))),
    // Dokter dengan biaya konsultasi tercantum, urut nama (bawaan). Tidak pernah memakai data pembayaran.
    searchPractitioners({ fee: '1' }, 6),
    // Urut nama (bawaan tanpa titik lokasi). Tidak pernah memakai data pembayaran.
    searchFacilities({}, 3),
    getCategories(),
    getArticles(),
  ]);
  // Jadwal untuk "jadwal terdekat" di kartu dokter (profil di-cache oleh fetchApi).
  const profiles = await Promise.all(doctors.items.map((d) => getPractitioner(d.slug)));
  const prices = services
    .filter((s) => s !== null)
    .map((s) => ({ ...s.data, ...summarizeCities(s.data.cities) }))
    .filter((s) => s.minPrice !== null);
  const serviceTotal = categories.data.reduce((n, c) => n + c.serviceCount, 0);

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
      <nav aria-label={t.home.shortcutsLabel} className="mt-3 flex gap-5 px-5 text-sm font-semibold">
        <Link href="/cari?dekat=1" className="-my-2.5 py-2.5 text-primary-700 no-underline">
          {t.home.shortcuts.near}
        </Link>
        <Link href="/dokter" className="-my-2.5 py-2.5 text-primary-700 no-underline">
          {t.home.shortcuts.doctors}
        </Link>
      </nav>

      <DemoNotice show={anyDemo(...services, doctors, facilities, categories, articles)} date={snapshotDate()} />

      <div className="mt-6">
        <CategoryBento serviceTotal={serviceTotal} />
      </div>

      {prices.length > 0 && (
        <section aria-labelledby="biaya" className="mt-8">
          <SectionHead id="biaya" title={t.home.pricesTitle} href="/layanan" />
          <Rail label={t.home.pricesTitle}>
            {prices.map((s) => (
              <RailItem key={s.slug} className="w-40">
                <ServiceCard service={s} className="w-full" />
              </RailItem>
            ))}
          </Rail>
          <p className="m-0 px-5 pt-2 text-xs text-muted">
            {t.home.pricesNote} {t.services.spreadLegend}
          </p>
        </section>
      )}

      {doctors.items.length > 0 && (
        <section aria-labelledby="dokter" className="mt-8">
          <SectionHead id="dokter" title={t.home.doctorsTitle} href="/dokter?fee=1" />
          <Rail label={t.home.doctorsTitle}>
            {doctors.items.map((d, i) => (
              <RailItem key={d.slug}>
                <DoctorTile doctor={d} slots={profiles[i]?.data.practices.flatMap((p) => p.schedules) ?? []} />
              </RailItem>
            ))}
          </Rail>
        </section>
      )}

      {facilities.items.length > 0 && (
        <ListGroup id="faskes" title={t.home.facilitiesTitle} aside={<SeeAll href="/cari" />} className="mt-8">
          {facilities.items.map((f) => (
            <FacilityRow key={f.slug} facility={f} common={null} />
          ))}
        </ListGroup>
      )}

      {articles.data.length > 0 && (
        <section aria-labelledby="artikel" className="mt-8">
          <SectionHead id="artikel" title={t.home.articlesTitle} href="/artikel" className="pb-1" />
          <ul className="m-0 list-none px-5 py-0">
            {articles.data.slice(0, 3).map((a) => (
              <li key={a.slug} className="border-b border-line/80 last:border-b-0">
                <Link href={`/artikel/${a.slug}`} className="block py-3 text-ink no-underline">
                  <span className="block text-base leading-snug font-semibold">{a.title}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {t.articles.minutes(a.readingMinutes)} · {formatShortDate(a.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="m-0 mt-6 px-5 text-xs text-muted">
        {t.home.footnote}{' '}
        <Link href="/info" className="inline-flex items-center font-semibold text-primary-700 no-underline">
          {t.home.footnoteLink}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}

const SeeAll = ({ href }: { href: string }) => (
  <Link href={href} className="-my-2.5 py-2.5 text-sm font-semibold text-primary-700 no-underline">
    {t.common.seeAll}
  </Link>
);
