import { randomUUID } from 'node:crypto';
import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES, type ClaimCreateInput, type DocumentPresignInput } from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { sendEmail } from '../../lib/email';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { sniffMime, storage } from '../../lib/storage';
import { recordAudit } from '../m15-admin/audit.repo';
import { addMembership, isMember } from '../m6-portal/portal.repo';
import * as repo from './claims.repo';

/** Masa berlaku signed URL untuk admin melihat dokumen (pendek, M7). */
const VIEW_URL_TTL_SEC = 300;

export function myClaims(ctx: ActorContext) {
  return repo.claimsOfUser(db(), ctx.actorId!);
}

export async function createClaim(ctx: ActorContext, input: ClaimCreateInput) {
  const userId = ctx.actorId!;
  const facility = await repo.findFacilityForClaim(db(), input.facilityId);
  if (!facility || facility.status === 'ditarik') throw notFound('FACILITY_NOT_FOUND', 'Faskes');
  if (await isMember(db(), userId, input.facilityId)) {
    throw new AppError('CLAIM_ALREADY_EXISTS', 'Anda sudah menjadi pengelola faskes ini');
  }
  return db().transaction(async (tx) => {
    const claim = await repo.insertClaim(tx, { facilityId: input.facilityId, userId, note: input.note ?? null });
    if (!claim) throw new AppError('CLAIM_ALREADY_EXISTS', 'Anda sudah punya klaim yang menunggu untuk faskes ini');
    await recordAudit(tx, {
      actorId: userId,
      action: 'claim.create',
      entity: 'facility_claim',
      entityId: claim.id,
      before: null,
      after: claim,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return claim;
  });
}

async function ownPendingClaim(ctx: ActorContext, claimId: string) {
  const claim = await repo.findClaim(db(), claimId);
  // Klaim orang lain diperlakukan seperti tidak ada (tidak membocorkan keberadaannya).
  if (!claim || claim.userId !== ctx.actorId) throw notFound('CLAIM_NOT_FOUND', 'Klaim');
  if (claim.status !== 'menunggu') throw new AppError('CONFLICT', 'Klaim sudah diputuskan');
  return claim;
}

/**
 * Signed URL unggah dokumen izin (M7). MIME dan ukuran sudah dibatasi skema Zod; nama objek acak;
 * bucket privat. Tipe dan ukuran ikut ditandatangani.
 */
export async function presignDocument(ctx: ActorContext, claimId: string, input: DocumentPresignInput) {
  await ownPendingClaim(ctx, claimId);
  const objectKey = `claims/${claimId}/${randomUUID()}`;
  const upload = await storage().presignPut(objectKey, input.mime, input.sizeBytes);
  const doc = await repo.insertDocument(db(), {
    claimId,
    objectKey,
    fileName: input.fileName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
  });
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'claim.document.presign',
    entity: 'document',
    entityId: doc.id,
    before: null,
    after: { claimId, fileName: input.fileName, mime: input.mime, sizeBytes: input.sizeBytes },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { documentId: doc.id, ...upload };
}

/** Setelah unggah: periksa ukuran nyata dan magic bytes. Berkas tidak sah dihapus. */
export async function confirmDocument(ctx: ActorContext, claimId: string, documentId: string) {
  await ownPendingClaim(ctx, claimId);
  const doc = await repo.findDocument(db(), claimId, documentId);
  if (!doc) throw notFound('NOT_FOUND', 'Dokumen');
  const info = await storage().head(doc.objectKey);
  if (!info) throw new AppError('DOCUMENT_INVALID', 'Berkas belum diunggah');

  const reject = async (reason: string): Promise<never> => {
    await storage().delete(doc.objectKey);
    await repo.deleteDocumentRow(db(), doc.id);
    throw new AppError('DOCUMENT_INVALID', reason);
  };
  if (info.sizeBytes > DOCUMENT_MAX_BYTES) await reject('Ukuran berkas melebihi 5 MB');
  const sniffed = sniffMime(await storage().readStart(doc.objectKey, 16));
  if (!sniffed || !(DOCUMENT_ALLOWED_MIME as readonly string[]).includes(sniffed) || sniffed !== doc.mime) {
    await reject('Isi berkas bukan PDF atau gambar yang diizinkan');
  }
  await repo.confirmDocument(db(), doc.id, info.sizeBytes);
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'claim.document.confirm',
    entity: 'document',
    entityId: doc.id,
    before: null,
    after: { sizeBytes: info.sizeBytes, mime: sniffed },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { id: doc.id, fileName: doc.fileName, mime: doc.mime, sizeBytes: info.sizeBytes, confirmed: true };
}

/* ---------- Admin ---------- */

export async function claimQueue(q: { status?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.claimQueue(db(), { status: q.status ?? 'menunggu', limit: q.limit, offset });
  return pageOf(rows, q.limit, offset);
}

/** Detail klaim untuk admin; dokumen hanya bisa dilihat lewat signed URL berumur pendek. */
export async function claimDetail(claimId: string) {
  const claim = await repo.findClaim(db(), claimId);
  if (!claim) throw notFound('CLAIM_NOT_FOUND', 'Klaim');
  const docs = await repo.confirmedDocuments(db(), claimId);
  const facility = await repo.findFacilityForClaim(db(), claim.facilityId);
  const applicant = await repo.userEmail(db(), claim.userId);
  return {
    ...claim,
    facility,
    applicant,
    documents: await Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fileName: d.fileName,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt,
        viewUrl: await storage().presignGet(d.objectKey, VIEW_URL_TTL_SEC),
        viewUrlExpiresInSec: VIEW_URL_TTL_SEC,
      })),
    ),
  };
}

export async function approveClaim(ctx: ActorContext, claimId: string, note?: string) {
  const result = await db().transaction(async (tx) => {
    const locked = await repo.lockClaim(tx, claimId);
    if (!locked) throw notFound('CLAIM_NOT_FOUND', 'Klaim');
    if (locked.status !== 'menunggu') throw new AppError('CONFLICT', 'Klaim sudah diputuskan');
    const docs = await repo.confirmedDocuments(tx, claimId);
    if (docs.length === 0) throw new AppError('CLAIM_DOCUMENT_REQUIRED', 'Klaim memerlukan minimal satu dokumen izin');
    const before = await repo.findClaim(tx, claimId);
    const after = await repo.decideClaim(tx, claimId, { status: 'disetujui', reviewedBy: ctx.actorId, note: note ?? before?.note ?? null });
    // Persetujuan menambah membership dan menaikkan verifikasi faskes (M7).
    await addMembership(tx, after.userId, after.facilityId);
    await repo.raiseFacilityVerification(tx, after.facilityId);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'claim.approve',
      entity: 'facility_claim',
      entityId: claimId,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
  const facility = await repo.findFacilityForClaim(db(), result.facilityId);
  if (facility) await revalidate([tags.facility(facility.slug)]);
  await notifyApplicant(result.userId, result.facilityId, 'disetujui');
  return result;
}

export async function rejectClaim(ctx: ActorContext, claimId: string, reason: string) {
  const result = await db().transaction(async (tx) => {
    const locked = await repo.lockClaim(tx, claimId);
    if (!locked) throw notFound('CLAIM_NOT_FOUND', 'Klaim');
    if (locked.status !== 'menunggu') throw new AppError('CONFLICT', 'Klaim sudah diputuskan');
    const before = await repo.findClaim(tx, claimId);
    const after = await repo.decideClaim(tx, claimId, { status: 'ditolak', reviewedBy: ctx.actorId, rejectionReason: reason });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'claim.reject',
      entity: 'facility_claim',
      entityId: claimId,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
  // Alasan penolakan dikirim lewat email (M7-3).
  await notifyApplicant(result.userId, result.facilityId, 'ditolak', reason);
  return result;
}

async function notifyApplicant(userId: string, facilityId: string, outcome: 'disetujui' | 'ditolak', reason?: string) {
  try {
    const u = await repo.userEmail(db(), userId);
    const f = await repo.findFacilityForClaim(db(), facilityId);
    if (!u || !f) return;
    await sendEmail({
      kind: `claim-${outcome}`,
      to: u.email,
      subject: outcome === 'disetujui' ? `Klaim ${f.name} disetujui` : `Klaim ${f.name} ditolak`,
      text:
        outcome === 'disetujui'
          ? `Klaim profil ${f.name} telah disetujui. Anda kini dapat mengelola profil dan tarif lewat portal SILK.`
          : `Klaim profil ${f.name} ditolak.\n\nAlasan: ${reason}\n\nAnda dapat mengajukan klaim baru dengan dokumen yang sesuai.`,
    });
  } catch (err) {
    logger.error({ err }, 'gagal mengirim email keputusan klaim');
  }
}
