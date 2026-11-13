import type { Metadata } from 'next';
import { DemoNotice } from '@/components/demo-notice';
import { ServiceCatalog, type CatalogItem } from '@/components/service-catalog';
import { mapLimit } from '@/lib/limit';
import { anyDemo, getCategories, getService, getServices, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.services.title };

/** Urutan kategori menurut kebutuhan pasien (evaluasi UI/UX P1 #9); kategori lain di akhir. */
const CATEGORY_ORDER = ['laboratorium', 'konsultasi', 'mcu', 'rawat-inap', 'radiologi-penunjang', 'gaya-hidup-sehat', 'rumah-duka'];
const rank = (slug: string) => {
  const i = CATEGORY_ORDER.indexOf(slug);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const kategori = (await searchParams).kategori;
  const [services, categories] = await Promise.all([getServices(), getCategories()]);
  const details = await mapLimit(services.data, 8, (s) => getService(s.slug));
  const items: CatalogItem[] = services.data
    .map((s, i) => {
      const d = details[i];
      const sum = d ? summarizeCities(d.data.cities) : null;
      return {
        slug: s.slug,
        name: s.name,
        aliases: s.aliases,
        category: s.category,
        minPrice: sum?.minPrice ?? null,
        maxPrice: sum?.maxPrice ?? null,
        facilityCount: sum?.facilityCount ?? 0,
      };
    })
    // Kategori menurut kebutuhan; layanan berharga lebih dulu dalam satu kategori (bukan pembayaran).
    .sort((a, b) => rank(a.category.slug) - rank(b.category.slug) || Number(a.minPrice === null) - Number(b.minPrice === null));
  const cats = [...categories.data].filter((c) => c.serviceCount > 0).sort((a, b) => rank(a.slug) - rank(b.slug));

  return (
    <>
      <header className="pt-safe px-5">
        <h1 className="m-0 pt-5 pb-1 text-2xl font-bold tracking-tight">{t.services.title}</h1>
      </header>
      <DemoNotice show={anyDemo(services, categories, ...details)} date={snapshotDate()} />
      <ServiceCatalog items={items} categories={cats.map((c) => ({ slug: c.slug, name: c.name }))} initialCategory={typeof kategori === 'string' ? kategori : ''} />
    </>
  );
}
