import type { Router } from 'express';
import { z } from 'zod';
import {
  adminReviewSchema,
  facilityReviewsSchema,
  myReviewSchema,
  rejectReasonSchema,
  reviewInputSchema,
  reviewListQuerySchema,
  reviewQueueQuerySchema,
  slugSchema,
  uuidSchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import { defineRoute } from '../../lib/route';
import { requireFlag } from '../../middleware/auth';
import { pgRateLimit } from '../../middleware/rate-limit';
import * as service from './reviews.service';

/** Fase 6 ramping (evaluasi USP R8): semua rute ulasan 404 saat flag `reviews_enabled` OFF. */
const flag = requireFlag('reviews_enabled');
const slugParams = z.object({ slug: slugSchema });
const idParams = z.object({ id: uuidSchema });

/** Publik: ringkasan dan ulasan disetujui satu profil. */
export function publicReviewRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/facilities/:slug/reviews',
    summary: 'Ringkasan dan ulasan pengalaman yang disetujui, terbaru dulu (flag reviews_enabled)',
    tags: ['Publik'],
    params: slugParams,
    query: reviewListQuerySchema,
    response: facilityReviewsSchema,
    middleware: [flag],
    handler: async (i) => {
      const r = await service.publicReviews(i.params.slug, i.query);
      return { data: { summary: r.summary, items: r.items }, meta: { nextCursor: r.nextCursor }, cache: 'public' };
    },
  });
}

/** Pasien (`/v1/reviews`): router sudah memasang sesi, flag, izin `review.write`, dan CSRF. */
export function reviewWriteRoutes(router: Router): void {
  const common = { tags: ['Ulasan'], security: 'session' as const };
  defineRoute(router, '', {
    ...common,
    method: 'get',
    path: '/:slug/mine',
    summary: 'Ulasan saya untuk profil ini, atau null',
    params: slugParams,
    response: myReviewSchema.nullable(),
    handler: async (i, req) => ({ data: await service.mine(actorFrom(req), i.params.slug) }),
  });
  defineRoute(router, '', {
    ...common,
    method: 'put',
    path: '/:slug',
    summary: 'Tulis atau ubah ulasan sendiri; masuk antrean moderasi lagi (M17 untuk komentar)',
    params: slugParams,
    body: reviewInputSchema,
    response: myReviewSchema,
    middleware: [pgRateLimit({ name: 'review', limit: 10, windowSec: 3600, key: (req) => req.auth?.user.id ?? null })],
    handler: async (i, req) => ({ data: await service.upsertMine(actorFrom(req), i.params.slug, i.body) }),
  });
  defineRoute(router, '', {
    ...common,
    method: 'delete',
    path: '/:slug',
    summary: 'Hapus ulasan sendiri',
    params: slugParams,
    response: z.object({ id: z.string(), deleted: z.literal(true) }),
    handler: async (i, req) => ({ data: await service.deleteMine(actorFrom(req), i.params.slug) }),
  });
}

/** Admin (`/v1/admin/reviews`): router admin sudah menegakkan moderator/admin + TOTP + CSRF. */
export function adminReviewRoutes(router: Router): void {
  const base = '/admin';
  const common = { tags: ['Admin'], security: 'session+mfa' as const, middleware: [flag] };
  defineRoute(router, base, {
    ...common,
    method: 'get',
    path: '/reviews',
    summary: 'Antrean ulasan pengalaman per status, terlama dulu',
    query: reviewQueueQuerySchema,
    response: z.array(adminReviewSchema),
    handler: async (i) => {
      const page = await service.queue(i.query);
      return { data: page.items, meta: { nextCursor: page.nextCursor } };
    },
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/reviews/:id/approve',
    summary: 'Setujui ulasan; ringkasan rating profil dihitung ulang',
    params: idParams,
    successStatus: 200,
    response: myReviewSchema,
    handler: async (i, req) => ({ data: await service.approve(actorFrom(req), i.params.id) }),
  });
  defineRoute(router, base, {
    ...common,
    method: 'post',
    path: '/reviews/:id/reject',
    summary: 'Tolak ulasan (alasan wajib)',
    params: idParams,
    body: rejectReasonSchema,
    successStatus: 200,
    response: myReviewSchema,
    handler: async (i, req) => ({ data: await service.reject(actorFrom(req), i.params.id, i.body.reason) }),
  });
}
