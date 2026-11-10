import Link from 'next/link';
import { Scale } from 'lucide-react';
import { EstimateBadge } from '@/components/estimate-badge';
import { PriceDisplay } from '@/components/price-display';
import { TrustBadge } from '@/components/trust-badge';
import type { PublicTariff } from '@/lib/types';
import { t } from '@/messages/id';

/**
 * Biaya konsultasi di atas lipatan profil dokter (USP P1 + P2): harga, label perkiraan, tanggal, sumber,
 * dan status verifikasi, plus tautan banding ke dokter/praktik lain di kota yang sama.
 */
export function DoctorConsultation({ tariff, practiceName, city }: { tariff: PublicTariff | null; practiceName: string | null; city: string | null }) {
  if (!tariff) {
    return <p className="m-0 rounded-2xl border border-dashed border-line-strong bg-white px-4 py-3 text-sm text-muted">{t.doctors.noConsultation}</p>;
  }
  const compareHref = `/bandingkan/${tariff.service.slug}${city ? `?kota=${encodeURIComponent(city)}` : ''}`;
  return (
    <section aria-labelledby="biaya-konsultasi" className="grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="biaya-konsultasi" className="m-0 text-base">
            {t.doctors.consultation}
          </h2>
          <p className="m-0 text-sm text-muted">{tariff.service.name}</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <PriceDisplay price={tariff.price} size="lg" />
          <EstimateBadge price={tariff.price} />
        </span>
      </div>
      <TrustBadge trust={tariff.trust} />
      {practiceName && <p className="m-0 text-[0.85rem] text-muted">{t.doctors.consultationFrom(practiceName)}</p>}
      <Link href={compareHref} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold no-underline hover:underline">
        <Scale className="size-4" aria-hidden="true" />
        {t.doctors.compareConsultation}
      </Link>
    </section>
  );
}
