import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpDown, MapPin, Navigation, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { DoctorCard } from '@/components/doctor/doctor-card';
import { Reveal } from '@/components/motion/reveal';
import { NearMeButton } from '@/components/search/near-me-button';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { apiGet } from '@/lib/api';
import { doctorApiQuery, doctorHref, normalizeDoctorSearch } from '@/lib/doctor-search';
import { RADIUS_OPTIONS_M } from '@/lib/search-params';
import type { PractitionerListItem, PractitionerSpecialty } from '@/lib/types';
import { t } from '@/messages/id';

type SP = Promise<Record<string, string | string[] | undefined>>;

const CITY_OPTIONS = [
  { value: '', label: t.search.allCities },
  { value: 'Malang', label: 'Malang', hint: 'Kota dan kabupaten' },
  { value: 'kota-malang', label: 'Kota Malang' },
  { value: 'kabupaten-malang', label: 'Kabupaten Malang' },
];

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const s = normalizeDoctorSearch(await searchParams);
  const filtered = Object.keys(s).length > 0;
  return {
    title: s.q ? t.doctors.resultsFor(s.q) : t.doctors.title,
    description: t.doctors.intro,
    // Halaman daftar polos diindeks; hasil dengan filter tidak (halaman dokter yang diindeks).
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical: '/dokter' },
  };
}

/**
 * Daftar dan pencarian dokter (Fase 4b, SSR dinamis). Formulir GET biasa, filter bekerja tanpa JavaScript.
 * Urutan hanya relevansi, jarak, atau nama; tidak pernah pembayaran atau langganan.
 */
export default async function DoctorsPage({ searchParams }: { searchParams: SP }) {
  const s = normalizeDoctorSearch(await searchParams);
  const hasPoint = !!s.lat;
  const [results, specialties] = await Promise.all([
    apiGet<PractitionerListItem[]>(`/practitioners?${doctorApiQuery(s)}`, { tags: ['practitioners'], revalidate: 60 }).catch(() => null),
    apiGet<PractitionerSpecialty[]>('/practitioner-specialties', { tags: ['practitioners'] }).then((r) => r.data).catch(() => [] as PractitionerSpecialty[]),
  ]);
  const items = results?.data ?? [];
  const nextCursor = results?.meta?.nextCursor;
  // Spesialisasi di URL yang tidak ada di daftar (mis. huruf berbeda) tetap bisa dipilih ulang.
  const specialtyOptions = [
    { value: '', label: t.doctors.allSpecialties },
    ...specialties.map((x) => ({ value: x.name, label: t.doctors.specialtyCount(x.name, x.count) })),
    ...(s.specialty && !specialties.some((x) => x.name.toLowerCase() === s.specialty!.toLowerCase()) ? [{ value: s.specialty, label: s.specialty }] : []),
  ];

  return (
    <div className="container">
      <h1 className="mb-1">{s.q ? t.doctors.resultsFor(s.q) : t.doctors.title}</h1>
      <p className="mb-0 max-w-2xl text-ink-soft">{t.doctors.intro}</p>

      <form action="/dokter" method="get" role="search" className="my-5 grid gap-3">
        {hasPoint && (
          <>
            <input type="hidden" name="lat" value={s.lat} />
            <input type="hidden" name="lng" value={s.lng} />
          </>
        )}
        <div className="grid gap-2 rounded-[1.75rem] border border-line bg-white p-2.5 shadow-soft md:grid-cols-[230px_1fr_auto] md:items-center md:rounded-full md:p-2">
          <Select
            name="city"
            defaultValue={s.city ?? ''}
            options={CITY_OPTIONS}
            label={t.search.city}
            searchable={false}
            icon={<MapPin className="size-[18px] text-primary-600" />}
            className="border-transparent bg-surface md:rounded-full md:bg-primary-50/60"
          />
          <div className="relative">
            <label htmlFor="doctor-q" className="sr-only">
              {t.doctors.searchLabel}
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="doctor-q"
              name="q"
              type="search"
              defaultValue={s.q ?? ''}
              placeholder={t.doctors.searchPlaceholder}
              autoComplete="off"
              className="border-field pl-12 focus-visible:border-primary-600 md:rounded-full md:border-transparent md:hover:border-line-strong"
            />
          </div>
          <button type="submit" className={buttonVariants({ variant: 'primary', className: 'w-full md:w-auto' })}>
            <Search className="size-[18px]" aria-hidden="true" />
            {t.search.submit}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filter
          </span>
          <Select variant="chip" name="specialty" defaultValue={s.specialty ?? ''} label={t.doctors.specialty} autoSubmit searchable options={specialtyOptions} />
          {hasPoint && (
            <Select
              variant="chip"
              name="radius"
              defaultValue={s.radius ?? ''}
              label={t.search.radius}
              autoSubmit
              options={[{ value: '', label: t.search.anyRadius }, ...RADIUS_OPTIONS_M.map((m) => ({ value: String(m), label: t.search.withinRadius(m) }))]}
            />
          )}
          <Select
            variant="chip"
            name="sort"
            defaultValue={s.sort ?? ''}
            label={t.search.sort}
            autoSubmit
            align="end"
            icon={<ArrowUpDown className="size-4" />}
            options={[
              { value: '', label: t.doctors.sortOptions.default ?? '' },
              ...(s.q ? [{ value: 'relevance', label: t.doctors.sortOptions.relevance ?? '' }] : []),
              ...(hasPoint ? [{ value: 'distance', label: t.doctors.sortOptions.distance ?? '' }] : []),
              { value: 'name', label: t.doctors.sortOptions.name ?? '' },
            ]}
          />
          {hasPoint ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky px-3 py-1 text-sm font-medium text-sky-ink">
              <Navigation className="size-4" aria-hidden="true" />
              {t.search.locationActive}
              <Link
                href={doctorHref(s, { lat: null, lng: null, radius: null, sort: s.sort === 'distance' ? null : (s.sort ?? null) })}
                className="inline-flex items-center gap-0.5 font-semibold text-sky-ink underline"
              >
                <X className="size-3.5" aria-hidden="true" />
                {t.search.clearLocation}
              </Link>
            </span>
          ) : (
            <NearMeButton state={s} path="/dokter" />
          )}
        </div>
        <noscript>
          <button type="submit" className="btn">
            {t.search.submit}
          </button>
        </noscript>
      </form>

      {results === null ? (
        <p className="error rounded-card border border-danger/20 bg-danger-soft p-5" role="alert">
          {t.common.error}
        </p>
      ) : items.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed border-line-strong bg-white px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 max-w-md text-ink-soft">{t.doctors.none}</p>
        </div>
      ) : (
        <>
          <Reveal>
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
              {items.map((d) => (
                <li key={d.slug} data-reveal>
                  <DoctorCard doctor={d} />
                </li>
              ))}
            </ul>
          </Reveal>
          {nextCursor && (
            <p className="mt-8 flex justify-center">
              <Link className={buttonVariants({ variant: 'secondary' })} href={doctorHref(s, { cursor: nextCursor })}>
                {t.search.next} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
