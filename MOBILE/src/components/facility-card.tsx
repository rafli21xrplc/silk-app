import Link from 'next/link';
import { ChevronRight, MapPin, Navigation } from 'lucide-react';
import type { FacilityListItem } from '@silk/shared';
import { cn } from '@/lib/cn';
import { facilityHighlights } from '@/lib/summary';
import { t } from '@/messages/id';
import { PriceTag } from './price';
import { TrustLine } from './trust';

/** Kartu hasil pencarian faskes: identitas, lalu harga layanan yang dicari atau ringkasan isi profil. */
export function FacilityCard({ facility: f }: { facility: FacilityListItem }) {
  const highlights = f.price ? [] : facilityHighlights(f);
  return (
    <Link
      href={`/faskes/${f.slug}`}
      className="tap block rounded-card border border-line/80 bg-white p-4 text-ink no-underline shadow-soft"
      data-facility-card
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-semibold">
            <span className="rounded-full bg-mint px-2 py-0.5 text-mint-ink">{t.facilityType[f.type] ?? f.type}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-ink-soft">{f.city}</span>
            {f.distanceM !== null && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky px-2 py-0.5 text-sky-ink">
                <Navigation className="size-3" aria-hidden="true" />
                {t.search.distance(f.distanceM)}
              </span>
            )}
          </span>
          <span className="block text-[1.02rem] leading-snug font-bold">{f.name}</span>
          <span className="mt-1 flex items-start gap-1 text-[0.8rem] text-muted">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{f.nearestLocation ? f.nearestLocation.address : f.address}</span>
          </span>
        </span>
        <ChevronRight className="mt-6 size-5 shrink-0 text-muted" aria-hidden="true" />
      </span>

      {f.price && f.trust ? (
        <span className="mt-3 grid gap-1.5 rounded-2xl bg-surface/80 px-3.5 py-3" data-price>
          <PriceTag price={f.price} />
          <TrustLine trust={f.trust} />
        </span>
      ) : highlights.length > 0 ? (
        <span className="mt-3 flex flex-wrap gap-1.5" aria-label={t.search.summary.label} data-summary>
          {highlights.map((h) => (
            <span
              key={h.key}
              className={cn(
                'rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
                h.key === 'konsultasi' ? 'bg-mint text-mint-ink' : 'bg-surface text-ink-soft',
              )}
            >
              {h.label}
            </span>
          ))}
        </span>
      ) : (
        <span className="mt-3 block rounded-2xl border border-dashed border-line-strong px-3.5 py-2.5 text-[0.8rem] font-semibold text-muted">{t.search.noTariff}</span>
      )}
    </Link>
  );
}
