import Link from 'next/link';
import { ArrowRight, CalendarCheck2, MapPin, Scale } from 'lucide-react';
import { activeCampaigns } from '@silk/shared';
import { DoctorAvatar } from '@/components/doctor/doctor-avatar';
import { DoctorCard } from '@/components/doctor/doctor-card';
import { CampaignRail } from '@/components/home/campaign-rail';
import { CategoryTiles, NearbySection, SpecialtyShortcuts } from '@/components/home/home-sections';
import { HeroGlow } from '@/components/motion/hero-glow';
import { Reveal } from '@/components/motion/reveal';
import { PriceDisplay } from '@/components/price-display';
import { SearchBar } from '@/components/search-bar';
import { categoryTone, IconTile, serviceIcon } from '@/components/service/service-visual';
import { apiGet, apiGetOrNull } from '@/lib/api';
import { cn } from '@/lib/cn';
import { MAP_STYLE_URL } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { HOME_PRICE_SLUGS, HOME_TILE_SLUGS, pickHomeServices } from '@/lib/home';
import {
  mapLimit,
  priceRangeText,
  summarizeCities,
  type ServiceSummary,
} from '@/lib/service-summary';
import { listServices, loadService } from '@/lib/services';
import type { ScheduleSlot } from '@/lib/schedule-today';
import type { FacilityListItem, PractitionerDetail, PractitionerListItem, PractitionerSpecialty, ServiceListItem } from '@/lib/types';
import { t } from '@/messages/id';

export const revalidate = 3600;

const CITIES = [
  { name: 'Kota Malang', slug: 'kota-malang', tone: 'bg-mint text-mint-ink' },
  { name: 'Kabupaten Malang', slug: 'kabupaten-malang', tone: 'bg-sky text-sky-ink' },
];

type PopularPrice = { slug: string; name: string; categorySlug: string; summary: ServiceSummary };

/** Ringkasan harga layanan populer; layanan tanpa tarif berangka tidak ditampilkan. */
async function loadPopularPrices(): Promise<PopularPrice[]> {
  const rows = await mapLimit(HOME_PRICE_SLUGS, 4, async (slug) => {
    const d = await loadService(slug).catch(() => null);
    if (!d) return null;
    const summary = summarizeCities(d.cities);
    return summary.minPrice === null
      ? null
      : { slug: d.slug, name: d.name, categorySlug: d.category.slug, summary };
  });
  return rows.filter((r): r is PopularPrice => r !== null);
}

export default async function HomePage() {
  // Masing-masing di-cache ISR per tag dan gagal secara terpisah tanpa menjatuhkan beranda.
  const mapOn = !!MAP_STYLE_URL;
  const [allServices, prices, doctors, specialties, nearby] = await Promise.all([
    listServices().catch(() => [] as ServiceListItem[]),
    loadPopularPrices().catch(() => [] as PopularPrice[]),
    // Dokter dengan biaya konsultasi tercantum, urut nama (bawaan API). Tidak pernah memakai data pembayaran.
    apiGet<PractitionerListItem[]>('/practitioners?fee=1&limit=3', { tags: ['practitioners'] })
      .then((r) => r.data)
      .catch(() => [] as PractitionerListItem[]),
    apiGet<PractitionerSpecialty[]>('/practitioner-specialties', { tags: ['practitioners'] })
      .then((r) => r.data)
      .catch(() => [] as PractitionerSpecialty[]),
    // Titik peta "di sekitar Anda": urut nama (bawaan), tidak pernah pembayaran. Hanya dimuat bila peta aktif.
    mapOn
      ? apiGet<FacilityListItem[]>('/facilities?limit=100', { tags: ['facilities'] })
          .then((r) => r.data)
          .catch(() => [] as FacilityListItem[])
      : Promise.resolve([] as FacilityListItem[]),
  ]);
  // Jadwal untuk "Hari ini …" di kartu dokter; profil di-cache per tag dokter.
  const slots = await Promise.all(
    doctors.map(async (d): Promise<ScheduleSlot[]> => {
      const p = await apiGetOrNull<PractitionerDetail>(`/practitioners/${encodeURIComponent(d.slug)}`, { tags: [`practitioner:${d.slug}`, 'practitioners'] }).catch(() => null);
      return p?.practices.flatMap((x) => x.schedules) ?? [];
    }),
  );
  const services = pickHomeServices(allServices, HOME_TILE_SLUGS, 8);
  const heroDoctor = doctors.find((d) => d.consultation) ?? null;
  return (
    <>
      {/* Hero: panel pastel. Judul tidak dianimasikan (elemen LCP); elemen pendukung naik halus lewat CSS. */}
      <section className="container -mt-2 sm:-mt-4">
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#eef7f8] to-sky px-5 pt-10 pb-8 shadow-soft sm:rounded-[2.5rem] sm:px-10 sm:pt-16 sm:pb-12 lg:px-16">
          <HeroGlow />
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center xl:gap-12">
            <div>
              <div className="max-w-2xl lg:max-w-[600px]">
                <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-primary-800 shadow-soft backdrop-blur">
                  <MapPin className="size-4" aria-hidden="true" />
                  {t.home.eyebrow}
                </p>
                <h1 className="text-[clamp(2rem,1.3rem+3.2vw,3.25rem)] leading-[1.08] font-extrabold tracking-[-0.035em]">
                  {t.home.heroTitle}
                </h1>
                <p className="mt-3 max-w-2xl animate-rise text-[1.02rem] text-ink-soft [animation-delay:80ms] sm:text-lg">
                  {t.home.heroBody}
                </p>
              </div>
              <div className="relative z-10 mt-7 max-w-3xl animate-rise [animation-delay:160ms]">
                <SearchBar variant="hero" />
              </div>
            </div>
            {heroDoctor && <HeroPreview doctor={heroDoctor} price={prices[0] ?? null} />}
          </div>
        </div>
      </section>

      <div className="container">
        {/* Campaign SILK sendiri (bukan promo berbayar). Disaring per tanggal saat halaman dibangun ulang (ISR 1 jam). */}
        <CampaignRail campaigns={activeCampaigns(new Date())} />
        <CategoryTiles />

        {/* Bukti USP tepat di bawah judul (evaluasi UI/UX C1): angka dulu, lalu dokternya. */}
        {prices.length > 0 && (
          <section aria-labelledby="biaya-populer" className="mt-12">
            <h2 id="biaya-populer" className="mt-0 mb-1">
              {t.home.pricesTitle}
            </h2>
            <p className="m-0 max-w-2xl text-muted">{t.home.pricesHint}</p>
            <Reveal>
              <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
                {prices.map((p) => (
                  <li key={p.slug} data-reveal>
                    <Link
                      href={`/layanan/${p.slug}`}
                      className="group flex h-full flex-col gap-3 rounded-card border border-line/80 bg-white p-5 text-ink no-underline shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
                      data-popular-price
                    >
                      <span className="flex items-center gap-3">
                        <IconTile
                          icon={serviceIcon(p.slug)}
                          tone={categoryTone(p.categorySlug)}
                          size="sm"
                        />
                        <span className="font-semibold leading-snug">{p.name}</span>
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-[0.8rem] font-semibold text-muted">
                          {t.price.estimate}
                        </span>
                        <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
                          {priceRangeText(p.summary.minPrice, p.summary.maxPrice)}
                        </span>
                        <span className="text-sm text-muted">
                          {t.home.priceFacilities(p.summary.facilityCount, p.summary.cityCount)}
                        </span>
                      </span>
                      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                        {t.home.priceOpen}{' '}
                        <ArrowRight
                          className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>
        )}

        <SpecialtyShortcuts specialties={specialties} />

        {doctors.length > 0 && (
          <section aria-labelledby="kenali-dokter" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="kenali-dokter" className="mt-0 mb-1">
                  {t.home.doctorsTitle}
                </h2>
                <p className="m-0 text-muted">{t.home.doctorsHint}</p>
              </div>
              <Link
                href="/dokter"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline"
              >
                {t.home.doctorsAll} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-6 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d, i) => (
                <li key={d.slug}>
                  <DoctorCard doctor={d} slots={slots[i]} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <NearbySection facilities={nearby} mapOn={mapOn} />

        {services.length > 0 && (
          <section aria-labelledby="pemeriksaan" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="pemeriksaan" className="mt-0 mb-1">
                  {t.categories.title}
                </h2>
                <p className="m-0 text-muted">{t.categories.hint}</p>
              </div>
              <Link
                href="/layanan"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline"
              >
                {t.nav.services} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <Reveal>
              {/* Ponsel: geser horizontal; desktop: grid. */}
              <ul className="-mx-4 mt-6 flex snap-x list-none gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4">
                {services.map((s) => {
                  const Icon = serviceIcon(s.slug);
                  return (
                    <li key={s.slug} data-reveal className="w-[38%] shrink-0 snap-start sm:w-auto">
                      <Link
                        href={`/layanan/${s.slug}`}
                        className="group flex h-full flex-col items-center gap-3 rounded-card border border-line/80 bg-white px-3 py-5 text-center text-ink no-underline shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-1 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
                      >
                        <span
                          className={cn(
                            'grid size-14 place-items-center rounded-2xl transition-transform duration-300 ease-soft group-hover:scale-110',
                            categoryTone(s.category.slug).tile,
                          )}
                        >
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
                <li
                  key={line}
                  data-reveal
                  className="relative overflow-hidden rounded-card bg-white p-6 shadow-soft"
                >
                  <span
                    className="absolute -top-3 -right-1 text-[5.5rem] leading-none font-extrabold text-primary-100 select-none"
                    aria-hidden="true"
                  >
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

/**
 * Pratinjau produk di hero (evaluasi UI/UX B2): kartu dokter dan rentang harga dari data yang sama dengan
 * halaman publik, menggantikan kolase ikon. Hanya di layar lebar; di ponsel bagian di bawah hero memuat isinya.
 */
function HeroPreview({
  doctor,
  price,
}: {
  doctor: PractitionerListItem;
  price: PopularPrice | null;
}) {
  const c = doctor.consultation;
  return (
    <div
      className="relative mt-10 hidden animate-rise [animation-delay:240ms] xl:mt-0 xl:block"
      data-hero-preview
    >
      <p className="mb-2 text-sm font-semibold text-primary-800">{t.home.previewLabel}</p>
      <Link
        href={`/dokter/${doctor.slug}`}
        className="group block rounded-3xl bg-white/95 p-5 text-ink no-underline shadow-lift ring-1 ring-white transition-transform duration-300 ease-soft hover:-translate-y-0.5 hover:text-ink hover:no-underline"
      >
        <span className="flex items-center gap-3">
          <DoctorAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="sm" />
          <span className="min-w-0">
            <span className="block font-semibold leading-snug group-hover:text-primary-800">
              {doctor.name}
            </span>
            {doctor.specialty && (
              <span className="block text-sm text-muted">{doctor.specialty}</span>
            )}
          </span>
        </span>
        {c && (
          <span className="mt-4 grid gap-1 rounded-2xl bg-surface/80 px-4 py-3">
            <span className="text-[0.8rem] font-semibold text-muted">{c.serviceName}</span>
            <span className="flex flex-wrap items-center gap-2">
              <PriceDisplay price={c.price} />
              <span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs font-semibold text-ink-soft">
                {t.price.estimate}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-muted">
              <CalendarCheck2 className="size-3.5" aria-hidden="true" />
              {`${t.trust.effectiveFrom} ${formatDate(c.trust.effectiveFrom)}`}
            </span>
          </span>
        )}
      </Link>
      {price && (
        <Link
          href={`/layanan/${price.slug}`}
          className={cn(
            'mt-3 ml-8 flex items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 text-ink no-underline shadow-soft ring-1 ring-white',
            'transition-transform duration-300 ease-soft hover:-translate-y-0.5 hover:text-ink hover:no-underline',
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{price.name}</span>
            <span className="block text-[0.8rem] text-muted">
              {t.home.previewPriceAcross(price.summary.facilityCount)}
            </span>
          </span>
          <span className="shrink-0 font-bold tabular-nums">
            {priceRangeText(price.summary.minPrice, price.summary.maxPrice)}
          </span>
        </Link>
      )}
    </div>
  );
}
