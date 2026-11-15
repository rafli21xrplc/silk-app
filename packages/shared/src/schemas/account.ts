import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  FACILITY_TYPES,
  PARTNER_STATUSES,
  PARTNER_TYPES,
  USER_ROLES,
} from '../constants';
import { cursorSchema, limitSchema, searchTextSchema, uuidSchema } from './common';

/* ---------- Akun (F-01) ---------- */

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

/** Nomor HP Indonesia: 08xx atau +628xx / 628xx. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?62|0)8\d{7,12}$/, 'Nomor HP tidak valid (contoh: 081234567890)');

/** Normalisasi ke +62… agar satu nomor tidak tersimpan dalam dua bentuk. Input harus lolos `phoneSchema`. */
export function normalizePhone(phone: string): string {
  const digits = phone.trim().replace(/^\+/, '');
  return digits.startsWith('62') ? `+${digits}` : `+62${digits.slice(1)}`;
}

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  // String kosong dari form = hapus nomor.
  phone: z.preprocess((v) => (v === '' ? null : v), phoneSchema.transform(normalizePhone).nullable()),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/* ---------- Mitra ---------- */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const partnerBase = {
  businessName: text(2, 150),
  licenseNo: text(3, 100),
};

/** Data usaha dan izin per jenis mitra (atribut diagram kelas SRS). Jenis ditentukan role akun. */
export const partnerUpsertSchema = z.discriminatedUnion('partnerType', [
  z.object({
    partnerType: z.literal('tenaga_medis'),
    ...partnerBase,
    specialty: text(2, 100),
    strNo: text(5, 50),
  }),
  z.object({
    partnerType: z.literal('fasilitas'),
    ...partnerBase,
    facilityKind: z.enum(FACILITY_TYPES),
    roomCount: z.number().int().min(0).max(10_000).nullable().optional(),
  }),
  z.object({
    partnerType: z.literal('gaya_hidup'),
    ...partnerBase,
    field: text(2, 100),
  }),
  z.object({
    partnerType: z.literal('apotek'),
    ...partnerBase,
    siaNo: text(3, 100),
  }),
]);
export type PartnerUpsertInput = z.infer<typeof partnerUpsertSchema>;

export const partnerSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  partnerType: z.enum(PARTNER_TYPES),
  businessName: z.string(),
  licenseNo: z.string().nullable(),
  status: z.enum(PARTNER_STATUSES),
  rejectionReason: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  specialty: z.string().nullable(),
  strNo: z.string().nullable(),
  facilityKind: z.enum(FACILITY_TYPES).nullable(),
  roomCount: z.number().int().nullable(),
  field: z.string().nullable(),
  siaNo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Partner = z.infer<typeof partnerSchema>;

export const partnerQueueQuerySchema = z.object({
  status: z.enum(PARTNER_STATUSES).default('pending'),
  type: z.enum(PARTNER_TYPES).optional(),
  q: searchTextSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

export const partnerRejectSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const meResponseSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    role: z.enum(USER_ROLES),
    emailVerified: z.boolean(),
    twoFactorEnabled: z.boolean(),
  }),
  memberships: z.array(z.unknown()),
  partner: partnerSchema.nullable(),
});
