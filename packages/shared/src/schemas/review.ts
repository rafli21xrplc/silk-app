import { z } from 'zod';
import { REVIEW_ASPECTS, REVIEW_ASPECT_VALUES, REVIEW_COMMENT_MAX, REVIEW_STATUSES } from '../constants';
import { cursorSchema, limitSchema } from './common';

/* ---------- Fase 6 ramping (evaluasi USP R8): ulasan pengalaman ---------- */

export const reviewAspectsSchema = z.partialRecord(z.enum(REVIEW_ASPECTS), z.enum(REVIEW_ASPECT_VALUES));
export type ReviewAspects = z.infer<typeof reviewAspectsSchema>;

/** Tulis atau ubah ulasan sendiri; perubahan selalu masuk antrean moderasi lagi. */
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1, 'Pilih 1 sampai 5 bintang').max(5, 'Pilih 1 sampai 5 bintang'),
  aspects: reviewAspectsSchema.default({}),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Komentar maksimal ${REVIEW_COMMENT_MAX} karakter`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  /** Pengalaman sendiri, bukan iklan, tanpa data kesehatan orang lain. */
  declaration: z.literal(true, { message: 'Centang pernyataan bahwa ini pengalaman Anda sendiri' }),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewListQuerySchema = z.object({ limit: limitSchema.pipe(z.number().max(20)), cursor: cursorSchema });

export const publicReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  aspects: reviewAspectsSchema,
  comment: z.string().nullable(),
  /** Data contoh untuk demo (seed), bukan dari pengguna; selalu diberi label di UI. */
  sample: z.boolean(),
  /** Nama tampilan disingkat ("Rina S."); null untuk data contoh. */
  authorName: z.string().nullable(),
  createdAt: z.string(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export const reviewAspectSummarySchema = z.object({ aspect: z.enum(REVIEW_ASPECTS), good: z.number().int(), answered: z.number().int() });
export const reviewSummarySchema = z.object({
  count: z.number().int(),
  /** Rata-rata satu desimal; null bila belum ada ulasan disetujui. */
  average: z.number().nullable(),
  /** Jumlah per bintang, indeks 0 = 1 bintang. */
  distribution: z.array(z.number().int()).length(5),
  aspects: z.array(reviewAspectSummarySchema),
  sampleCount: z.number().int(),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

export const facilityReviewsSchema = z.object({ summary: reviewSummarySchema, items: z.array(publicReviewSchema) });

export const myReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  aspects: reviewAspectsSchema,
  comment: z.string().nullable(),
  status: z.enum(REVIEW_STATUSES),
  rejectionReason: z.string().nullable(),
  updatedAt: z.string(),
});
export type MyReview = z.infer<typeof myReviewSchema>;

export const adminReviewSchema = myReviewSchema.extend({
  facilityName: z.string(),
  facilitySlug: z.string(),
  authorName: z.string().nullable(),
  sample: z.boolean(),
  createdAt: z.string(),
});
export type AdminReview = z.infer<typeof adminReviewSchema>;
