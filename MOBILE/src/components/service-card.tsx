import Link from 'next/link';
import { cn } from '@/lib/cn';
import { priceRangeShort } from '@/lib/format';
import type { CityRange } from '@/lib/range';
import { t } from '@/messages/id';
import { PriceSpread } from './price-spread';

export interface ServiceCardData {
  slug: string;
  name: string;
  minPrice: number | null;
  maxPrice: number | null;
  facilityCount: number;
  cities: readonly CityRange[];
}

/**
 * Kartu harga satu layanan: nama, rentang besar, sebaran per wilayah, jumlah faskes.
 * Dipakai di karusel beranda dan grid katalog. Hanya untuk layanan yang sudah punya angka.
 */
export function ServiceCard({ service: s, wide = false, className }: { service: ServiceCardData; wide?: boolean; className?: string }) {
  if (wide) {
    // Versi melebar (kartu terakhir pada jumlah ganjil): nama di kiri, angka dan sebaran di kanan.
    return (
      <Link
        href={`/layanan/${s.slug}`}
        data-service-card
        className={cn('flex items-center gap-4 rounded-2xl bg-white p-3.5 text-ink no-underline active:bg-surface', className)}
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-sm leading-5 font-semibold">{s.name}</span>
          <span className="mt-1 block text-xs text-muted">{t.services.facilities(s.facilityCount)}</span>
        </span>
        <span className="w-[45%] shrink-0">
          <span className="block text-right text-lg leading-tight font-bold tracking-tight tabular-nums">{priceRangeShort(s.minPrice, s.maxPrice)}</span>
          <PriceSpread cities={s.cities} className="mt-2.5" />
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/layanan/${s.slug}`}
      data-service-card
      className={cn('flex flex-col rounded-2xl bg-white p-3.5 text-ink no-underline active:bg-surface', className)}
    >
      <span className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold">{s.name}</span>
      <span className="mt-2 text-lg leading-tight font-bold tracking-tight tabular-nums">{priceRangeShort(s.minPrice, s.maxPrice)}</span>
      <PriceSpread cities={s.cities} className="mt-3" />
      <span className="mt-2.5 text-xs text-muted">{t.services.facilities(s.facilityCount)}</span>
    </Link>
  );
}
