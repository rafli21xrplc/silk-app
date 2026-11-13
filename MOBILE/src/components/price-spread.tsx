import { cn } from '@/lib/cn';
import { spreadMarks, type CityRange } from '@/lib/range';

/**
 * Batang sebaran ringkas untuk kartu layanan: ruas = rentang tiap wilayah, titik = nilai tengahnya.
 * Dekoratif bagi pembaca layar; angka rentang selalu tertulis di atasnya.
 */
export function PriceSpread({ cities, className }: { cities: readonly CityRange[]; className?: string }) {
  const { segments, medians } = spreadMarks(cities);
  if (segments.length === 0) return null;
  return (
    <span className={cn('relative block h-1.5 rounded-full bg-surface', className)} aria-hidden="true">
      {segments.map((s, i) => (
        <span
          key={i}
          className="absolute inset-y-0 rounded-full bg-primary-300"
          style={{ left: `${s.left}%`, width: `max(${s.width}%, 0.375rem)`, translate: s.width === 0 ? '-50%' : undefined }}
        />
      ))}
      {medians.map((m, i) => (
        <span
          key={i}
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-700"
          style={{ left: `${m}%` }}
        />
      ))}
    </span>
  );
}
