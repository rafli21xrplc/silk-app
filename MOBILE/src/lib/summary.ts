import { formatRupiah, type FacilityListItem, type ServiceDetail } from '@silk/shared';
import { t } from '../messages/id';

/** Ringkasan harga satu layanan dari semua wilayah. */
export interface ServiceSummary {
  minPrice: number | null;
  maxPrice: number | null;
  facilityCount: number;
  cityCount: number;
  latestVerifiedAt: string | null;
}

export function summarizeCities(cities: ServiceDetail['cities']): ServiceSummary {
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let facilityCount = 0;
  let latestVerifiedAt: string | null = null;
  for (const c of cities) {
    facilityCount += c.facilityCount;
    if (c.minPrice !== null) minPrice = minPrice === null ? c.minPrice : Math.min(minPrice, c.minPrice);
    const high = c.maxPrice ?? c.minPrice;
    if (high !== null) maxPrice = maxPrice === null ? high : Math.max(maxPrice, high);
    if (c.latestVerifiedAt && (!latestVerifiedAt || Date.parse(c.latestVerifiedAt) > Date.parse(latestVerifiedAt))) latestVerifiedAt = c.latestVerifiedAt;
  }
  return { minPrice, maxPrice, facilityCount, cityCount: cities.length, latestVerifiedAt };
}

export type HighlightKey = 'tarif' | 'konsultasi' | 'dokter' | 'video';

/** Ringkasan isi profil di kartu faskes (tanpa filter layanan). Butir kosong tidak ditampilkan. */
export function facilityHighlights(
  f: Pick<FacilityListItem, 'publishedTariffCount' | 'consultationFeeMin' | 'practitionerCount' | 'hasVideo'>,
): { key: HighlightKey; label: string }[] {
  const out: { key: HighlightKey; label: string }[] = [];
  if (f.publishedTariffCount > 0) out.push({ key: 'tarif', label: t.search.summary.tariffs(f.publishedTariffCount) });
  if (typeof f.consultationFeeMin === 'number' && Number.isFinite(f.consultationFeeMin)) {
    out.push({ key: 'konsultasi', label: t.search.summary.consultation(formatRupiah(f.consultationFeeMin)) });
  }
  if (f.practitionerCount > 0) out.push({ key: 'dokter', label: t.search.summary.doctors(f.practitionerCount) });
  if (f.hasVideo === true) out.push({ key: 'video', label: t.search.summary.video });
  return out;
}
