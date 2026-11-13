import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Info } from 'lucide-react';
import { DemoNotice } from '@/components/demo-notice';
import { FacilityFilters } from '@/components/facility-filters';
import { FacilityResults } from '@/components/facility-results';
import { NearMe } from '@/components/near-me';
import { SearchForm } from '@/components/search-form';
import { parseFacilityParams, resolveServiceQuery, toQueryString } from '@/lib/search';
import { anyDemo, getCategories, getServices, searchFacilities, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.search.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = parseFacilityParams(await searchParams);
  const [services, categories] = await Promise.all([getServices(), getCategories()]);
  // Evaluasi UI/UX A1: kata kunci yang persis nama layanan → harga langsung tampil di setiap kartu.
  const matched = raw.q && !raw.service && !raw.category && !raw.teks ? resolveServiceQuery(raw.q, services.data) : null;
  const p = matched ? { ...raw, q: undefined, service: matched.slug } : raw;
  const first = await searchFacilities({ ...p, cursor: undefined });
  const service = p.service ? services.data.find((s) => s.slug === p.service) : undefined;
  const query = toQueryString({ q: p.q, city: p.city, type: p.type, service: p.service, category: p.category, sort: p.sort, lat: p.lat, lng: p.lng });
  const heading = service ? t.search.priceFor(service.name) : p.q ? t.search.resultsFor(p.q) : t.search.title;
  const hasPoint = p.lat !== undefined && p.lng !== undefined;

  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-canvas/95 px-4 pb-3 backdrop-blur">
        <h1 className="m-0 pt-4 pb-3 text-xl leading-tight font-extrabold tracking-tight">{heading}</h1>
        <SearchForm placeholder={t.search.placeholder} defaultValue={matched ? raw.q : p.q} hidden={{ city: p.city, type: p.type }} />
        <div className="no-scrollbar -mx-4 mt-3 flex flex-wrap items-center gap-2 px-4">
          <FacilityFilters
            params={p}
            services={services.data.map((s) => ({ slug: s.slug, name: s.name, category: { slug: s.category.slug } }))}
            categories={categories.data.map((c) => ({ slug: c.slug, name: c.name }))}
          />
          <Suspense>
            <NearMe active={hasPoint} />
          </Suspense>
        </div>
      </header>

      <DemoNotice show={anyDemo(services, categories, first)} date={snapshotDate()} />

      {matched && (
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-2xl bg-primary-50 px-3.5 py-3 text-[0.82rem] text-primary-900" data-matched-service>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t.search.matchedService(matched.name)}{' '}
            <Link href={`/cari?${toQueryString({ q: raw.q, teks: '1' })}`} className="font-semibold text-primary-700 underline">
              {t.search.searchAsText(raw.q ?? '')}
            </Link>
          </span>
        </div>
      )}

      <div className="pt-4">
        <FacilityResults key={query} query={query} initial={first} />
      </div>
    </>
  );
}
