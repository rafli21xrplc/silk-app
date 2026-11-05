import Link from 'next/link';
import { ArrowRight, Building2, MapPin } from 'lucide-react';
import { formatRupiah } from '@silk/shared';
import { buttonVariants } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { priceRangeText, scalePercent } from '@/lib/service-summary';
import type { ServiceDetail } from '@/lib/types';
import { t } from '@/messages/id';

type CityPrice = ServiceDetail['cities'][number];

/**
 * Ringkasan harga satu wilayah. Bar di bawah angka menunjukkan posisi rentang wilayah ini pada skala
 * semua wilayah (titik = median). Bar dekoratif: semua angkanya tertulis sebagai teks.
 */
export function CityPriceCard({
  serviceSlug,
  city: c,
  scale,
}: {
  serviceSlug: string;
  city: CityPrice;
  scale: { min: number; max: number } | null;
}) {
  const range = priceRangeText(c.minPrice, c.maxPrice);
  const left = scale && c.minPrice !== null ? scalePercent(c.minPrice, scale.min, scale.max) : 0;
  const right =
    scale && c.minPrice !== null ? scalePercent(c.maxPrice ?? c.minPrice, scale.min, scale.max) : 100;
  const flat = scale !== null && scale.max <= scale.min;
  const median = scale && c.medianPrice !== null && !flat ? scalePercent(c.medianPrice, scale.min, scale.max) : 50;

  return (
    <article className="flex h-full flex-col rounded-card border border-line/80 bg-white p-5 shadow-soft transition-shadow duration-300 ease-soft hover:shadow-lift sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          <MapPin className="size-[18px] text-primary-600" aria-hidden="true" />
          {c.city}
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-sm font-semibold text-ink-soft tabular-nums">
          <Building2 className="size-3.5 text-muted" aria-hidden="true" />
          {t.services.facilityCount(c.facilityCount)}
        </span>
      </div>

      <p className="m-0 mt-5 text-xs font-semibold tracking-wide text-muted uppercase">{t.services.range}</p>
      <p className="m-0 mt-1 text-[clamp(1.25rem,1.1rem+0.6vw,1.6rem)] leading-tight font-extrabold tracking-[-0.01em] text-ink tabular-nums">
        {range ?? <span className="text-lg font-semibold text-muted">{t.price.ask}</span>}
      </p>

      {c.minPrice !== null && (
        <div aria-hidden="true" className="relative mt-4 h-2 rounded-full bg-surface-2">
          <span
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary-300 to-primary-500"
            style={{ left: `${flat ? 0 : left}%`, width: `${flat ? 100 : Math.max(3, right - left)}%` }}
          />
          {c.medianPrice !== null && (
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-800 shadow-soft"
              style={{ left: `${median}%` }}
            />
          )}
        </div>
      )}

      <dl className="m-0 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface/70 px-3.5 py-2.5">
          <dt className="text-xs text-muted">{t.services.median}</dt>
          <dd className="m-0 font-semibold text-ink tabular-nums">
            {c.medianPrice !== null ? formatRupiah(c.medianPrice) : '–'}
          </dd>
        </div>
        <div className="rounded-2xl bg-surface/70 px-3.5 py-2.5">
          <dt className="text-xs text-muted">{t.services.latest}</dt>
          <dd className="m-0 font-semibold text-ink">{formatDate(c.latestVerifiedAt)}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-5">
        <Link
          href={`/bandingkan/${serviceSlug}?kota=${encodeURIComponent(c.city)}`}
          className={buttonVariants({ variant: 'primary', className: 'w-full' })}
        >
          {t.services.compareIn(c.city)}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
