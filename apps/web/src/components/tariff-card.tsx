import Link from 'next/link';
import { Check, Minus, Scale } from 'lucide-react';
import { PriceDisplay } from '@/components/price-display';
import { ReportDataDialog } from '@/components/report-data-dialog';
import { TariffHistoryDrawer } from '@/components/tariff-history-drawer';
import { TrustBadge } from '@/components/trust-badge';
import type { PublicTariff } from '@/lib/types';
import { t } from '@/messages/id';

/** Satu tarif terbit: harga, kepercayaan, isi paket, serta tautan banding, lapor, dan riwayat. Dipakai halaman faskes dan dokter. */
export function TariffCard({ tariff, facilityId, city }: { tariff: PublicTariff; facilityId: string; city: string }) {
  return (
    <article
      data-reveal
      className="tariff grid gap-4 rounded-card border border-line bg-white p-5 shadow-soft sm:p-6"
      aria-labelledby={`tariff-${tariff.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-muted">{tariff.service.category}</p>
          <h3 id={`tariff-${tariff.id}`} className="m-0 text-lg">
            {tariff.package ? `${tariff.package.name} (${tariff.service.name})` : tariff.service.name}
          </h3>
        </div>
        <PriceDisplay price={tariff.price} size="lg" />
      </div>
      <TrustBadge trust={tariff.trust} />
      {tariff.package && (
        <ul className="m-0 grid list-none gap-1.5 rounded-2xl bg-surface p-4 sm:grid-cols-2">
          {tariff.package.components.map((c) => (
            <li key={c.label} className={`flex items-start gap-2 text-[0.92rem] ${c.included ? 'text-ink' : 'text-muted'}`}>
              {c.included ? (
                <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Minus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {c.label} {!c.included && <span className="text-sm">({t.compare.notIncluded})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {(tariff.inclusions || tariff.exclusions) && (
        <div className="grid gap-1 text-[0.92rem] text-ink-soft">
          {tariff.inclusions && (
            <p className="m-0">
              <strong className="text-ink">{t.facility.includes}:</strong> {tariff.inclusions}
            </p>
          )}
          {tariff.exclusions && (
            <p className="m-0">
              <strong className="text-ink">{t.facility.excludes}:</strong> {tariff.exclusions}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-[0.92rem]">
        <Link
          href={`/bandingkan/${tariff.service.slug}?kota=${encodeURIComponent(city)}`}
          className="inline-flex items-center gap-1.5 font-semibold no-underline hover:underline"
        >
          <Scale className="size-4" aria-hidden="true" />
          {t.facility.compare}
        </Link>
        <ReportDataDialog tariffId={tariff.id} facilityId={facilityId} service={tariff.service.slug} />
        <TariffHistoryDrawer tariffId={tariff.id} />
      </div>
    </article>
  );
}
