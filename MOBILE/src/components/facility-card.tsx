import type { FacilityListItem } from '@silk/shared';
import { facilityPhoto } from '@/lib/photos';
import { facilityHighlights } from '@/lib/summary';
import { t } from '@/messages/id';
import { ListRow } from './list';
import { Thumb } from './photo';
import { PriceValue } from './price';
import { TrustNote } from './trust';

/**
 * Baris hasil pencarian faskes: nama dan keterangan di kiri, harga layanan yang dicari rata kanan.
 * Tanpa harga: ringkasan isi profil sebagai teks pendek (bukan deretan pil).
 */
export function FacilityRow({ facility: f, common }: { facility: FacilityListItem; common: string | null }) {
  const meta = [t.facilityType[f.type] ?? f.type, f.city, f.distanceM !== null ? t.search.distance(f.distanceM) : null].filter(Boolean).join(' · ');
  const highlights = f.price ? [] : facilityHighlights(f);
  return (
    <ListRow
      marker="facility-card"
      href={`/faskes/${f.slug}`}
      align="start"
      chevron={false}
      leading={<Thumb photo={facilityPhoto(f.slug)} />}
      title={<span className="font-semibold">{f.name}</span>}
      sub={
        <>
          <span className="block">{meta}</span>
          <span className="block truncate">{f.nearestLocation ? f.nearestLocation.address : f.address}</span>
          {f.price && f.trust ? (
            <span className="mt-1 block" data-price>
              <TrustNote trust={f.trust} common={common} />
            </span>
          ) : highlights.length > 0 ? (
            <span className="mt-1 block font-medium text-ink-soft" data-summary>
              {highlights.map((h) => h.label).join(' · ')}
            </span>
          ) : (
            <span className="mt-1 block">{t.search.noTariff}</span>
          )}
        </>
      }
      trailing={f.price ? <PriceValue price={f.price} /> : undefined}
    />
  );
}
