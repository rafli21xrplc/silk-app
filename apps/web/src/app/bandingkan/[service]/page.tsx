import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ComparisonTable } from '@/components/comparison-table';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { ShareLinkButton } from '@/components/share-link-button';
import { Select } from '@/components/ui/select';
import { AutoSubmitCheckbox } from '@/components/auto-submit-checkbox';
import { ArrowUpDown, MapPin } from 'lucide-react';
import { TrackView } from '@/components/track-view';
import { apiGet, apiGetOrNull, ApiError } from '@/lib/api';
import { siteNoIndex } from '@/lib/seo';
import type { CompareResponse, ServiceDetail } from '@/lib/types';
import { t } from '@/messages/id';

type Params = Promise<{ service: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function readQuery(sp: Record<string, string | string[] | undefined>) {
  return {
    city: one(sp.kota),
    hideStale: one(sp.usang) === 'sembunyi',
    sort: one(sp.urut) === 'harga_turun' ? ('price_desc' as const) : one(sp.urut) === 'nama' ? ('name' as const) : ('price_asc' as const),
    facilityIds: one(sp.faskes),
  };
}

/** URL kanonik: hanya parameter yang mengubah isi (layanan + kota atau daftar faskes). */
function canonicalOf(service: string, q: ReturnType<typeof readQuery>) {
  if (q.facilityIds) return `/bandingkan/${service}?faskes=${encodeURIComponent(q.facilityIds)}`;
  return `/bandingkan/${service}${q.city ? `?kota=${encodeURIComponent(q.city)}` : ''}`;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { service } = await params;
  const q = readQuery(await searchParams);
  const s = await apiGetOrNull<ServiceDetail>(`/services/${encodeURIComponent(service)}`, { tags: [`service:${service}`] });
  if (!s) return { title: t.notFound.title, robots: { index: false } };
  const city = q.city ?? '';
  return {
    title: t.compare.title(s.name, city),
    description: `Bandingkan tarif dan isi paket ${s.name}${city ? ` di ${city}` : ''}, lengkap dengan tanggal verifikasi dan sumber data.`,
    alternates: { canonical: canonicalOf(service, q) },
    // Variasi filter/urutan tidak diindeks supaya tidak ada konten duplikat.
    robots: { index: !siteNoIndex() && !q.hideStale && q.sort === 'price_asc', follow: true },
  };
}

export default async function ComparePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { service } = await params;
  const q = readQuery(await searchParams);
  const s = await apiGetOrNull<ServiceDetail>(`/services/${encodeURIComponent(service)}`, { tags: [`service:${service}`] });
  if (!s) notFound();
  const city = q.city ?? (q.facilityIds ? undefined : s.cities[0]?.city);

  const qs = new URLSearchParams({ service, sort: q.sort });
  if (q.facilityIds) qs.set('facilityIds', q.facilityIds);
  else if (city) qs.set('city', city);
  if (q.hideStale) qs.set('hideStale', 'true');

  let data: CompareResponse | null = null;
  if (q.facilityIds || city) {
    try {
      data = (await apiGet<CompareResponse>(`/compare?${qs}`, { tags: [`compare:${service}`] })).data;
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 400 || err.status === 404))) throw err;
    }
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { name: 'Beranda', path: '/' },
          { name: s.name, path: `/layanan/${s.slug}` },
          { name: t.facility.compare, path: canonicalOf(service, { ...q, city }) },
        ]}
      />
      <header className="mb-6 max-w-3xl">
        <h1>{t.compare.title(s.name, q.facilityIds ? '' : (city ?? ''))}</h1>
        <p className="m-0 text-lg text-muted">{t.compare.intro}</p>
      </header>

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filter perbandingan">
        {q.facilityIds ? (
          <input type="hidden" name="faskes" value={q.facilityIds} />
        ) : (
          <Select
            variant="chip"
            name="kota"
            defaultValue={city ?? ''}
            label={t.compare.city}
            autoSubmit
            icon={<MapPin className="size-4" />}
            options={s.cities.map((c) => ({ value: c.city, label: c.city, hint: `${c.facilityCount} ${t.services.facilities.toLowerCase()}` }))}
          />
        )}
        <Select
          variant="chip"
          name="urut"
          defaultValue={q.sort === 'price_desc' ? 'harga_turun' : q.sort === 'name' ? 'nama' : 'harga_naik'}
          label={t.search.sort}
          autoSubmit
          icon={<ArrowUpDown className="size-4" />}
          options={[
            { value: 'harga_naik', label: t.search.sortOptions.price_asc },
            { value: 'harga_turun', label: t.search.sortOptions.price_desc },
            { value: 'nama', label: t.search.sortOptions.name },
          ]}
        />
        <AutoSubmitCheckbox name="usang" value="sembunyi" defaultChecked={q.hideStale}>
          {t.compare.hideStale}
        </AutoSubmitCheckbox>
        <noscript>
          <button type="submit" className="btn">
            {t.search.submit}
          </button>
        </noscript>
      </form>

      <DisclaimerBanner />
      {!data || data.rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-white p-8 text-center text-muted">{t.compare.empty}</p>
      ) : (
        <ComparisonTable data={data} />
      )}
      <ShareLinkButton />
      <TrackView event="compare_viewed" props={{ service, city: city ?? null, rows: data?.rows.length ?? 0 }} />
    </div>
  );
}
