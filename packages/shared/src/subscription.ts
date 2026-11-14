import type { PartnerType } from './constants';

/**
 * Langganan mitra (Fase 11, flag `subscriptions_enabled`). Pembayaran lewat Duitku (POP).
 *
 * Aturan mutlak 1: langganan TIDAK PERNAH memengaruhi urutan atau tampilan hasil pencarian. Profil tetap tampil
 * walau langganan habis; langganan hanya membuka fitur non-peringkat di portal. Tidak ada badge.
 *
 * Model harga (mengikuti SILK versi lama, keputusan 2026-11-14): satu paket 12 bulan dengan harga per jenis
 * mitra, dan masa gratis 6 bulan sejak akun mitra diverifikasi. Harga ditentukan di server dari tabel ini;
 * nominal dari klien tidak pernah dipakai.
 */
export const SUBSCRIPTION_MONTHS = 12;
export const FREE_TRIAL_MONTHS = 6;

/** Harga paket 12 bulan (rupiah) per jenis mitra. */
export const SUBSCRIPTION_PRICES = {
  tenaga_medis: 300_000,
  fasilitas: 1_500_000,
  apotek: 1_500_000,
  gaya_hidup: 1_500_000,
} as const satisfies Record<PartnerType, number>;

export const subscriptionPrice = (type: PartnerType): number => SUBSCRIPTION_PRICES[type];

/** Satu paket yang bisa dipesan. Pesanan lama berpaket lain tetap terbaca (kolom `plan` berupa teks). */
export const SUBSCRIPTION_PLAN_IDS = ['tahunan'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN_IDS)[number];

/** Status pesanan pembayaran. `paid` final; `failed`/`expired` masih bisa menjadi `paid` bila dana ternyata masuk. */
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Masa berlaku tagihan Duitku (menit). Pesanan `pending` lebih lama dari ini dianggap kedaluwarsa. */
export const PAYMENT_EXPIRY_MINUTES = 60;

/** Mode penyedia: `simulator` = tanpa kunci Duitku (hanya dev/uji), halaman bayar tiruan di API. */
export const PAYMENT_PROVIDER_MODES = ['sandbox', 'production', 'simulator'] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDER_MODES)[number];

/** Tambah bulan kalender dalam UTC (31 Agustus + 6 bulan = 28/29 Februari, bukan 3 Maret). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Akhir masa gratis: 6 bulan sejak diverifikasi; null bila mitra belum diverifikasi. */
export const trialEndOf = (verifiedAt: Date | null): Date | null => (verifiedAt ? addMonths(verifiedAt, FREE_TRIAL_MONTHS) : null);

/**
 * Akhir masa aktif yang bersambung tanpa celah sejak `now`, dari masa gratis dan periode berbayar; null bila
 * tidak aktif sekarang. Jeda kurang dari 1 detik dianggap bersambung (pembulatan stempel waktu).
 */
export function activeUntilOf(now: Date, trialEnd: Date | null, periods: readonly { startsAt: Date; endsAt: Date }[]): Date | null {
  const spans = [...(trialEnd ? [{ startsAt: new Date(0), endsAt: trialEnd }] : []), ...periods].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  let until: number | null = null;
  for (const s of spans) {
    const start = s.startsAt.getTime();
    const end = s.endsAt.getTime();
    if (until === null) {
      if (start <= now.getTime() && end > now.getTime()) until = end;
    } else if (start <= until + 1000 && end > until) {
      until = end;
    }
  }
  return until === null ? null : new Date(until);
}
