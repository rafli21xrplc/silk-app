import { formatRupiah } from '@silk/shared';
import { rangePositions } from '@/lib/range';
import { t } from '@/messages/id';

/**
 * Sebaran harga: satu tanda per faskes, nilai tengah ditebalkan. Data, bukan hiasan:
 * pasien melihat apakah satu harga wajar dibanding faskes lain di wilayah yang sama.
 */
export function RangeBar({ values, median, label }: { values: number[]; median: number | null; label: string }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pos = rangePositions(values, min, max);
  const [medianPos] = median !== null ? rangePositions([median], min, max) : [null];
  return (
    <figure className="m-0" aria-label={label}>
      <div className="relative mx-1 mt-3 h-2 rounded-full bg-primary-100" aria-hidden="true">
        {pos.map((p, i) => (
          <span key={i} className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-primary-600/70" style={{ left: `${p}%` }} />
        ))}
        {medianPos !== null && medianPos !== undefined && (
          <span className="absolute -top-1.5 h-5 w-1 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${medianPos}%` }} />
        )}
      </div>
      <figcaption className="mt-2 flex justify-between gap-2 text-xs text-muted tabular-nums">
        <span>{formatRupiah(min)}</span>
        {median !== null && <span className="font-semibold text-ink">{t.services.median(formatRupiah(median))}</span>}
        <span>{formatRupiah(max)}</span>
      </figcaption>
    </figure>
  );
}
