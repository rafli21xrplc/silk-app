import { formatRupiah } from '@silk/shared';
import { matchesQuery } from './search-text';
import type { ServiceDetail, ServiceListItem } from './types';

type CityPrice = ServiceDetail['cities'][number];

/** Ringkasan satu layanan dari semua wilayah: dipakai kartu katalog dan kepala halaman detail. */
export interface ServiceSummary {
  minPrice: number | null;
  maxPrice: number | null;
  facilityCount: number;
  cityCount: number;
  /** Nama wilayah yang punya tarif terbit. */
  cities: string[];
  latestVerifiedAt: string | null;
}

/** Item katalog: data daftar + alias (untuk pencarian) + ringkasan harga (null bila detail gagal dimuat). */
export interface CatalogItem extends ServiceListItem {
  aliases: string[];
  summary: ServiceSummary | null;
}

export function summarizeCities(cities: CityPrice[]): ServiceSummary {
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let facilityCount = 0;
  let latestVerifiedAt: string | null = null;
  for (const c of cities) {
    facilityCount += c.facilityCount;
    if (c.minPrice !== null) minPrice = minPrice === null ? c.minPrice : Math.min(minPrice, c.minPrice);
    const high = c.maxPrice ?? c.minPrice;
    if (high !== null) maxPrice = maxPrice === null ? high : Math.max(maxPrice, high);
    if (c.latestVerifiedAt && (!latestVerifiedAt || Date.parse(c.latestVerifiedAt) > Date.parse(latestVerifiedAt))) {
      latestVerifiedAt = c.latestVerifiedAt;
    }
  }
  return { minPrice, maxPrice, facilityCount, cityCount: cities.length, cities: cities.map((c) => c.city), latestVerifiedAt };
}

/** Posisi nilai pada skala [min, max] dalam persen (0–100). Skala datar = 0. */
export function scalePercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** Jalankan `fn` untuk setiap item dengan paling banyak `limit` sekaligus; urutan hasil tetap. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** Kelompokkan per kategori dengan urutan kemunculan pertama (urutan dari API). */
export function groupByCategory<T extends { category: { slug: string; name: string } }>(items: T[]) {
  const groups = new Map<string, { slug: string; name: string; items: T[] }>();
  for (const item of items) {
    const g = groups.get(item.category.slug) ?? { slug: item.category.slug, name: item.category.name, items: [] };
    g.items.push(item);
    groups.set(item.category.slug, g);
  }
  return [...groups.values()];
}

/** Rentang harga ringkas: satu angka bila min = max; null bila belum ada harga. */
export function priceRangeText(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  const hi = max ?? min;
  return hi === min ? formatRupiah(min) : `${formatRupiah(min)} – ${formatRupiah(hi)}`;
}

/** Cari di nama, deskripsi, alias, dan nama kategori; lalu saring kategori ('' = semua). */
export function filterCatalog(items: CatalogItem[], query: string, category: string): CatalogItem[] {
  return items.filter(
    (s) =>
      (category === '' || s.category.slug === category) &&
      matchesQuery(`${s.name} ${s.description ?? ''} ${s.aliases.join(' ')} ${s.category.name}`, query),
  );
}
