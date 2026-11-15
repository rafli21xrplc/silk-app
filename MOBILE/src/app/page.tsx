import type { Viewport } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPin, Store } from 'lucide-react';
import { ChipLink } from '@/components/chip-link';
import { CampaignCarousel } from '@/components/campaign-carousel';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorTile } from '@/components/doctor-tile';
import { FacilityRow } from '@/components/facility-card';
import { ListGroup } from '@/components/list';
import { Rail, RailItem, SectionHead } from '@/components/rail';
import { SearchForm } from '@/components/search-form';
import { ServiceCard } from '@/components/service-card';
import { ServiceGrid } from '@/components/service-grid';
import { campaignSlides } from '@/lib/campaigns';
import { formatShortDate } from '@/lib/format';
import { HOME_PRICE_SLUGS } from '@/lib/home';
import { anyDemo, getArticles, getCategories, getPractitioner, getService, getSpecialties, searchFacilities, searchPractitioners, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

// Dinamis: banner "data demo" harus mencerminkan status API saat ini, bukan saat build.
// Respons API yang berhasil tetap di-cache 5 menit oleh fetchApi.
export const dynamic = 'force-dynamic';

// Bilah status ponsel menyatu dengan kepala hijau beranda.
export const viewport: Viewport = { themeColor: '#0b6b64' };

/**
 * Beranda ala aplikasi super: kepala hijau dengan kotak cari, grid layanan berikon, banner campaign SILK,
 * lalu ritme bentuk yang berganti (evaluasi UI/UX §10): karusel harga, karusel dokter, daftar faskes, bacaan. Penjelasan metodologi ada di Info.
 */
export default async function HomePage() {
  const [services, doctors, facilities, categories, articles, specialties] = await Promise.all([
    Promise.all(HOME_PRICE_SLUGS.map((slug) => getService(slug))),
    // Dokter dengan biaya konsultasi tercantum, urut nama (bawaan). Tidak pernah memakai data pembayaran.
    searchPractitioners({ fee: '1' }, 6),
    // Urut nama (bawaan tanpa titik lokasi). Tidak pernah memakai data pembayaran.
    searchFacilities({}, 3),
    getCategories(),
    getArticles(),
    getSpecialties(),
  ]);
  // Pintasan spesialisasi: yang punya dokter terbanyak (jumlah dari data, bukan pembayaran).
  const topSpecialties = [...specialties.data].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id')).slice(0, 6);
  // Jadwal untuk "jadwal terdekat" di kartu dokter (profil di-cache oleh fetchApi).
  const profiles = await Promise.all(doctors.items.map((d) => getPractitioner(d.slug)));
  const prices = services
    .filter((s) => s !== null)
    .map((s) => ({ ...s.data, ...summarizeCities(s.data.cities) }))
    .filter((s) => s.minPrice !== null);
  // Campaign SILK sendiri (bukan promo berbayar), disaring per tanggal tayang saat permintaan.
  const slides = campaignSlides(new Date());

  return (
    <>
      <header className="pt-safe relative overflow-hidden rounded-b-[2rem] bg-linear-to-br from-primary-800 via-primary-700 to-primary-500 px-5 pb-12 text-white">
        <span aria-hidden="true" className="absolute -top-16 -right-14 size-48 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-20 -left-10 size-40 rounded-full bg-white/5" />
        <div className="relative flex h-14 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 py-1.5 pr-3 pl-2 text-xs font-semibold" data-home-location>
            <MapPin className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t.home.locationLabel}: </span>
            {t.home.location}
          </span>
        </div>
        <h1 className="relative mt-4 text-[1.65rem] leading-tight font-bold tracking-tight">{t.home.greeting}</h1>
        <p className="relative m-0 mt-1 text-sm text-white/80">{t.site.tagline}</p>
      </header>
      <div className="relative -mt-7 px-4">
        <SearchForm placeholder={t.home.searchPlaceholder} elevated />
      </div>

      <div className="mt-5 px-4">
        <ServiceGrid />
      </div>

      <DemoNotice show={anyDemo(...services, doctors, facilities, categories, articles, specialties)} date={snapshotDate()} />

      {slides.length > 0 && (
        <div className="mt-6">
          <CampaignCarousel slides={slides} />
        </div>
      )}

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

      {topSpecialties.length > 0 && (
        <section aria-labelledby="spesialis" className="mt-8">
          <SectionHead id="spesialis" title={t.home.specialtiesTitle} href="/dokter" />
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4" data-home-specialties>
            {topSpecialties.map((s) => (
              <ChipLink key={s.name} href={`/dokter?specialty=${encodeURIComponent(s.name)}`} active={false}>
                {s.name}
              </ChipLink>
            ))}
          </div>
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

      <Link
        href="/mitra"
        className="mx-4 mt-8 flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 p-4 text-ink no-underline active:opacity-90"
        data-partner-card
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary-700">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug font-semibold">{t.home.partnerTitle}</span>
          <span className="block text-xs text-ink-soft">{t.home.partnerBody}</span>
        </span>
        <span className="inline-flex shrink-0 items-center text-sm font-semibold text-primary-700">
          {t.home.partnerCta}
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </Link>

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
