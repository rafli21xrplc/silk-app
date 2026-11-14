import { z } from 'zod';
import { PRICE_TYPES, SORT_OPTIONS, VERIFICATION_LEVELS, DATA_SOURCE_KINDS } from '../constants';

export const uuidSchema = z.uuid();
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, dan tanda hubung');
export const isoDateSchema = z.iso.date();
/** Rupiah integer; batas atas mencegah angka absurd. */
export const rupiahSchema = z.number().int().nonnegative().max(1_000_000_000_000);

export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
export const cursorSchema = z.string().max(500).optional();
/** Kata kunci pencarian daftar admin (cocok sebagian; kosong = semua). */
export const searchTextSchema = z.string().trim().max(100).optional();

export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['1', '0', 'true', 'false'])])
  .transform((v) => v === true || v === '1' || v === 'true');

export const priceTypeSchema = z.enum(PRICE_TYPES);
export const sortSchema = z.enum(SORT_OPTIONS);
export const verificationSchema = z.enum(VERIFICATION_LEVELS);
export const dataSourceKindSchema = z.enum(DATA_SOURCE_KINDS);

export const priceSchema = z.object({
  type: priceTypeSchema,
  min: z.number().int().nullable(),
  max: z.number().int().nullable(),
  currency: z.literal('IDR'),
});

export const sourceSchema = z.object({
  kind: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
});

/** Konteks kepercayaan yang menyertai setiap angka (M4). */
export const trustSchema = z.object({
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  verifiedAt: z.string().nullable(),
  verification: verificationSchema,
  stale: z.boolean(),
  source: sourceSchema.nullable(),
});

export const metaSchema = z.object({ nextCursor: z.string().nullable() }).catchall(z.unknown());

export function dataResponse<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: metaSchema.optional() });
}

export type Price = z.infer<typeof priceSchema>;
export type Trust = z.infer<typeof trustSchema>;
