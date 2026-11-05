import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { facilities, profileMedia, type DbOrTx } from '@silk/db';
import type { MediaKind, ReviewStatus } from '@silk/shared';

/** Unggahan yang belum dikonfirmasi tetap dihitung selama signed URL-nya masih berlaku. */
const UNCONFIRMED_GRACE = sql`interval '15 minutes'`;

export async function countActive(db: DbOrTx, facilityId: string, kind: MediaKind): Promise<number> {
  const result = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM profile_media
    WHERE facility_id = ${facilityId} AND kind = ${kind}::media_kind AND status IN ('pending', 'approved')
      AND (confirmed_at IS NOT NULL OR created_at > now() - ${UNCONFIRMED_GRACE})
  `);
  return result.rows[0]?.n ?? 0;
}

export async function insertMedia(
  db: DbOrTx,
  v: {
    facilityId: string;
    kind: MediaKind;
    objectKey: string;
    fileName: string;
    mime: string;
    sizeBytes: number;
    durationSec: number | null;
    caption: string | null;
    uploadedBy: string | null;
  },
) {
  const [row] = await db
    .insert(profileMedia)
    .values({
      ...v,
      sortOrder: sql`(SELECT coalesce(max(sort_order), -1) + 1 FROM profile_media WHERE facility_id = ${v.facilityId})`,
    })
    .returning();
  return row!;
}

export async function findMedia(db: DbOrTx, facilityId: string, id: string) {
  const [row] = await db
    .select()
    .from(profileMedia)
    .where(and(eq(profileMedia.id, id), eq(profileMedia.facilityId, facilityId)));
  return row ?? null;
}

export async function lockMedia(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: ReviewStatus }>(
    sql`SELECT id, status FROM profile_media WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(profileMedia).where(eq(profileMedia.id, id));
  return row ?? null;
}

export async function markConfirmed(db: DbOrTx, id: string, v: { sizeBytes: number; durationSec: number | null }) {
  const [row] = await db
    .update(profileMedia)
    .set({ ...v, confirmedAt: new Date() })
    .where(eq(profileMedia.id, id))
    .returning();
  return row!;
}

export async function deleteMediaRow(db: DbOrTx, id: string) {
  await db.delete(profileMedia).where(eq(profileMedia.id, id));
}

export function listForFacility(db: DbOrTx, facilityId: string) {
  return db
    .select()
    .from(profileMedia)
    .where(and(eq(profileMedia.facilityId, facilityId), isNotNull(profileMedia.confirmedAt)))
    .orderBy(asc(profileMedia.kind), asc(profileMedia.sortOrder), asc(profileMedia.createdAt));
}

export async function reorder(db: DbOrTx, facilityId: string, ids: string[]) {
  const rows = ids.map((id, i) => ({ id, sort_order: i }));
  await db.execute(sql`
    UPDATE profile_media m SET sort_order = x.sort_order
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(id uuid, sort_order int)
    WHERE m.id = x.id AND m.facility_id = ${facilityId}
  `);
}

export async function decide(
  db: DbOrTx,
  id: string,
  v: { status: 'approved' | 'rejected'; reviewedBy: string | null; publicUrl?: string; rejectionReason?: string },
) {
  const [row] = await db
    .update(profileMedia)
    .set({ ...v, reviewedAt: new Date() })
    .where(eq(profileMedia.id, id))
    .returning();
  return row!;
}

export function queue(db: DbOrTx, f: { status: ReviewStatus; limit: number; offset: number }) {
  return db
    .select({
      id: profileMedia.id,
      kind: profileMedia.kind,
      objectKey: profileMedia.objectKey,
      fileName: profileMedia.fileName,
      mime: profileMedia.mime,
      sizeBytes: profileMedia.sizeBytes,
      durationSec: profileMedia.durationSec,
      caption: profileMedia.caption,
      status: profileMedia.status,
      rejectionReason: profileMedia.rejectionReason,
      publicUrl: profileMedia.publicUrl,
      createdAt: profileMedia.createdAt,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
    })
    .from(profileMedia)
    .innerJoin(facilities, eq(facilities.id, profileMedia.facilityId))
    .where(and(eq(profileMedia.status, f.status), isNotNull(profileMedia.confirmedAt)))
    .orderBy(asc(profileMedia.createdAt), asc(profileMedia.id))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export function publicMedia(db: DbOrTx, facilityId: string) {
  return db
    .select({
      id: profileMedia.id,
      kind: profileMedia.kind,
      url: sql<string>`${profileMedia.publicUrl}`,
      mime: profileMedia.mime,
      caption: profileMedia.caption,
      durationSec: profileMedia.durationSec,
    })
    .from(profileMedia)
    .where(and(eq(profileMedia.facilityId, facilityId), eq(profileMedia.status, 'approved'), isNotNull(profileMedia.publicUrl)))
    .orderBy(asc(profileMedia.kind), asc(profileMedia.sortOrder), asc(profileMedia.createdAt));
}

export async function facilityStatus(db: DbOrTx, facilityId: string) {
  const [row] = await db
    .select({ slug: facilities.slug, status: facilities.status })
    .from(facilities)
    .where(eq(facilities.id, facilityId));
  return row ?? null;
}

/** Dipakai rute media dev: hanya objek media yang sudah disetujui boleh dialihkan. */
export async function isApprovedMediaKey(db: DbOrTx, objectKey: string): Promise<boolean> {
  const [row] = await db
    .select({ id: profileMedia.id })
    .from(profileMedia)
    .where(and(eq(profileMedia.objectKey, objectKey), eq(profileMedia.status, 'approved')))
    .limit(1);
  return !!row;
}
