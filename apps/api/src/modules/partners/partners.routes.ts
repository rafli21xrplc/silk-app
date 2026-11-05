import type { Router } from 'express';
import { z } from 'zod';
import { partnerQueueQuerySchema, partnerRejectSchema, partnerSchema, partnerUpsertSchema, uuidSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import { requirePermission } from '../../middleware/auth';
import * as c from './partners.controller';

const tags = ['Mitra'];

/** Router /v1/partners: sudah melewati loadSession, requirePermission('partner.self'), dan CSRF. */
export function partnerRoutes(router: Router): void {
  defineRoute(router, '/partners', {
    method: 'get',
    path: '/me',
    summary: 'Data usaha dan izin mitra milik sendiri (null bila belum diisi)',
    tags,
    security: 'session',
    response: partnerSchema.nullable(),
    handler: c.mine,
  });
  defineRoute(router, '/partners', {
    method: 'put',
    path: '/me',
    summary: 'Kirim atau perbarui data mitra; status kembali menunggu verifikasi',
    tags,
    security: 'session',
    body: partnerUpsertSchema,
    response: partnerSchema,
    handler: c.upsertMine,
  });
}

/** Dipasang di bawah /v1/admin (sudah melewati requireAdmin + CSRF). */
export function adminPartnerRoutes(router: Router, base: string): void {
  const idParams = z.object({ id: uuidSchema });
  const admin = [requirePermission('admin.partners')];
  defineRoute(router, base, {
    method: 'get',
    path: '/partners',
    summary: 'Antrean verifikasi mitra per status dan jenis',
    tags: ['Admin'],
    security: 'session+mfa',
    query: partnerQueueQuerySchema,
    middleware: admin,
    handler: c.queue,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/partners/:id/approve',
    summary: 'Verifikasi mitra',
    tags: ['Admin'],
    security: 'session+mfa',
    params: idParams,
    successStatus: 200,
    response: partnerSchema,
    middleware: admin,
    handler: c.approve,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/partners/:id/reject',
    summary: 'Tolak pengajuan mitra; alasan dikirim lewat email',
    tags: ['Admin'],
    security: 'session+mfa',
    params: idParams,
    body: partnerRejectSchema,
    successStatus: 200,
    response: partnerSchema,
    middleware: admin,
    handler: c.reject,
  });
}
