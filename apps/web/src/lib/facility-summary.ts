import { formatRupiah } from '@silk/shared';
import { t } from '../messages/id';
import type { FacilityListItem } from './types';

export type FacilityHighlightKey = 'tarif' | 'konsultasi' | 'dokter' | 'video';
export interface FacilityHighlight {
  key: FacilityHighlightKey;
  label: string;
}

type SummaryFields = Pick<FacilityListItem, 'publishedTariffCount' | 'consultationFeeMin' | 'practitionerCount' | 'hasVideo'>;

/**
 * Ringkasan isi profil untuk kartu hasil tanpa filter layanan (evaluasi UI/UX A2):
 * pasien langsung melihat apa yang bisa diketahui sebelum datang, bukan bar kosong.
 * Urutan tetap mengikuti USP: biaya dulu, lalu kenal dokternya. Butir yang kosong tidak ditampilkan.
 * Toleran terhadap respons lama tanpa kolom ringkasan (cache ISR saat rilis): butirnya dilewati.
 */
export function facilityHighlights(f: SummaryFields): FacilityHighlight[] {
  const out: FacilityHighlight[] = [];
  if (f.publishedTariffCount > 0) out.push({ key: 'tarif', label: t.search.summary.tariffs(f.publishedTariffCount) });
  if (typeof f.consultationFeeMin === 'number' && Number.isFinite(f.consultationFeeMin)) out.push({ key: 'konsultasi', label: t.search.summary.consultation(formatRupiah(f.consultationFeeMin)) });
  if (f.practitionerCount > 0) out.push({ key: 'dokter', label: t.search.summary.doctors(f.practitionerCount) });
  if (f.hasVideo === true) out.push({ key: 'video', label: t.search.summary.video });
  return out;
}
