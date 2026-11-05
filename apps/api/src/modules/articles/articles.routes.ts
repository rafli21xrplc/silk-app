import { Router } from 'express';
import { z } from 'zod';
import {
  adminArticleDetailSchema,
  adminArticleListItemSchema,
  articleDraftInputSchema,
  articleQueueQuerySchema,
  articleStaffWithdrawSchema,
  articleSubmitSchema,
  articleWithdrawSchema,
  cursorSchema,
  limitSchema,
  portalArticleSchema,
  publicArticleSchema,
  publicArticleSummarySchema,
  rejectReasonSchema,
  slugSchema,
  uuidSchema,
} from '@silk/shared';
import { requirePermission } from '../../middleware/auth';
import { defineRoute } from '../../lib/route';
import * as c from './articles.controller';

const idParams = z.object({ id: uuidSchema });

/**
 * Portal (`/v1/portal/articles`): router portal sudah memeriksa sesi dan CSRF; di sini ditambah izin
 * `portal.articles` (faskes, tenaga medis, gaya hidup). Status mitra terverifikasi dan kepemilikan dicek
 * di service; artikel mitra lain dibalas 404.
 */
export function portalArticleRoutes(router: Router): void {
  const base = '/portal';
  const common = { tags: ['Portal mitra'], security: 'session' as const, middleware: [requirePermission('portal.articles')] };
  defineRoute(router, base, { ...common, method: 'get', path: '/articles', summary: 'Artikel saya, semua status (F-05)', response: z.array(portalArticleSchema), handler: c.listMine });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles',
    summary: 'Buat draf artikel edukasi (F-05)',
    body: articleDraftInputSchema,
    response: portalArticleSchema,
    handler: c.create,
  });
  defineRoute(router, base, { ...common, method: 'get', path: '/articles/:id', summary: 'Salinan kerja dan versi terbit artikel saya', params: idParams, response: portalArticleSchema, handler: c.getMine });
  defineRoute(router, base, {
    ...common,
    method: 'put',
    path: '/articles/:id',
    summary: 'Ubah artikel: draf tetap draf; artikel terbit menjadi menunggu, versi terbit tetap tampil sampai disetujui (M17)',
    params: idParams,
    body: articleDraftInputSchema,
    response: portalArticleSchema,
    handler: c.update,
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles/:id/submit',
    summary: 'Ajukan artikel untuk ditinjau moderator; pernyataan bebas promosi wajib (M17)',
    params: idParams,
    body: articleSubmitSchema,
    successStatus: 200,
    response: portalArticleSchema,
    handler: c.submit,
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles/:id/withdraw',
    summary: 'Tarik artikel dari situs atau dari antrean',
    params: idParams,
    body: articleWithdrawSchema,
    successStatus: 200,
    response: portalArticleSchema,
    handler: c.withdrawMine,
  });
  defineRoute(router, base, { ...common, method: 'delete', path: '/articles/:id', summary: 'Hapus artikel yang belum pernah terbit', params: idParams, handler: c.deleteMine });
}

/** Admin (`/v1/admin/articles`): router admin sudah menegakkan moderator/admin + TOTP + CSRF. */
export function adminArticleRoutes(router: Router): void {
  const base = '/admin';
  const common = { tags: ['Admin'], security: 'session+mfa' as const };
  defineRoute(router, base, { ...common, method: 'get', path: '/articles', summary: 'Antrean artikel mitra per status (F-05)', query: articleQueueQuerySchema, response: z.array(adminArticleListItemSchema), handler: c.queue });
  defineRoute(router, base, { ...common, method: 'get', path: '/articles/:id', summary: 'Usulan, versi terbit, dan temuan M17', params: idParams, response: adminArticleDetailSchema, handler: c.detail });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles/:id/approve',
    summary: 'Setujui dan terbitkan artikel; revalidate halaman artikel',
    params: idParams,
    successStatus: 200,
    response: adminArticleDetailSchema,
    handler: c.approve,
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles/:id/reject',
    summary: 'Tolak artikel (alasan wajib); versi terbit sebelumnya tetap tampil',
    params: idParams,
    body: rejectReasonSchema,
    successStatus: 200,
    response: adminArticleDetailSchema,
    handler: c.reject,
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/articles/:id/withdraw',
    summary: 'Turunkan artikel dari situs (alasan wajib)',
    params: idParams,
    body: articleStaffWithdrawSchema,
    successStatus: 200,
    response: adminArticleDetailSchema,
    handler: c.staffWithdraw,
  });
}

/** Publik: hanya salinan terbit artikel mitra. Artikel editorial tetap dari Sanity di web. */
export function publicArticleRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/articles',
    summary: 'Artikel mitra yang terbit, terbaru dulu (F-05)',
    tags: ['Publik'],
    query: z.object({ limit: limitSchema, cursor: cursorSchema }),
    response: z.array(publicArticleSummarySchema),
    handler: c.publicList,
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/articles/:slug',
    summary: 'Satu artikel mitra yang terbit, beserta penulis dan isi dalam bentuk blok',
    tags: ['Publik'],
    params: z.object({ slug: slugSchema }),
    response: publicArticleSchema,
    handler: c.publicGet,
  });
}
