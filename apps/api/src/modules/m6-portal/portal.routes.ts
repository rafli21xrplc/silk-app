import { Router } from 'express';
import { z } from 'zod';
import {
  claimCreateSchema,
  csvPresignSchema,
  documentPresignSchema,
  facilityUpdateSchema,
  importRequestSchema,
  mediaOrderSchema,
  mediaPresignSchema,
  profileCreateSchema,
  tariffActiveSchema,
  tariffCreateSchema,
  tariffUpdateSchema,
  uuidSchema,
} from '@silk/shared';
import { requireFacilityAccess, requirePermission } from '../../middleware/auth';
import { defineRoute } from '../../lib/route';
import * as claims from '../m7-claims/claims.controller';
import * as profiles from '../profiles/profiles.controller';
import * as requests from '../tariff-requests/tariff-requests.controller';
import * as c from './portal.controller';

const idParams = z.object({ id: uuidSchema });
const mediaParams = z.object({ id: uuidSchema, mediaId: uuidSchema });
const base = '/portal';
const tags = ['Portal mitra'];
const security = 'session' as const;

/**
 * Router /v1/portal: sudah melewati loadSession, requirePermission('portal.facility') (semua role
 * mitra, Fase 2), dan CSRF. Rute per profil memakai requireFacilityAccess (keanggotaan); rute tarif
 * dan permintaan harga memeriksa kepemilikan di service.
 */
export function portalRoutes(router: Router): void {
  defineRoute(router, base, { method: 'get', path: '/facilities', summary: 'Profil layanan yang saya kelola', tags, security, handler: c.myFacilities });
  defineRoute(router, base, {
    method: 'post',
    path: '/profiles',
    summary: 'Buat profil layanan draft; mitra terverifikasi, non-faskes maks. satu (F-02)',
    tags,
    security,
    body: profileCreateSchema,
    handler: profiles.create,
  });
  defineRoute(router, base, {
    method: 'get',
    path: '/facilities/:id',
    summary: 'Lihat profil lengkap: lokasi, jadwal, media, revisi menunggu (M6, F-02)',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    handler: profiles.get,
  });
  defineRoute(router, base, {
    method: 'put',
    path: '/facilities/:id',
    summary: 'Ubah profil: draft langsung, profil terbit menjadi revisi untuk moderator (F-02, M17)',
    tags,
    security,
    params: idParams,
    body: facilityUpdateSchema,
    middleware: [requireFacilityAccess()],
    handler: profiles.update,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/submit',
    summary: 'Ajukan profil draft untuk diterbitkan moderator',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    successStatus: 200,
    handler: profiles.submit,
  });

  // Media profil (K8)
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/media/presign',
    summary: 'Signed URL unggah foto (≤5 MB, maks. 10) atau video (≤100 MB, ≤120 detik, maks. 1)',
    tags,
    security,
    params: idParams,
    body: mediaPresignSchema,
    middleware: [requireFacilityAccess()],
    handler: profiles.presignMedia,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/media/:mediaId/confirm',
    summary: 'Konfirmasi unggahan media; API memeriksa ukuran, magic bytes, dan durasi MP4',
    tags,
    security,
    params: mediaParams,
    middleware: [requireFacilityAccess()],
    successStatus: 200,
    handler: profiles.confirmMedia,
  });
  defineRoute(router, base, {
    method: 'delete',
    path: '/facilities/:id/media/:mediaId',
    summary: 'Hapus media',
    tags,
    security,
    params: mediaParams,
    middleware: [requireFacilityAccess()],
    handler: profiles.deleteMedia,
  });
  defineRoute(router, base, {
    method: 'put',
    path: '/facilities/:id/media/order',
    summary: 'Ubah urutan media',
    tags,
    security,
    params: idParams,
    body: mediaOrderSchema,
    middleware: [requireFacilityAccess()],
    handler: profiles.reorderMedia,
  });

  // Tarif dan permintaan harga (K4, K5)
  defineRoute(router, base, {
    method: 'get',
    path: '/facilities/:id/tariffs',
    summary: 'Daftar tarif milik profil (M6)',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    handler: c.listTariffs,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/tariffs',
    summary: 'Ajukan harga layanan baru; terbit setelah disetujui moderator (K4)',
    tags,
    security,
    params: idParams,
    body: tariffCreateSchema,
    middleware: [requireFacilityAccess()],
    handler: requests.createForService,
  });
  defineRoute(router, base, {
    method: 'put',
    path: '/tariffs/:id',
    summary: 'Ajukan perubahan harga; harga lama tetap tampil sampai disetujui (K4)',
    tags,
    security,
    params: idParams,
    body: tariffUpdateSchema,
    handler: requests.createForTariff,
  });
  defineRoute(router, base, {
    method: 'patch',
    path: '/tariffs/:id/active',
    summary: 'Aktifkan atau nonaktifkan layanan (K5)',
    tags,
    security,
    params: idParams,
    body: tariffActiveSchema,
    handler: requests.setActive,
  });
  defineRoute(router, base, {
    method: 'get',
    path: '/facilities/:id/tariff-requests',
    summary: 'Permintaan harga profil ini beserta statusnya',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    handler: requests.listForFacility,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/tariff-requests/:id/documents/presign',
    summary: 'Signed URL unggah dokumen bukti harga (PDF/gambar, maks. 5 MB)',
    tags,
    security,
    params: idParams,
    body: documentPresignSchema,
    handler: requests.presignDocument,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/tariff-requests/:id/documents/:documentId/confirm',
    summary: 'Konfirmasi dokumen bukti; API memeriksa ukuran dan magic bytes',
    tags,
    security,
    params: z.object({ id: uuidSchema, documentId: uuidSchema }),
    successStatus: 200,
    handler: requests.confirmDocument,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/tariffs/import/presign',
    summary: 'Minta signed URL unggah CSV tarif (M6)',
    tags,
    security,
    params: idParams,
    body: csvPresignSchema,
    middleware: [requireFacilityAccess()],
    handler: c.presignImport,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/tariffs/import',
    summary: 'Impor CSV tarif sendiri menjadi satu permintaan harga; baris profil lain = seluruh berkas ditolak',
    tags,
    security,
    params: idParams,
    body: importRequestSchema,
    middleware: [requireFacilityAccess()],
    handler: requests.importCsv,
  });

  // Klaim M7: khusus faskes
  const claimsOnly = [requirePermission('portal.claims')];
  defineRoute(router, base, { method: 'get', path: '/claims', summary: 'Klaim saya (M7)', tags, security, middleware: claimsOnly, handler: claims.mine });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims',
    summary: 'Ajukan klaim profil faskes (M7)',
    tags,
    security,
    body: claimCreateSchema,
    middleware: claimsOnly,
    handler: claims.create,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims/:id/documents/presign',
    summary: 'Minta signed URL unggah dokumen izin (PDF/gambar, maks. 5 MB) (M7)',
    tags,
    security,
    params: idParams,
    body: documentPresignSchema,
    middleware: claimsOnly,
    handler: claims.presign,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims/:id/documents/:documentId/confirm',
    summary: 'Konfirmasi unggahan; API memeriksa ukuran dan magic bytes (M7)',
    tags,
    security,
    params: z.object({ id: uuidSchema, documentId: uuidSchema }),
    successStatus: 200,
    middleware: claimsOnly,
    handler: claims.confirm,
  });
}
