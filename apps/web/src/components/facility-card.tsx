import Link from 'next/link';
import { ArrowRight, MapPin, Navigation, Star } from 'lucide-react';
import type { FacilityListItem } from '@/lib/types';
import { t } from '@/messages/id';
import { PriceDisplay } from './price-display';
import { TrustBadge } from './trust-badge';

/**
 * Kartu hasil: identitas faskes di atas, harga menonjol di bawah (pola marketplace), tanpa iklan/peringkat.
 * Faskes tanpa tarif terbit diberi label "Tarif belum tersedia", bukan disembunyikan.
 */
export function FacilityCard({ facility }: { facility: FacilityListItem }) {
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line/80 bg-white p-5 shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft focus-within:border-primary-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift sm:p-6">
      <div className="min-w-0">
        <p className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[0.8rem]">
          <span className="rounded-full bg-mint px-2.5 py-0.5 font-semibold text-mint-ink">{t.facilityType[facility.type]}</span>
          <span className="rounded-full bg-surface px-2.5 py-0.5 font-medium text-ink-soft">{facility.city}</span>
          {facility.distanceM !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-0.5 font-medium text-sky-ink">
              <Navigation className="size-3" aria-hidden="true" />
              {t.search.distance(facility.distanceM)}
            </span>
          )}
          {facility.rating && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 font-medium text-ink-soft">
              <Star className="size-3" aria-hidden="true" />
              {t.search.ratingValue(facility.rating.avg, facility.rating.count)}
            </span>
          )}
        </p>
        <h3 className="mb-1.5 text-lg leading-snug">
          {/* Tautan menutupi seluruh kartu (after:inset-0) agar mudah diketuk di ponsel. */}
          <Link href={`/faskes/${facility.slug}`} className="text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary-800 hover:no-underline">
            {facility.name}
          </Link>
        </h3>
        <p className="m-0 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {facility.address}
        </p>
        {facility.nearestLocation && (
          <p className="mt-1.5 mb-0 flex items-start gap-1.5 text-sm text-ink-soft">
            <Navigation className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{t.search.nearestBranch}:</span>{' '}
              {[facility.nearestLocation.label, facility.nearestLocation.address].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
      </div>
      <div className="mt-auto grid gap-3 rounded-2xl bg-surface/80 p-4">
        {facility.price && facility.trust ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <PriceDisplay price={facility.price} />
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700" aria-hidden="true">
                {t.facility.detail} <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" />
              </span>
            </div>
            <TrustBadge trust={facility.trust} compact />
          </>
        ) : facility.publishedTariffCount === 0 ? (
          <span className="inline-flex items-center justify-between gap-2 text-sm font-semibold text-muted" data-no-tariff>
            {t.search.noTariff} <ArrowRight className="size-4 text-primary-700 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        ) : (
          <span className="inline-flex items-center justify-between gap-2 text-sm font-semibold text-primary-700" aria-hidden="true">
            {t.facility.tariffs} <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </article>
  );
}
