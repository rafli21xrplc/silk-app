import { Router } from 'express';
import { z } from 'zod';
import {
  claimCreateSchema,
  csvPresignSchema,
  documentPresignSchema,
  facilityUpdateSchema,
  importRequestSchema,
  tariffCreateSchema,
  tariffUpdateSchema,
  uuidSchema,
} from '@silk/shared';
import { requireFacilityAccess } from '../../middleware/auth';
import { defineRoute } from '../../lib/route';
import * as claims from '../m7-claims/claims.controller';
import * as c from './portal.controller';

const idParams = z.object({ id: uuidSchema });
const base = '/portal';
const tags = ['Portal faskes'];
const security = 'session' as const;

/**
 * Router /v1/portal: sudah melewati loadSession, requireAuth, requireRole('faskes'), dan CSRF.
 * Setiap rute faskes memakai requireFacilityAccess; rute tarif memeriksa kepemilikan di service.
 */
export function portalRoutes(router: Router): void {
  defineRoute(router, base, { method: 'get', path: '/facilities', summary: 'Faskes yang saya kelola', tags, security, handler: c.myFacilities });
  defineRoute(router, base, {
    method: 'get',
    path: '/facilities/:id',
    summary: 'Lihat profil faskes (M6)',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    handler: c.getFacility,
  });
  defineRoute(router, base, {
    method: 'put',
    path: '/facilities/:id',
    summary: 'Ubah profil faskes (M6, filter konten M17)',
    tags,
    security,
    params: idParams,
    body: facilityUpdateSchema,
    middleware: [requireFacilityAccess()],
    handler: c.updateFacility,
  });
  defineRoute(router, base, {
    method: 'get',
    path: '/facilities/:id/tariffs',
    summary: 'Daftar tarif milik faskes (M6)',
    tags,
    security,
    params: idParams,
    middleware: [requireFacilityAccess()],
    handler: c.listTariffs,
  });
  defineRoute(router, base, {
    method: 'post',
    path: '/facilities/:id/tariffs',
    summary: 'Tambah tarif (M6)',
    tags,
    security,
    params: idParams,
    body: tariffCreateSchema,
    middleware: [requireFacilityAccess()],
    handler: c.createTariff,
  });
  defineRoute(router, base, {
    method: 'put',
    path: '/tariffs/:id',
    summary: 'Buat versi baru tarif (M6, append-only)',
    tags,
    security,
    params: idParams,
    body: tariffUpdateSchema,
    handler: c.updateTariff,
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
    summary: 'Impor CSV tarif faskes sendiri; baris faskes lain = seluruh berkas ditolak (M6)',
    tags,
    security,
    params: idParams,
    body: importRequestSchema,
    middleware: [requireFacilityAccess()],
    handler: c.importTariffs,
  });

  defineRoute(router, base, { method: 'get', path: '/claims', summary: 'Klaim saya (M7)', tags, security, handler: claims.mine });
  defineRoute(router, base, {
    method: 'post',
    path: '/claims',
    summary: 'Ajukan klaim profil faskes (M7)',
    tags,
    security,
    body: claimCreateSchema,
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
    handler: claims.confirm,
  });
}
