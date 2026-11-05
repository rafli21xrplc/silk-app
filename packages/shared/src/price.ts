import type { PriceType } from './constants';

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Format rupiah integer menjadi `Rp1.250.000` (tanpa spasi, sesuai M2). */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rp${numberFormat.format(Math.abs(Math.trunc(amount)))}`;
}

export interface PriceLabels {
  ask: string;
  from: string;
}

export const DEFAULT_PRICE_LABELS: PriceLabels = {
  ask: 'Tanyakan ke faskes',
  from: 'Mulai',
};

export interface PriceValue {
  type: PriceType;
  min: number | null;
  max: number | null;
}

/** Teks harga sesuai `price_type`. Tarif `tanya` tidak pernah tampil sebagai angka nol. */
export function formatPrice(price: PriceValue, labels: PriceLabels = DEFAULT_PRICE_LABELS): string {
  if (price.type === 'tanya' || price.min === null) return labels.ask;
  switch (price.type) {
    case 'rentang':
      return price.max !== null && price.max !== price.min
        ? `${formatRupiah(price.min)}–${formatRupiah(price.max)}`
        : formatRupiah(price.min);
    case 'mulai_dari':
      return `${labels.from} ${formatRupiah(price.min)}`;
    case 'paket':
    case 'tetap':
      return price.max !== null && price.max !== price.min
        ? `${formatRupiah(price.min)}–${formatRupiah(price.max)}`
        : formatRupiah(price.min);
  }
}

export interface PriceFieldIssue {
  path: 'priceMin' | 'priceMax' | 'packageId';
  message: string;
}

/**
 * Aturan kolom wajib per `price_type` (M2). Mengembalikan daftar masalah; kosong berarti valid.
 * `hasPackage` dipakai untuk tipe `paket`.
 */
export function checkPriceFields(input: {
  priceType: PriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  hasPackage: boolean;
}): PriceFieldIssue[] {
  const issues: PriceFieldIssue[] = [];
  const min = input.priceMin ?? null;
  const max = input.priceMax ?? null;

  if (input.priceType === 'tanya') {
    if (min !== null) issues.push({ path: 'priceMin', message: 'Tarif "tanya" tidak boleh berisi harga' });
    if (max !== null) issues.push({ path: 'priceMax', message: 'Tarif "tanya" tidak boleh berisi harga' });
    return issues;
  }

  if (min === null) issues.push({ path: 'priceMin', message: 'Harga wajib diisi' });

  if (input.priceType === 'rentang') {
    if (max === null) issues.push({ path: 'priceMax', message: 'Harga maksimum wajib untuk rentang' });
  } else if ((input.priceType === 'tetap' || input.priceType === 'mulai_dari') && max !== null) {
    issues.push({ path: 'priceMax', message: 'Harga maksimum hanya untuk tipe rentang atau paket' });
  }

  if (min !== null && max !== null && max < min) {
    issues.push({ path: 'priceMax', message: 'Harga maksimum tidak boleh lebih kecil dari harga minimum' });
  }

  if (input.priceType === 'paket' && !input.hasPackage) {
    issues.push({ path: 'packageId', message: 'Tarif paket wajib terkait paket' });
  }
  return issues;
}

/** Nilai pembanding untuk pengurutan harga; tarif `tanya` selalu di akhir. */
export function priceSortKey(price: PriceValue): number {
  return price.type === 'tanya' || price.min === null ? Number.POSITIVE_INFINITY : price.min;
}
