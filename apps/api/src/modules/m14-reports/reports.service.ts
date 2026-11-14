import type { ReportCreateInput } from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { sendEmail } from '../../lib/email';
import { notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { verifyTurnstile } from '../../lib/turnstile';
import { recordAudit } from '../m15-admin/audit.repo';
import { findPublishedTariff } from '../m4-trust/trust.repo';
import * as repo from './reports.repo';

/** Laporan data salah dari publik (M14): Turnstile wajib, menautkan ke versi tarif yang dilaporkan. */
export async function createReport(input: ReportCreateInput, ip: string | null) {
  await verifyTurnstile(input.turnstileToken, ip);
  const tariff = await findPublishedTariff(db(), input.tariffId);
  if (!tariff) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  const report = await repo.insertReport(db(), {
    tariffId: tariff.tariffId,
    tariffVersionId: tariff.versionId,
    reason: input.reason,
    contactEmail: input.contactEmail ?? null,
  });
  return { id: report.id, status: report.status };
}

export async function queue(q: { status?: string; q?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.reportQueue(db(), { status: q.status ?? 'baru', q: q.q, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  // Email pelapor tidak ditampilkan di antrean; cukup penanda ada/tidaknya kontak.
  return { ...page, items: page.items.map(({ hasContact, ...r }) => ({ ...r, hasContact: Boolean(hasContact) })) };
}

export async function handle(ctx: ActorContext, id: string, input: { status: string; note?: string }) {
  const result = await db().transaction(async (tx) => {
    const before = await repo.findReport(tx, id);
    if (!before) throw notFound('REPORT_NOT_FOUND', 'Laporan');
    const after = await repo.updateReport(tx, id, { status: input.status, note: input.note ?? null, handledBy: ctx.actorId });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'report.update',
      entity: 'data_report',
      entityId: id,
      before: { status: before.status, note: before.note },
      after: { status: after.status, note: after.note },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
  if (result.contactEmail && (result.status === 'selesai' || result.status === 'ditolak')) {
    try {
      await sendEmail({
        kind: 'report-status',
        to: result.contactEmail,
        subject: 'Status laporan data Anda di SILK',
        text: `Terima kasih atas laporan Anda. Status laporan kini: ${result.status}.${result.note ? `\n\nCatatan tim: ${result.note}` : ''}`,
      });
    } catch (err) {
      logger.warn({ err }, 'gagal mengirim email status laporan');
    }
  }
  return { id: result.id, status: result.status, note: result.note };
}
