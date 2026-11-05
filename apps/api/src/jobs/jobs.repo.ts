import { sql } from 'drizzle-orm';
import type { DbOrTx } from '@silk/db';

export type JobRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/** Antrekan job. Dengan `dedupeKey`, job yang sama tidak digandakan selama masih antre/berjalan. */
export async function enqueueJob(
  db: DbOrTx,
  j: { type: string; payload: Record<string, unknown>; dedupeKey?: string; runAfter?: Date },
): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO jobs (type, payload, dedupe_key, run_after)
    VALUES (${j.type}, ${JSON.stringify(j.payload)}::jsonb, ${j.dedupeKey ?? null}, ${(j.runAfter ?? new Date()).toISOString()}::timestamptz)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('antre','berjalan') DO NOTHING
  `);
  return (result.rowCount ?? 0) > 0;
}

/** Sudah pernah ada job dengan kunci ini sejak `since` (status apa pun)? Untuk dedupe tahan lama. */
export async function jobExistsSince(db: DbOrTx, dedupeKey: string, since: Date): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM jobs WHERE dedupe_key = ${dedupeKey} AND created_at >= ${since.toISOString()}::timestamptz LIMIT 1
  `);
  return result.rows.length > 0;
}

/**
 * Ambil satu job siap jalan dengan `FOR UPDATE SKIP LOCKED`. Job `berjalan` yang kuncinya lebih
 * dari 10 menit dianggap macet (instance mati) dan diambil ulang.
 */
export async function claimJob(db: DbOrTx, types: string[]): Promise<JobRow | null> {
  const typeList = sql.join(types.map((t) => sql`${t}`), sql`, `);
  const result = await db.execute<JobRow>(sql`
    UPDATE jobs SET status = 'berjalan', locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE type IN (${typeList})
        AND ((status = 'antre' AND run_after <= now())
          OR (status = 'berjalan' AND locked_at < now() - interval '10 minutes'))
      ORDER BY run_after
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts
  `);
  return result.rows[0] ?? null;
}

export async function completeJob(db: DbOrTx, id: string) {
  await db.execute(sql`UPDATE jobs SET status = 'selesai', completed_at = now(), locked_at = NULL, last_error = NULL WHERE id = ${id}`);
}

/** Lanjutkan nanti tanpa menghitung sebagai percobaan gagal (mis. anggaran waktu habis). */
export async function rescheduleJob(db: DbOrTx, id: string, delaySec: number) {
  await db.execute(sql`
    UPDATE jobs SET status = 'antre', locked_at = NULL, attempts = greatest(attempts - 1, 0),
      run_after = now() + make_interval(secs => ${delaySec})
    WHERE id = ${id}
  `);
}

export async function failJob(db: DbOrTx, id: string, error: string, attempts: number, maxAttempts = 5) {
  const backoffSec = Math.min(3600, 30 * 2 ** attempts);
  await db.execute(sql`
    UPDATE jobs SET
      status = ${attempts >= maxAttempts ? 'gagal' : 'antre'},
      locked_at = NULL,
      last_error = ${error.slice(0, 2000)},
      run_after = now() + make_interval(secs => ${backoffSec})
    WHERE id = ${id}
  `);
}

export async function jobStats(db: DbOrTx) {
  const result = await db.execute<{ type: string; status: string; n: number }>(sql`
    SELECT type, status, count(*)::int AS n FROM jobs GROUP BY type, status ORDER BY type, status
  `);
  return result.rows;
}
