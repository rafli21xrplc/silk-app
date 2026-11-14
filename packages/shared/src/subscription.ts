/**
 * Langganan mitra (Fase 11, flag `subscriptions_enabled`). Pembayaran lewat Duitku (POP).
 *
 * Aturan mutlak 1: langganan TIDAK PERNAH memengaruhi urutan atau tampilan hasil pencarian. Langganan hanya
 * membuka fitur non-peringkat di portal (statistik, jumlah foto, jadwal lanjutan). Tidak ada badge.
 *
 * Harga ditentukan di server dari tabel ini; nominal dari klien tidak pernah dipakai.
 */
export const SUBSCRIPTION_PLANS = {
  bulanan: { months: 1, price: 99_000 },
  tahunan: { months: 12, price: 990_000 },
} as const satisfies Record<string, { months: number; price: number }>;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;
export const SUBSCRIPTION_PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as [SubscriptionPlan, ...SubscriptionPlan[]];

/** Status pesanan pembayaran. `paid` final; `failed`/`expired` masih bisa menjadi `paid` bila dana ternyata masuk. */
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Masa berlaku tagihan Duitku (menit). Pesanan `pending` lebih lama dari ini dianggap kedaluwarsa. */
export const PAYMENT_EXPIRY_MINUTES = 60;

/** Mode penyedia: `simulator` = tanpa kunci Duitku (hanya dev/uji), halaman bayar tiruan di API. */
export const PAYMENT_PROVIDER_MODES = ['sandbox', 'production', 'simulator'] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDER_MODES)[number];
