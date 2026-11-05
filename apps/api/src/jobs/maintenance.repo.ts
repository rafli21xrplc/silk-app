import { sql } from 'drizzle-orm';
import type { DbOrTx } from '@silk/db';

/** Faskes dengan tarif terbit yang usang (verified_at lebih lama dari batas), beserta email pengelola. */
export async function facilitiesWithStaleTariffs(db: DbOrTx, staleAfterDays: number) {
  const result = await db.execute<{ facility_id: string; facility_name: string; stale_count: number; emails: string[] }>(sql`
    SELECT f.id AS facility_id, f.name AS facility_name, count(DISTINCT pt.tariff_id)::int AS stale_count,
      array_agg(DISTINCT u.email) AS emails
    FROM published_tariffs pt
    JOIN facilities f ON f.id = pt.facility_id
    JOIN memberships m ON m.facility_id = f.id
    JOIN "user" u ON u.id = m.user_id
    WHERE pt.verified_at < now() - make_interval(days => ${staleAfterDays})
    GROUP BY f.id, f.name
  `);
  return result.rows;
}

export async function rejectedClaimDocuments(db: DbOrTx, olderThanDays: number, limit: number) {
  const result = await db.execute<{ id: string; object_key: string }>(sql`
    SELECT d.id, d.object_key FROM documents d
    JOIN facility_claims c ON c.id = d.claim_id
    WHERE c.status = 'ditolak' AND d.deleted_at IS NULL
      AND c.reviewed_at < now() - make_interval(days => ${olderThanDays})
    LIMIT ${limit}
  `);
  return result.rows;
}

export async function markDocumentDeleted(db: DbOrTx, id: string) {
  await db.execute(sql`UPDATE documents SET deleted_at = now() WHERE id = ${id}`);
}

export async function purgeOldRows(db: DbOrTx) {
  const audit = await db.execute(sql`
    DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs WHERE at < now() - interval '2 years' LIMIT 5000)
  `);
  const counters = await db.execute(sql`DELETE FROM rate_limit_counters WHERE window_start < now() - interval '1 day'`);
  const jobs = await db.execute(sql`DELETE FROM jobs WHERE status = 'selesai' AND completed_at < now() - interval '30 days'`);
  return { auditLogs: audit.rowCount ?? 0, rateLimitCounters: counters.rowCount ?? 0, jobs: jobs.rowCount ?? 0 };
}
