import { Router } from 'express';
import { z } from 'zod';
import {
  adminFacilityQuerySchema,
  adminFacilityUpdateSchema,
  adminImportCreateSchema,
  auditQuerySchema,
  claimApproveSchema,
  claimRejectSchema,
  csvPresignSchema,
  cursorSchema,
  queueQuerySchema,
  rejectReasonSchema,
  reportUpdateSchema,
  reviewQueueQuerySchema,
  uuidSchema,
} from '@silk/shared';
import { defineRoute } from '../../lib/route';
import { contentRulesRoutes } from '../m17-content-rules/content-rules.routes';
import * as claims from '../m7-claims/claims.controller';
import * as profiles from '../profiles/profiles.controller';
import * as requests from '../tariff-requests/tariff-requests.controller';
import { adminPartnerRoutes } from '../partners/partners.routes';
import * as c from './admin.controller';

const idParams = z.object({ id: uuidSchema });
const base = '/admin';
const tags = ['Admin'];
const security = 'session+mfa' as const;

/** Router /v1/admin: sudah melewati loadSession, requireAdmin (peran + MFA + 8 jam), dan CSRF. */
export function adminRoutes(router: Router): void {
  // M7: antrean klaim
  defineRoute(router, base, { method: 'get', path: '/claims', summary: 'Antrean klaim (M7, M15)', tags, security, query: queueQuerySchema, handler: claims.queue });
  defineRoute(router, base, { method: 'get', path: '/claims/:id', summary: 'Detail klaim dan dokumen (signed URL singkat)', tags, security, params: idParams, handler: claims.detail });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims/:id/approve',
    summary: 'Setujui klaim (M7)',
    tags,
    security,
    params: idParams,
    body: claimApproveSchema,
    successStatus: 200,
    handler: claims.approve,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims/:id/reject',
    summary: 'Tolak klaim; alasan dikirim lewat email (M7)',
    tags,
    security,
    params: idParams,
    body: claimRejectSchema,
    successStatus: 200,
    handler: claims.reject,
  });

  // Fase 1: verifikasi mitra
  adminPartnerRoutes(router, base);

  // Fase 2: moderasi revisi profil, media, dan permintaan harga
  defineRoute(router, base, { method: 'get', path: '/profile-revisions', summary: 'Antrean revisi profil terbit (F-02)', tags, security, query: reviewQueueQuerySchema, handler: profiles.revisionQueue });
  defineRoute(router, base, { method: 'get', path: '/profile-revisions/:id', summary: 'Data publik saat ini dan usulan revisi', tags, security, params: idParams, handler: profiles.revisionDetail });
  defineRoute(router, base, { method: 'post', path: '/profile-revisions/:id/approve', summary: 'Setujui revisi profil; diterapkan dan halaman publik diperbarui', tags, security, params: idParams, successStatus: 200, handler: profiles.approveRevision });
  defineRoute(router, base, {
    method: 'post',
    path: '/profile-revisions/:id/reject',
    summary: 'Tolak revisi profil (alasan wajib)',
    tags,
    security,
    params: idParams,
    body: rejectReasonSchema,
    successStatus: 200,
    handler: profiles.rejectRevision,
  });
  defineRoute(router, base, { method: 'get', path: '/media', summary: 'Antrean foto dan video profil (pratinjau lewat signed URL singkat)', tags, security, query: reviewQueueQuerySchema, handler: profiles.mediaQueue });
  defineRoute(router, base, { method: 'post', path: '/media/:id/approve', summary: 'Setujui media; disalin ke penyimpanan media publik', tags, security, params: idParams, successStatus: 200, handler: profiles.approveMedia });
  defineRoute(router, base, {
    method: 'post',
    path: '/media/:id/reject',
    summary: 'Tolak media (alasan wajib); berkas dihapus',
    tags,
    security,
    params: idParams,
    body: rejectReasonSchema,
    successStatus: 200,
    handler: profiles.rejectMedia,
  });
  defineRoute(router, base, { method: 'get', path: '/tariff-requests', summary: 'Antrean permintaan harga mitra (K4)', tags, security, query: reviewQueueQuerySchema, handler: requests.queue });
  defineRoute(router, base, { method: 'get', path: '/tariff-requests/:id', summary: 'Harga lama vs usulan dan dokumen bukti (signed URL singkat)', tags, security, params: idParams, handler: requests.detail });
  defineRoute(router, base, {
    method: 'post',
    path: '/tariff-requests/:id/approve',
    summary: 'Setujui permintaan harga: versi baru diverifikasi_admin, tarif terbit (dokumen bukti wajib)',
    tags,
    security,
    params: idParams,
    successStatus: 200,
    handler: requests.approve,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/tariff-requests/:id/reject',
    summary: 'Tolak permintaan harga (alasan wajib); tarif tidak berubah',
    tags,
    security,
    params: idParams,
    body: rejectReasonSchema,
    successStatus: 200,
    handler: requests.reject,
  });

  // M14: laporan data
  defineRoute(router, base, { method: 'get', path: '/reports', summary: 'Antrean laporan data (M14)', tags, security, query: queueQuerySchema, handler: c.reportQueue });
  defineRoute(router, base, {
    method: 'patch',
    path: '/reports/:id',
    summary: 'Tangani laporan (M14)',
    tags,
    security,
    params: idParams,
    body: reportUpdateSchema,
    handler: c.updateReport,
  });

  // M5: impor data publik
  defineRoute(router, base, { method: 'post', path: '/imports/presign', summary: 'Signed URL unggah CSV (M5)', tags, security, body: csvPresignSchema, handler: c.presignImport });
  defineRoute(router, base, { method: 'post', path: '/imports', summary: 'Buat batch impor dari CSV yang sudah diunggah (M5)', tags, security, body: adminImportCreateSchema, handler: c.createImport });
  defineRoute(router, base, { method: 'get', path: '/imports', summary: 'Daftar batch impor', tags, security, query: queueQuerySchema, handler: c.listImports });
  defineRoute(router, base, {
    method: 'get',
    path: '/imports/:id',
    summary: 'Status batch dan baris galat (M5)',
    tags,
    security,
    params: idParams,
    query: z.object({ cursor: cursorSchema }),
    handler: c.getImport,
  });
  defineRoute(router, base, {
    method: 'patch',
    path: '/imports/:id/rows/:rowId',
    summary: 'Pilih faskes untuk baris ambigu (M5)',
    tags,
    security,
    params: z.object({ id: uuidSchema, rowId: z.coerce.number().int().positive() }),
    body: z.object({ facilityId: uuidSchema }),
    handler: c.resolveImportRow,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/imports/:id/publish',
    summary: 'Terbitkan batch secara transaksional (M5)',
    tags,
    security,
    params: idParams,
    successStatus: 200,
    handler: c.publishImport,
  });

  // M15: faskes, tarif, audit, job
  defineRoute(router, base, { method: 'get', path: '/overview', summary: 'Jumlah item menunggu per antrean', tags, security, handler: c.overview });
  defineRoute(router, base, { method: 'get', path: '/facilities', summary: 'Daftar faskes dengan filter status', tags, security, query: adminFacilityQuerySchema, handler: c.facilities });
  defineRoute(router, base, {
    method: 'patch',
    path: '/facilities/:id',
    summary: 'Ubah status, verifikasi, atau koordinat faskes (M1, M15)',
    tags,
    security,
    params: idParams,
    body: adminFacilityUpdateSchema,
    handler: c.updateFacility,
  });
  defineRoute(router, base, { method: 'get', path: '/tariffs', summary: 'Antrean tarif menunggu tinjauan', tags, security, query: queueQuerySchema, handler: c.tariffQueue });
  defineRoute(router, base, { method: 'post', path: '/tariffs/:id/publish', summary: 'Terbitkan tarif', tags, security, params: idParams, successStatus: 200, handler: c.publishTariff });
  defineRoute(router, base, { method: 'post', path: '/tariffs/:id/withdraw', summary: 'Tarik tarif', tags, security, params: idParams, successStatus: 200, handler: c.withdrawTariff });
  defineRoute(router, base, { method: 'get', path: '/audit-logs', summary: 'Cari log audit (M15)', tags, security, query: auditQuerySchema, handler: c.auditLogs });
  defineRoute(router, base, { method: 'get', path: '/jobs', summary: 'Ringkasan antrean job', tags, security, handler: c.jobs });
  defineRoute(router, base, {
    method: 'post',
    path: '/jobs/:type/run',
    summary: 'Jalankan job manual (untuk staging tanpa Cron)',
    tags,
    security,
    params: z.object({ type: z.enum(['process-queue', 'stale-reminders', 'retention']) }),
    successStatus: 200,
    handler: c.runJob,
  });

  // M17
  contentRulesRoutes(router);
}
