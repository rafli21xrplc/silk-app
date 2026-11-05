import { isPartnerRole, partnerTypeForRole, type PartnerStatus, type PartnerType, type PartnerUpsertInput } from '@silk/shared';
import type { ActorContext } from '../../lib/context';
import { db } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { recordAudit } from '../m15-admin/audit.repo';
import * as repo from './partners.repo';

const PARTNER_LABEL: Record<PartnerType, string> = {
  fasilitas: 'fasilitas kesehatan',
  tenaga_medis: 'tenaga medis',
  gaya_hidup: 'praktisi gaya hidup sehat',
  apotek: 'apotek',
};

export function myPartner(ctx: ActorContext) {
  return repo.findByUser(db(), ctx.actorId!);
}

/**
 * Kirim atau perbarui data usaha dan izin. Jenis mitra harus sesuai role akun (ditetapkan saat daftar).
 * Setiap perubahan mengembalikan status ke `pending` agar admin memeriksa ulang data izin yang baru.
 */
export async function upsertMyPartner(ctx: ActorContext, input: PartnerUpsertInput) {
  const userId = ctx.actorId!;
  if (!ctx.role || !isPartnerRole(ctx.role) || partnerTypeForRole(ctx.role) !== input.partnerType) {
    throw new AppError('FORBIDDEN', 'Jenis mitra tidak sesuai dengan jenis akun Anda');
  }
  return db().transaction(async (tx) => {
    const locked = await repo.lockByUser(tx, userId);
    const before = locked ? await repo.findByUser(tx, userId) : null;
    const after = before ? await repo.resubmitPartner(tx, before.id, input) : await repo.insertPartner(tx, userId, input);
    await recordAudit(tx, {
      actorId: userId,
      action: before ? 'partner.updated' : 'partner.submitted',
      entity: 'partner',
      entityId: after.id,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
}

/* ---------- Admin ---------- */

export async function partnerQueue(q: { status: PartnerStatus; type?: PartnerType; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.partnerQueue(db(), { status: q.status, type: q.type, limit: q.limit, offset });
  return pageOf(rows, q.limit, offset);
}

async function decide(
  ctx: ActorContext,
  id: string,
  decision: { status: 'verified' } | { status: 'rejected'; reason: string },
) {
  const result = await db().transaction(async (tx) => {
    const locked = await repo.lockById(tx, id);
    if (!locked) throw notFound('PARTNER_NOT_FOUND', 'Mitra');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Pengajuan mitra sudah diputuskan');
    const before = await repo.findById(tx, id);
    const after =
      decision.status === 'verified'
        ? await repo.decidePartner(tx, id, { status: 'verified', verifiedBy: ctx.actorId })
        : await repo.decidePartner(tx, id, { status: 'rejected', rejectionReason: decision.reason });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: decision.status === 'verified' ? 'partner.verified' : 'partner.rejected',
      entity: 'partner',
      entityId: id,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
  await notifyPartner(result.userId, result.partnerType, decision);
  return result;
}

export const approvePartner = (ctx: ActorContext, id: string) => decide(ctx, id, { status: 'verified' });
export const rejectPartner = (ctx: ActorContext, id: string, reason: string) => decide(ctx, id, { status: 'rejected', reason });

async function notifyPartner(
  userId: string,
  type: PartnerType,
  decision: { status: 'verified' } | { status: 'rejected'; reason: string },
) {
  try {
    const u = await repo.userContact(db(), userId);
    if (!u) return;
    const label = PARTNER_LABEL[type];
    await sendEmail({
      kind: `partner-${decision.status}`,
      to: u.email,
      subject: decision.status === 'verified' ? 'Akun mitra SILK terverifikasi' : 'Pengajuan mitra SILK ditolak',
      text:
        decision.status === 'verified'
          ? `Halo ${u.name},\n\nData Anda sebagai ${label} telah diverifikasi tim SILK.`
          : `Halo ${u.name},\n\nPengajuan Anda sebagai ${label} belum dapat diverifikasi.\n\nAlasan: ${decision.reason}\n\nPerbaiki data lewat halaman mitra di SILK, lalu kirim ulang.`,
    });
  } catch (err) {
    logger.error({ err }, 'gagal mengirim email keputusan mitra');
  }
}
