import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { facilities, importBatches, importRows, type DbOrTx } from '@silk/db';
import type { ImportRowError } from '@silk/shared';
import { likeEscape, searchAny } from '../../lib/sql';

export async function facilitySlugs(db: DbOrTx, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ slug: facilities.slug }).from(facilities).where(inArray(facilities.id, ids));
  return rows.map((r) => r.slug);
}

export type BatchRow = typeof importBatches.$inferSelect;

export async function insertBatch(db: DbOrTx, v: typeof importBatches.$inferInsert) {
  const [row] = await db.insert(importBatches).values(v).returning();
  return row!;
}

export async function findBatch(db: DbOrTx, id: string) {
  const [row] = await db.select().from(importBatches).where(eq(importBatches.id, id));
  return row ?? null;
}

export async function lockBatch(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: string }>(
    sql`SELECT id, status FROM import_batches WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

export async function updateBatch(db: DbOrTx, id: string, v: Partial<typeof importBatches.$inferInsert>) {
  const [row] = await db
    .update(importBatches)
    .set({ ...v, updatedAt: new Date() })
    .where(eq(importBatches.id, id))
    .returning();
  return row ?? null;
}

export function listBatches(db: DbOrTx, f: { status?: string; q?: string; facilityId?: string | null; limit: number; offset: number }) {
  const conds = [];
  if (f.status) conds.push(eq(importBatches.status, f.status));
  const search = searchAny(f.q, [importBatches.fileName, importBatches.sourceKind]);
  if (search) conds.push(search);
  if (f.facilityId === null) conds.push(sql`${importBatches.facilityId} IS NULL`);
  else if (f.facilityId) conds.push(eq(importBatches.facilityId, f.facilityId));
  return db
    .select()
    .from(importBatches)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(importBatches.createdAt))
    .limit(f.limit + 1)
    .offset(f.offset);
}

/** Idempoten: baris yang sudah ada (batch, row_no) diabaikan bila tahap ini diulang. */
export async function insertRawRows(db: DbOrTx, batchId: string, rows: { rowNo: number; raw: Record<string, string> }[]) {
  if (rows.length === 0) return;
  await db
    .insert(importRows)
    .values(rows.map((r) => ({ batchId, rowNo: r.rowNo, raw: r.raw, status: 'pending' })))
    .onConflictDoNothing();
}

export function pendingRows(db: DbOrTx, batchId: string, limit: number) {
  return db
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, 'pending')))
    .orderBy(asc(importRows.rowNo))
    .limit(limit);
}

export async function validKeys(db: DbOrTx, batchId: string): Promise<Set<string>> {
  const rows = await db
    .select({ key: sql<string>`${importRows.parsed}->>'key'` })
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, 'valid')));
  return new Set(rows.map((r) => r.key));
}

export async function updateRow(
  db: DbOrTx,
  id: number,
  v: {
    status: 'valid' | 'galat' | 'ambigu';
    errors: ImportRowError[] | null;
    parsed: Record<string, unknown> | null;
    matchedFacilityId: string | null;
    matchedServiceId: string | null;
    candidates: { id: string; name: string; city: string; score: number }[] | null;
  },
) {
  await db.update(importRows).set(v).where(eq(importRows.id, id));
}

export async function findRow(db: DbOrTx, batchId: string, rowId: number) {
  const [row] = await db
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.id, rowId)));
  return row ?? null;
}

export async function countRows(db: DbOrTx, batchId: string) {
  const rows = await db
    .select({ status: importRows.status, n: sql<number>`count(*)::int` })
    .from(importRows)
    .where(eq(importRows.batchId, batchId))
    .groupBy(importRows.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  return { valid: by.valid ?? 0, galat: by.galat ?? 0, ambigu: by.ambigu ?? 0, pending: by.pending ?? 0 };
}

export function rowsByStatus(db: DbOrTx, batchId: string, statuses: string[], limit: number, offset: number) {
  return db
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), inArray(importRows.status, statuses)))
    .orderBy(asc(importRows.rowNo))
    .limit(limit)
    .offset(offset);
}

export function validRowsForPublish(db: DbOrTx, batchId: string) {
  return db
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, 'valid')))
    .orderBy(asc(importRows.rowNo));
}

export type FacilityCandidate = {
  idx: number;
  id: string;
  name: string;
  city: string;
  score: number;
  exact: boolean;
};

/**
 * Cocokkan pasangan (nama faskes, kota) sekaligus dalam satu query: nama sama persis
 * (tanpa beda huruf) atau mirip (trigram), di kota yang cocok. Maks. 3 kandidat per pasangan.
 */
export async function matchFacilities(
  db: DbOrTx,
  pairs: { idx: number; name: string; city: string }[],
  scopeFacilityId: string | null,
): Promise<FacilityCandidate[]> {
  if (pairs.length === 0) return [];
  const json = JSON.stringify(pairs.map((p) => ({ idx: p.idx, name: p.name, city: likeEscape(p.city) })));
  const scope = scopeFacilityId ? sql`AND f.id = ${scopeFacilityId}` : sql``;
  const result = await db.execute<FacilityCandidate>(sql`
    SELECT q.idx, m.id, m.name, m.city, m.score, m.exact
    FROM jsonb_to_recordset(${json}::jsonb) AS q(idx int, name text, city text)
    JOIN LATERAL (
      SELECT f.id, f.name, f.city,
        similarity(f.name, q.name)::float8 AS score,
        lower(unaccent(f.name)) = lower(unaccent(q.name)) AS exact
      FROM facilities f
      LEFT JOIN regions r ON r.id = f.region_id
      WHERE f.status <> 'ditarik' ${scope}
        AND (r.name ILIKE '%' || q.city || '%' OR f.city ILIKE '%' || q.city || '%' OR r.slug = lower(q.city))
        AND (lower(unaccent(f.name)) = lower(unaccent(q.name)) OR f.name % q.name)
      ORDER BY exact DESC, score DESC
      LIMIT 3
    ) m ON true
  `);
  return result.rows;
}

export type RowUpdate = {
  id: number;
  status: 'valid' | 'galat' | 'ambigu';
  errors: ImportRowError[] | null;
  parsed: Record<string, unknown> | null;
  matchedFacilityId: string | null;
  matchedServiceId: string | null;
  candidates: { id: string; name: string; city: string; score: number }[] | null;
};

/** Perbarui hasil validasi banyak baris dalam satu UPDATE. */
export async function updateRows(db: DbOrTx, rows: RowUpdate[]) {
  if (rows.length === 0) return;
  const json = JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      errors: r.errors,
      parsed: r.parsed,
      facility: r.matchedFacilityId,
      service: r.matchedServiceId,
      candidates: r.candidates,
    })),
  );
  await db.execute(sql`
    UPDATE import_rows r SET
      status = u.status, errors = u.errors, parsed = u.parsed,
      matched_facility_id = u.facility, matched_service_id = u.service, candidates = u.candidates
    FROM jsonb_to_recordset(${json}::jsonb)
      AS u(id bigint, status text, errors jsonb, parsed jsonb, facility uuid, service uuid, candidates jsonb)
    WHERE r.id = u.id
  `);
}
