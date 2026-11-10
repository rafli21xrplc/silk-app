import { CONSULTATION_CATEGORY, type PriceType } from './constants';

interface TariffLike {
  service: { name: string; categorySlug: string };
  price: { type: PriceType };
}

/**
 * Biaya konsultasi dokter (evaluasi USP R3): tarif kategori `konsultasi` dari profil praktik utama.
 * Tarif berangka didahulukan atas "tanya", lalu nama layanan. Aturan yang sama dipakai SQL daftar dokter.
 */
export function pickConsultation<T extends TariffLike>(tariffs: readonly T[]): T | null {
  const candidates = tariffs.filter((t) => t.service.categorySlug === CONSULTATION_CATEGORY);
  candidates.sort(
    (a, b) => Number(a.price.type === 'tanya') - Number(b.price.type === 'tanya') || a.service.name.localeCompare(b.service.name, 'id'),
  );
  return candidates[0] ?? null;
}
