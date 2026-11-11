import { z } from 'zod';
import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES, CSV_MAX_BYTES } from '../constants';
import { READINESS_ITEMS, READINESS_PILLARS } from '../readiness';
import { checkPriceFields } from '../price';
import { isoDateSchema, priceTypeSchema, rupiahSchema, uuidSchema } from './common';
import { locationsSchema, profileFieldsSchema, schedulesSchema, tariffSourceFields } from './profile';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const hoursSchema = z
  .record(z.enum(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']), z.string().max(60))
  .nullable()
  .optional();

export const facilityUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(200).optional(),
    description: optionalText(2000),
    address: z.string().trim().min(5).max(500).optional(),
    phone: optionalText(40),
    website: z.url().max(300).nullable().optional(),
    hours: hoursSchema,
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    /** Fase 2: daftar lokasi lengkap (menggantikan semua) dan jadwal per hari. */
    locations: locationsSchema.optional(),
    schedules: schedulesSchema.optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat dan lng harus diisi bersama',
    path: ['lat'],
  })
  .refine((v) => !(v.locations && (v.address !== undefined || v.lat !== undefined)), {
    message: 'Pakai locations atau address/lat/lng, tidak keduanya',
    path: ['locations'],
  });
export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;

/**
 * Isi revisi profil terbit (K3) setelah dinormalkan: address/lat/lng lama sudah dilebur ke
 * `locations`. Divalidasi ulang saat moderator menyetujui.
 */
export const revisionPayloadSchema = profileFieldsSchema.extend({ hours: hoursSchema });
export type RevisionPayload = z.infer<typeof revisionPayloadSchema>;

export const packageInputSchema = z.object({
  name: z.string().trim().min(3).max(200),
  notes: optionalText(1000),
  components: z
    .array(z.object({ label: z.string().trim().min(1).max(120), included: z.boolean() }))
    .min(1)
    .max(100),
});

const tariffFields = {
  priceType: priceTypeSchema,
  priceMin: rupiahSchema.nullable().optional(),
  priceMax: rupiahSchema.nullable().optional(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
  inclusions: optionalText(1000),
  exclusions: optionalText(1000),
  // Fase 2 (K4): setiap usulan harga wajib menyebut sumbernya; dokumen bukti diunggah terpisah.
  ...tariffSourceFields,
};

function refineTariff(
  v: { priceType: z.infer<typeof priceTypeSchema>; priceMin?: number | null; priceMax?: number | null; effectiveFrom: string; effectiveTo?: string | null },
  ctx: z.RefinementCtx,
  hasPackage: boolean,
) {
  for (const issue of checkPriceFields({ ...v, hasPackage })) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
  if (v.effectiveTo && v.effectiveTo < v.effectiveFrom) {
    ctx.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Tanggal akhir sebelum tanggal berlaku' });
  }
}

export const tariffCreateSchema = z
  .object({ serviceId: uuidSchema, package: packageInputSchema.optional(), ...tariffFields })
  .superRefine((v, ctx) => refineTariff(v, ctx, v.package !== undefined));
export type TariffCreateInput = z.infer<typeof tariffCreateSchema>;

/** Perubahan tarif = versi baru. `expectedVersionNo` mencegah dua orang menimpa satu sama lain. */
export const tariffUpdateSchema = z
  .object({ ...tariffFields, expectedVersionNo: z.number().int().min(1) })
  // Keberadaan paket dicek service (paket melekat pada tarif yang sudah ada).
  .superRefine((v, ctx) => refineTariff(v, ctx, true));
export type TariffUpdateInput = z.infer<typeof tariffUpdateSchema>;

export const claimCreateSchema = z.object({
  facilityId: uuidSchema,
  note: optionalText(1000),
});
export type ClaimCreateInput = z.infer<typeof claimCreateSchema>;

export const documentPresignSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mime: z.enum(DOCUMENT_ALLOWED_MIME, { message: 'Hanya PDF atau gambar (JPEG, PNG, WebP)' }),
  sizeBytes: z.number().int().positive().max(DOCUMENT_MAX_BYTES, 'Ukuran maksimal 5 MB'),
});
export type DocumentPresignInput = z.infer<typeof documentPresignSchema>;

export const documentConfirmSchema = z.object({ objectKey: z.string().min(1).max(300) });

export const csvPresignSchema = z.object({
  fileName: z.string().trim().min(1).max(200).regex(/\.csv$/i, 'Berkas harus .csv'),
  sizeBytes: z.number().int().positive().max(CSV_MAX_BYTES),
});
export type CsvPresignInput = z.infer<typeof csvPresignSchema>;

export const importRequestSchema = z.object({
  objectKey: z.string().min(1).max(300),
  /** Fase 2 (K4): impor portal menjadi satu permintaan harga; sumber ringkas untuk moderator. */
  sourceTitle: tariffSourceFields.sourceTitle.optional(),
  sourceUrl: tariffSourceFields.sourceUrl,
});

/** Kesiapan profil terhadap USP (GET /portal/facilities/:id/readiness). Lihat `profileReadiness`. */
export const profileReadinessSchema = z.object({
  published: z.boolean(),
  checks: z.array(
    z.object({ item: z.enum(READINESS_ITEMS), pillar: z.enum(READINESS_PILLARS), done: z.boolean(), state: z.string(), optional: z.boolean() }),
  ),
  done: z.number().int(),
  total: z.number().int(),
  pillars: z.object({ biaya: z.boolean(), kenal: z.boolean(), kunjungan: z.boolean() }),
});
