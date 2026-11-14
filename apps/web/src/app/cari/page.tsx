import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpDown, Info, List, Map as MapIcon, Navigation, SearchX, SlidersHorizontal, Stethoscope, X } from 'lucide-react';
import { FACILITY_TYPES, formatPrice } from '@silk/shared';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { FacilityCard } from '@/components/facility-card';
import { Reveal } from '@/components/motion/reveal';
import { NearMeButton } from '@/components/search/near-me-button';
import { ResultsMap, type MapPoint } from '@/components/search/results-map';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SearchBar } from '@/components/search-bar';
import { TrackView } from '@/components/track-view';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/cn';
import { MAP_STYLE_URL } from '@/lib/config';
import { featureEnabled } from '@/lib/flags';
import { apiQuery, normalizeSearch, RADIUS_OPTIONS_M, resolveServiceQuery, searchHref } from '@/lib/search-params';
import type { FacilityListItem, ServiceCategory, ServiceListItem } from '@/lib/types';
import { t } from '@/messages/id';

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const rupiah = new Intl.NumberFormat('id-ID');

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const q = one(sp.q);
  return {
    title: q ? t.search.resultsFor(q) : t.search.results,
    // Halaman hasil pencarian tidak diindeks; halaman faskes dan layanan yang diindeks.
    robots: { index: false, follow: true },
    alternates: { canonical: '/cari' },
  };
}

/**
 * Hasil pencarian (SSR dinamis). Formulir GET biasa: filter bekerja tanpa JavaScript; "Dekat saya" dan peta
 * butuh JavaScript. Urutan hanya relevansi, jarak, harga, nama, atau rating, tidak pernah pembayaran.
 */
export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ratings = featureEnabled('reviews_enabled');
  const raw = normalizeSearch(sp, { ratings });
  const view = one(sp.view) === 'peta' ? 'peta' : null;
  const textMode = one(sp.teks) === '1';
  const [services, categories] = await Promise.all([
    apiGet<ServiceListItem[]>('/services?limit=100', { tags: ['services'] }).then((r) => r.data).catch(() => [] as ServiceListItem[]),
    apiGet<ServiceCategory[]>('/service-categories', { tags: ['services'] }).then((r) => r.data).catch(() => [] as ServiceCategory[]),
  ]);
  // USP "tahu biayanya": kata kunci yang persis nama/alias layanan dicari sebagai layanan itu, sehingga
  // setiap kartu langsung menampilkan perkiraan harganya. `teks=1` mematikan pemetaan ini.
  const matched = raw.q && !raw.service && !raw.category && !textMode ? resolveServiceQuery(raw.q, services) : null;
  const s = matched ? { ...raw, q: undefined, service: matched.slug } : raw;
  const typed = raw.q ?? '';
  const q = s.q ?? '';
  const city = s.city ?? '';
  const hasPoint = !!s.lat;
  const priceScope = !!(s.service || s.category);
  const priceSort = s.sort === 'price_asc' || s.sort === 'price_desc';
  const mapOn = !!MAP_STYLE_URL;

  const results = await apiGet<FacilityListItem[]>(`/facilities?${apiQuery(s)}`, { tags: ['facilities'], revalidate: 60 }).catch(() => null);
  const items = results?.data ?? [];
  const unpricedCount = results?.meta?.unpricedCount ?? 0;
  const nextCursor = results?.meta?.nextCursor;
  // Kategori terpilih mempersempit daftar layanan; layanan yang sudah dipilih tetap ada di daftar.
  const serviceOptions = services.filter((x) => !s.category || x.category.slug === s.category || x.slug === s.service);

  const points: MapPoint[] = items.flatMap((f) =>
    f.location
      ? [{ id: f.id, slug: f.slug, name: f.name, typeLabel: t.facilityType[f.type] ?? f.type, priceText: f.price ? formatPrice(f.price, { ask: t.price.ask, from: t.price.from }) : null, ...f.location }]
      : [],
  );
  const center = hasPoint ? { lat: Number(s.lat), lng: Number(s.lng) } : null;
  // Pemisah kelompok saat urut harga: faskes tanpa angka harga selalu di belakang (opsi A rencana fase 3).
  const firstUnpriced = priceSort ? items.findIndex((f) => !f.priceAvailable) : -1;
  const viewPatch = { ...(view ? { view } : {}), ...(textMode ? { teks: '1' } : {}) };
  const heading = matched ? t.search.priceFor(matched.name) : typed ? t.search.resultsFor(typed) : t.search.results;

  return (
    <div className="container">
      <h1 className="mb-1">{heading}</h1>
      <SearchBar q={typed} city={city} />
      {matched && (
        <p className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-ink-soft" data-matched-service={matched.slug}>
          <Info className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
          {t.search.matchedService(matched.name)}
          <Link href={`/cari?${new URLSearchParams({ q: typed, teks: '1', ...(city ? { city } : {}) }).toString()}`} className="font-semibold">
            {t.search.searchAsText(typed)}
          </Link>
        </p>
      )}
      <p className="-mt-2 mb-4 text-sm">
        <Link href={typed ? `/dokter?q=${encodeURIComponent(typed)}` : '/dokter'} className="inline-flex items-center gap-1.5 font-semibold" title={t.doctors.findDoctorHint}>
          <Stethoscope className="size-4" aria-hidden="true" />
          {t.doctors.findDoctor}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
      {/* Jenis faskes sebagai pilihan cepat (direktori /fasilitas di SILK versi lama). Tautan biasa: jalan tanpa JavaScript. */}
      <nav aria-label={t.search.type} className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="m-0 flex w-max list-none gap-2 p-0 sm:w-auto sm:flex-wrap">
          {['', ...FACILITY_TYPES].map((ft) => {
            const active = (s.type ?? '') === ft;
            return (
              <li key={ft || 'semua'}>
                <Link
                  href={searchHref(s, { type: ft || null, ...viewPatch })}
                  aria-current={active ? 'page' : undefined}
                  data-type-chip={ft || 'semua'}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap no-underline transition-colors hover:no-underline',
                    active ? 'border-primary-600 bg-primary-600 text-white hover:text-white' : 'border-line bg-white text-ink-soft hover:border-primary-200 hover:text-primary-800',
                  )}
                >
                  {ft ? (t.facilityType[ft] ?? ft) : t.search.allTypes}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <form action="/cari" method="get" className="mb-5 grid gap-3" aria-label="Filter">
        {q && <input type="hidden" name="q" value={q} />}
        {city && <input type="hidden" name="city" value={city} />}
        {hasPoint && (
          <>
            <input type="hidden" name="lat" value={s.lat} />
            <input type="hidden" name="lng" value={s.lng} />
          </>
        )}
        {view && <input type="hidden" name="view" value={view} />}
        {textMode && <input type="hidden" name="teks" value="1" />}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filter
          </span>
          {s.type && <input type="hidden" name="type" value={s.type} />}
          <Select
            variant="chip"
            name="category"
            defaultValue={s.category ?? ''}
            label={t.search.category}
            autoSubmit
            options={[{ value: '', label: t.search.allCategories }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
          />
          <Select
            variant="chip"
            name="service"
            defaultValue={s.service ?? ''}
            label={t.search.service}
            autoSubmit
            searchable
            options={[{ value: '', label: t.search.allServices }, ...serviceOptions.map((x) => ({ value: x.slug, label: x.name, hint: x.category.name }))]}
          />
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
          {ratings && (
            <Select
              variant="chip"
              name="minRating"
              defaultValue={s.minRating ?? ''}
              label={t.search.rating}
              autoSubmit
              options={[{ value: '', label: t.search.anyRating }, ...[5, 4, 3].map((n) => ({ value: String(n), label: t.search.minRating(n) }))]}
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
              { value: '', label: t.search.sortOptions.relevance },
              ...(hasPoint ? [{ value: 'distance', label: t.search.sortOptions.distance }] : []),
              ...(s.service
                ? [
                    { value: 'price_asc', label: t.search.sortOptions.price_asc },
                    { value: 'price_desc', label: t.search.sortOptions.price_desc },
                  ]
                : []),
              ...(ratings ? [{ value: 'rating', label: t.search.sortOptions.rating }] : []),
              { value: 'name', label: t.search.sortOptions.name },
            ]}
          />
        </div>
        <div role="group" aria-labelledby="price-range-label" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
          <span id="price-range-label" className="col-span-3 mr-1 text-sm font-semibold text-muted">
            {t.search.priceRange}
          </span>
          {(['priceMin', 'priceMax'] as const).map((k, i) => (
            <span key={k} className="contents">
              {i === 1 && (
                <span className="text-muted" aria-hidden="true">
                  –
                </span>
              )}
              <label className="relative min-w-0">
                <span className="sr-only">{k === 'priceMin' ? t.search.priceMin : t.search.priceMax}</span>
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted" aria-hidden="true">
                  Rp
                </span>
                <input
                  name={k}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!priceScope}
                  placeholder={k === 'priceMin' ? t.search.pricePlaceholderMin : t.search.pricePlaceholderMax}
                  defaultValue={s[k] ? rupiah.format(Number(s[k])) : ''}
                  className="h-10 min-h-0 w-full rounded-full pl-10 text-sm disabled:bg-surface sm:w-36"
                />
              </label>
            </span>
          ))}
          <button type="submit" disabled={!priceScope} className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'col-span-3 sm:col-auto' })}>
            {t.search.priceApply}
          </button>
          {!priceScope && <p className="col-span-3 m-0 basis-full text-sm text-muted">{t.search.priceNeedsScope}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPoint ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky px-3 py-1 text-sm font-medium text-sky-ink">
              <Navigation className="size-4" aria-hidden="true" />
              {t.search.locationActive}
              <Link
                href={searchHref(s, { lat: null, lng: null, radius: null, sort: s.sort === 'distance' ? null : (s.sort ?? null), ...viewPatch })}
                className="inline-flex items-center gap-0.5 font-semibold text-sky-ink underline"
              >
                <X className="size-3.5" aria-hidden="true" />
                {t.search.clearLocation}
              </Link>
            </span>
          ) : (
            <NearMeButton state={s} />
          )}
          {mapOn && (
            <Link
              href={searchHref(s, { view: view ? null : 'peta' })}
              className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'ml-auto lg:hidden' })}
            >
              {view ? <List className="size-4" aria-hidden="true" /> : <MapIcon className="size-4" aria-hidden="true" />}
              {view ? t.search.showList : t.search.showMap}
            </Link>
          )}
        </div>
        <noscript>
          <button type="submit" className="btn">
            {t.search.submit}
          </button>
        </noscript>
      </form>
      <DisclaimerBanner />
      {unpricedCount > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-soft" data-unpriced-count={unpricedCount}>
          <Info className="size-4 shrink-0 text-muted" aria-hidden="true" />
          {t.search.unpricedHidden(unpricedCount)}
          <Link href={searchHref(s, { priceMin: null, priceMax: null, ...viewPatch })} className="font-semibold">
            {t.search.unpricedShow}
          </Link>
        </p>
      )}
      {results === null ? (
        <p className="error rounded-card border border-danger/20 bg-danger-soft p-5" role="alert">
          {t.common.error}
        </p>
      ) : items.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed border-line-strong bg-white px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 max-w-md text-ink-soft">{t.search.none}</p>
        </div>
      ) : (
        <div className={cn(mapOn && 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]')}>
          <div className={cn(mapOn && view && 'hidden lg:block')}>
            <Reveal>
              <ul className={cn('m-0 grid list-none gap-4 p-0', !mapOn && 'lg:grid-cols-2')}>
                {items.map((f, i) => (
                  <ResultItem key={f.id} facility={f} divider={i === firstUnpriced} />
                ))}
              </ul>
            </Reveal>
            {nextCursor && (
              <p className="mt-8 flex justify-center">
                <Link className={buttonVariants({ variant: 'secondary' })} href={searchHref(s, { cursor: nextCursor, ...viewPatch })}>
                  {t.search.next} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </p>
            )}
          </div>
          {mapOn && (
            <aside className={cn(view ? 'block' : 'hidden lg:block', 'lg:sticky lg:top-24')}>
              <ResultsMap points={points} center={center} className="map h-[65vh] md:h-[65vh] md:min-h-0 lg:h-[calc(100vh-8rem)]" />
              {points.length < items.length && <p className="mt-2 mb-0 text-sm text-muted">{t.search.mapMissing(items.length - points.length)}</p>}
            </aside>
          )}
        </div>
      )}
      <TrackView
        event="search_performed"
        props={{ city: city || null, service: s.service ?? null, category: s.category ?? null, near: hasPoint ? 1 : 0, results: items.length }}
      />
    </div>
  );
}

function ResultItem({ facility, divider }: { facility: FacilityListItem; divider: boolean }) {
  return (
    <>
      {divider && (
        <li className="col-span-full mt-2 border-t border-line pt-4" data-unpriced-group>
          <h2 className="m-0 text-base">{t.search.unpricedGroup}</h2>
          <p className="m-0 text-sm text-muted">{t.search.unpricedGroupHint}</p>
        </li>
      )}
      <li data-reveal>
        <FacilityCard facility={facility} />
      </li>
    </>
  );
}
