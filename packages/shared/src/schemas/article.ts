import { z } from 'zod';
import {
  ARTICLE_BODY_MAX,
  ARTICLE_BODY_MIN,
  ARTICLE_STATUSES,
  ARTICLE_SUMMARY_MAX,
  ARTICLE_SUMMARY_MIN,
  ARTICLE_TITLE_MAX,
  ARTICLE_TITLE_MIN,
  PARTNER_TYPES,
} from '../constants';
import { cursorSchema, limitSchema, searchTextSchema, uuidSchema } from './common';

/* ---------- Fase 4 (F-05): artikel mitra ---------- */

export const articleStatusSchema = z.enum(ARTICLE_STATUSES);

/** Draf boleh belum lengkap (isi minimal baru dicek saat diajukan); batas atas tetap berlaku. */
export const articleDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(ARTICLE_TITLE_MAX),
  summary: z.string().trim().max(ARTICLE_SUMMARY_MAX).default(''),
  body: z.string().max(ARTICLE_BODY_MAX).default(''),
  /** Wajib `true` saat mengubah artikel terbit (perubahan langsung diajukan ulang). */
  declaration: z.boolean().optional(),
});
export type ArticleDraftInput = z.infer<typeof articleDraftInputSchema>;

/** Syarat isi saat diajukan (dipakai service pada salinan kerja, dan web untuk pesan awal). */
export const articleSubmitContentSchema = z.object({
  title: z.string().trim().min(ARTICLE_TITLE_MIN).max(ARTICLE_TITLE_MAX),
  summary: z.string().trim().min(ARTICLE_SUMMARY_MIN).max(ARTICLE_SUMMARY_MAX),
  body: z.string().trim().min(ARTICLE_BODY_MIN).max(ARTICLE_BODY_MAX),
});

/** Pernyataan wajib saat mengajukan: tidak berbayar, tanpa promosi harga, tanpa janji hasil pengobatan. */
export const articleSubmitSchema = z.object({ declaration: z.literal(true) });

export const articleWithdrawSchema = z.object({ reason: z.string().trim().max(1000).optional() });
/** Penarikan oleh moderator wajib beralasan. */
export const articleStaffWithdrawSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const articleQueueQuerySchema = z.object({
  status: articleStatusSchema.default('pending'),
  q: searchTextSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

export const articleBlockSchema = z.object({
  _type: z.literal('block'),
  _key: z.string(),
  style: z.enum(['normal', 'h2', 'h3', 'blockquote']),
  listItem: z.enum(['bullet', 'number']).optional(),
  children: z.array(z.object({ _key: z.string(), text: z.string(), marks: z.array(z.enum(['strong', 'em'])) })),
});

export const articleAuthorSchema = z.object({
  name: z.string(),
  partnerType: z.enum(PARTNER_TYPES),
  /** Profil publik mitra (`/faskes/...` atau `/tenaga-medis/...`) bila ada. */
  profilePath: z.string().nullable(),
});

export const publicArticleSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  updatedAt: z.string(),
  readingMinutes: z.number().int(),
  author: articleAuthorSchema,
});
export type PublicArticleSummary = z.infer<typeof publicArticleSummarySchema>;

export const publicArticleSchema = publicArticleSummarySchema.extend({ body: z.array(articleBlockSchema) });
export type PublicArticle = z.infer<typeof publicArticleSchema>;

const articleContentSchema = z.object({ title: z.string(), summary: z.string(), body: z.string() });

export const portalArticleSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  status: articleStatusSchema,
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  /** Versi yang sedang tampil publik (null bila belum pernah terbit). */
  published: articleContentSchema.nullable(),
  firstPublishedAt: z.string().nullable(),
  publishedUpdatedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  withdrawnReason: z.string().nullable(),
  needsReview: z.boolean(),
  /** Tampil di situs sekarang (versi terbit, tidak ditarik, mitra terverifikasi). */
  live: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PortalArticle = z.infer<typeof portalArticleSchema>;

export const adminArticleListItemSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  status: articleStatusSchema,
  title: z.string(),
  needsReview: z.boolean(),
  revision: z.boolean(),
  submittedAt: z.string().nullable(),
  updatedAt: z.string(),
  author: articleAuthorSchema,
});
export type AdminArticleListItem = z.infer<typeof adminArticleListItemSchema>;

export const adminArticleDetailSchema = portalArticleSchema.extend({
  author: articleAuthorSchema,
  violations: z.array(z.object({ field: z.string(), match: z.string(), level: z.string() })),
});
export type AdminArticleDetail = z.infer<typeof adminArticleDetailSchema>;
