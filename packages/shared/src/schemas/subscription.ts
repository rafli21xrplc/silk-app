import { z } from 'zod';
import { PARTNER_TYPES } from '../constants';
import { PAYMENT_PROVIDER_MODES, PAYMENT_STATUSES, SUBSCRIPTION_PLAN_IDS } from '../subscription';
import { uuidSchema } from './common';

export const subscriptionOrderInputSchema = z.object({ plan: z.enum(SUBSCRIPTION_PLAN_IDS) });
export type SubscriptionOrderInput = z.infer<typeof subscriptionOrderInputSchema>;

export const paymentOrderSchema = z.object({
  id: uuidSchema,
  merchantOrderId: z.string(),
  /** Teks: pesanan lama bisa memakai paket yang sudah tidak dijual. */
  plan: z.string(),
  months: z.number().int(),
  amount: z.number().int(),
  status: z.enum(PAYMENT_STATUSES),
  /** Halaman bayar Duitku; hanya ada selama pesanan `pending`. */
  paymentUrl: z.string().nullable(),
  expiresAt: z.string(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PaymentOrder = z.infer<typeof paymentOrderSchema>;

export const subscriptionPeriodSchema = z.object({
  plan: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const subscriptionOverviewSchema = z.object({
  /** Masa aktif sampai kapan, termasuk masa gratis (null = tidak aktif). */
  activeUntil: z.string().nullable(),
  /** Akhir masa gratis 6 bulan sejak verifikasi; null bila belum diverifikasi. */
  trialEndsAt: z.string().nullable(),
  partnerType: z.enum(PARTNER_TYPES),
  periods: z.array(subscriptionPeriodSchema),
  orders: z.array(paymentOrderSchema),
  /** Paket yang bisa dipesan, dengan harga untuk jenis mitra ini. */
  plans: z.array(z.object({ id: z.enum(SUBSCRIPTION_PLAN_IDS), months: z.number().int(), price: z.number().int() })),
  /** `sandbox` dan `simulator` berarti tidak ada uang sungguhan; UI wajib memberi label. */
  providerMode: z.enum(PAYMENT_PROVIDER_MODES),
});
export type SubscriptionOverview = z.infer<typeof subscriptionOverviewSchema>;
