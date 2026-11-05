import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpDown, SearchX, SlidersHorizontal } from 'lucide-react';
import { FACILITY_TYPES } from '@silk/shared';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { FacilityCard } from '@/components/facility-card';
import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SearchBar } from '@/components/search-bar';
import { TrackView } from '@/components/track-view';
import { apiGet } from '@/lib/api';
import type { FacilityListItem, ServiceListItem } from '@/lib/types';
import { t } from '@/messages/id';

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

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

/** Hasil pencarian (SSR dinamis). Formulir GET biasa: bekerja tanpa JavaScript. */
export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const city = one(sp.city);
  const type = one(sp.type);
  const service = one(sp.service);
  const sort = one(sp.sort);
  const cursor = one(sp.cursor);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (city) params.set('city', city);
  if (type) params.set('type', type);
  if (service) params.set('service', service);
  if (sort && (sort !== 'price_asc' && sort !== 'price_desc' ? true : service)) params.set('sort', sort);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', '20');

  const [results, services] = await Promise.all([
    apiGet<FacilityListItem[]>(`/facilities?${params}`, { tags: ['facilities'], revalidate: 60 }).catch(() => null),
    apiGet<ServiceListItem[]>('/services?limit=100', { tags: ['services'] }).then((r) => r.data).catch(() => [] as ServiceListItem[]),
  ]);

  const nextParams = new URLSearchParams(params);
  if (results?.meta?.nextCursor) nextParams.set('cursor', results.meta.nextCursor);
  nextParams.delete('limit');

  return (
    <div className="container">
      <h1 className="mb-1">{q ? t.search.resultsFor(q) : t.search.results}</h1>
      <SearchBar q={q} city={city} />
      <form action="/cari" method="get" className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filter">
        <input type="hidden" name="q" value={q} />
        <input type="hidden" name="city" value={city} />
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filter
        </span>
        <Select
          variant="chip"
          name="type"
          defaultValue={type}
          label={t.search.type}
          autoSubmit
          options={[{ value: '', label: t.search.allTypes }, ...FACILITY_TYPES.map((ft) => ({ value: ft, label: t.facilityType[ft] ?? ft }))]}
        />
        <Select
          variant="chip"
          name="service"
          defaultValue={service}
          label={t.search.service}
          autoSubmit
          searchable
          options={[{ value: '', label: t.search.allServices }, ...services.map((s) => ({ value: s.slug, label: s.name, hint: s.category.name }))]}
        />
        <Select
          variant="chip"
          name="sort"
          defaultValue={sort}
          label={t.search.sort}
          autoSubmit
          align="end"
          icon={<ArrowUpDown className="size-4" />}
          options={[
            { value: '', label: t.search.sortOptions.relevance },
            { value: 'price_asc', label: t.search.sortOptions.price_asc },
            { value: 'price_desc', label: t.search.sortOptions.price_desc },
            { value: 'name', label: t.search.sortOptions.name },
          ]}
        />
        <noscript>
          <button type="submit" className="btn">
            {t.search.submit}
          </button>
        </noscript>
      </form>
      <DisclaimerBanner />
      {results === null ? (
        <p className="error rounded-card border border-danger/20 bg-danger-soft p-5" role="alert">
          {t.common.error}
        </p>
      ) : results.data.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed border-line-strong bg-white px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 max-w-md text-ink-soft">{t.search.none}</p>
        </div>
      ) : (
        <Reveal>
          <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
            {results.data.map((f) => (
              <li key={f.id} data-reveal>
                <FacilityCard facility={f} />
              </li>
            ))}
          </ul>
        </Reveal>
      )}
      {results?.meta?.nextCursor && (
        <p className="mt-8 flex justify-center">
          <Link className={buttonVariants({ variant: 'secondary' })} href={`/cari?${nextParams}`}>
            {t.search.next} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      )}
      <TrackView event="search_performed" props={{ city: city || null, service: service || null, results: results?.data.length ?? 0 }} />
    </div>
  );
}
