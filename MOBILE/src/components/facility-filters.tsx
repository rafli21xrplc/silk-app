'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { FACILITY_TYPES } from '@silk/shared';
import { CITIES } from '@/lib/home';
import { activeFacilityFilters, toQueryString, type FacilityParams } from '@/lib/search';
import { t } from '@/messages/id';
import { SelectField } from './field';
import { Sheet } from './sheet';

type Option = { slug: string; name: string };

/** Tombol Filter + lembar bawah: wilayah, jenis, kategori, layanan, dan urutan (netral). */
export function FacilityFilters({ params, services, categories }: { params: FacilityParams; services: (Option & { category: { slug: string } })[]; categories: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const set = (patch: Partial<FacilityParams>) => setDraft((d) => ({ ...d, ...patch }));
  const hasPoint = draft.lat !== undefined && draft.lng !== undefined;
  const visibleServices = draft.category ? services.filter((s) => s.category.slug === draft.category) : services;

  const apply = (p: FacilityParams) => {
    const sort = (p.sort === 'price_asc' || p.sort === 'price_desc') && !p.service ? undefined : p.sort;
    const qs = toQueryString({ q: p.q, city: p.city, type: p.type, category: p.category, service: p.service, sort, lat: p.lat, lng: p.lng, teks: p.teks });
    setOpen(false);
    router.push(qs ? `/cari?${qs}` : '/cari');
  };
  const count = activeFacilityFilters(params);

  const sortOptions = [
    { value: '', label: t.search.sortOptions.default! },
    ...(draft.service ? [{ value: 'price_asc', label: t.search.sortOptions.price_asc! }, { value: 'price_desc', label: t.search.sortOptions.price_desc! }] : []),
    { value: 'name', label: t.search.sortOptions.name! },
    ...(hasPoint ? [{ value: 'distance', label: t.search.sortOptions.distance! }] : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(params);
          setOpen(true);
        }}
        className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink"
        data-open-filters
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {t.search.filters}
        {count > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary-600 text-xs text-white">{count}</span>}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t.search.filtersTitle}
        footer={
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => apply({ q: params.q, lat: params.lat, lng: params.lng, teks: params.teks })}
              className="tap h-12 flex-1 rounded-full border border-line font-semibold text-ink"
            >
              {t.search.reset}
            </button>
            <button type="button" onClick={() => apply(draft)} className="tap h-12 flex-[2] rounded-full bg-primary-600 font-semibold text-white" data-apply-filters>
              {t.search.apply}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <SelectField
            label={t.search.city}
            value={draft.city ?? ''}
            onChange={(v) => set({ city: v || undefined })}
            options={[{ value: '', label: t.search.allCities }, ...CITIES.map((c) => ({ value: c, label: c }))]}
          />
          <SelectField
            label={t.search.type}
            value={draft.type ?? ''}
            onChange={(v) => set({ type: (v || undefined) as FacilityParams['type'] })}
            options={[{ value: '', label: t.search.allTypes }, ...FACILITY_TYPES.map((x) => ({ value: x, label: t.facilityType[x] ?? x }))]}
          />
          <SelectField
            label={t.search.category}
            value={draft.category ?? ''}
            onChange={(v) => set({ category: v || undefined, service: undefined })}
            options={[{ value: '', label: t.search.allCategories }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
          />
          <SelectField
            label={t.search.service}
            value={draft.service ?? ''}
            onChange={(v) => set({ service: v || undefined, sort: v ? draft.sort : draft.sort === 'price_asc' || draft.sort === 'price_desc' ? undefined : draft.sort })}
            options={[{ value: '', label: t.search.allServices }, ...visibleServices.map((s) => ({ value: s.slug, label: s.name }))]}
          />
          <SelectField
            label={t.search.sort}
            value={draft.sort ?? ''}
            onChange={(v) => set({ sort: (v || undefined) as FacilityParams['sort'] })}
            options={sortOptions}
            hint={draft.service ? undefined : t.search.sortPriceNeedsService}
          />
        </div>
      </Sheet>
    </>
  );
}
