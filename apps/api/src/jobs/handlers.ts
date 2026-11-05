import { db } from '../lib/db';
import { sendEmail } from '../lib/email';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { storage } from '../lib/storage';
import { processBatch } from '../modules/m5-imports/imports.service';
import { claimJob, completeJob, enqueueJob, failJob, jobExistsSince, rescheduleJob } from './jobs.repo';
import * as maintenance from './maintenance.repo';

type HandlerOutcome = 'done' | 'later';
type JobHandler = (payload: Record<string, unknown>, budgetMs: number) => Promise<HandlerOutcome>;

/** Semua handler idempoten: aman dijalankan ulang bila instance mati di tengah jalan. */
const handlers: Record<string, JobHandler> = {
  'import.process': async (payload, budgetMs) => {
    const { done } = await processBatch(String(payload.batchId), { timeBudgetMs: Math.min(budgetMs, 50_000) });
    return done ? 'done' : 'later';
  },
  'email.stale-reminder': async (payload) => {
    const emails = (payload.emails as string[] | undefined) ?? [];
    await Promise.all(
      emails.map((to) =>
        sendEmail({
          kind: 'stale-reminder',
          to,
          subject: `Perbarui tarif ${String(payload.facilityName)} di SILK`,
          text: `Ada ${String(payload.staleCount)} tarif ${String(payload.facilityName)} yang belum diverifikasi ulang lebih dari ${env().STALE_AFTER_DAYS} hari dan kini ditandai "usang" di SILK.\n\nMasuk ke portal SILK untuk memeriksa dan memperbarui tarif Anda.`,
        }),
      ),
    );
    return 'done';
  },
};

export const QUEUE_TYPES = Object.keys(handlers);

/** Jalankan job antre sampai habis atau anggaran waktu tercapai (di bawah batas durasi fungsi). */
export async function runQueue(opts: { types?: string[]; timeBudgetMs?: number } = {}) {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? 240_000;
  const types = opts.types ?? QUEUE_TYPES;
  const summary = { ran: 0, done: 0, later: 0, failed: 0 };
  while (Date.now() - started < budget) {
    const job = await claimJob(db(), types);
    if (!job) break;
    summary.ran++;
    const handler = handlers[job.type];
    try {
      if (!handler) throw new Error(`Tidak ada handler untuk ${job.type}`);
      const outcome = await handler(job.payload, budget - (Date.now() - started));
      if (outcome === 'done') {
        await completeJob(db(), job.id);
        summary.done++;
      } else {
        await rescheduleJob(db(), job.id, 30);
        summary.later++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, jobId: job.id, type: job.type }, 'job gagal');
      await failJob(db(), job.id, message, job.attempts);
      summary.failed++;
    }
  }
  return summary;
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Cron harian: pengingat untuk faskes dengan tarif usang, maks. sekali per minggu per faskes. */
export async function staleReminders(now = new Date()) {
  const rows = await maintenance.facilitiesWithStaleTariffs(db(), env().STALE_AFTER_DAYS);
  let queued = 0;
  for (const r of rows) {
    const key = `stale:${r.facility_id}:${isoWeek(now)}`;
    if (await jobExistsSince(db(), key, new Date(now.getTime() - 7 * 86_400_000))) continue;
    const ok = await enqueueJob(db(), {
      type: 'email.stale-reminder',
      payload: { facilityId: r.facility_id, facilityName: r.facility_name, staleCount: r.stale_count, emails: r.emails },
      dedupeKey: key,
    });
    if (ok) queued++;
  }
  const run = await runQueue({ types: ['email.stale-reminder'], timeBudgetMs: 120_000 });
  return { facilities: rows.length, queued, ...run };
}

/** Cron harian: retensi (bagian 8) — dokumen klaim ditolak > 90 hari, audit log > 2 tahun. */
export async function retention() {
  const docs = await maintenance.rejectedClaimDocuments(db(), 90, 200);
  for (const d of docs) {
    await storage().delete(d.object_key);
    await maintenance.markDocumentDeleted(db(), d.id);
  }
  const purged = await maintenance.purgeOldRows(db());
  return { documentsDeleted: docs.length, ...purged };
}
