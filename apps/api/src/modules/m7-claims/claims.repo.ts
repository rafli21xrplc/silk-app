import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { documents, facilities, facilityClaims, user, type DbOrTx } from '@silk/db';

export async function findFacilityForClaim(db: DbOrTx, facilityId: string) {
  const [row] = await db
    .select({ id: facilities.id, slug: facilities.slug, name: facilities.name, status: facilities.status, verification: facilities.verification })
    .from(facilities)
    .where(eq(facilities.id, facilityId));
  return row ?? null;
}

export async function insertClaim(db: DbOrTx, v: { facilityId: string; userId: string; note: string | null }) {
  const [row] = await db.insert(facilityClaims).values(v).onConflictDoNothing().returning();
  return row ?? null;
}

export async function findClaim(db: DbOrTx, id: string) {
  const [row] = await db.select().from(facilityClaims).where(eq(facilityClaims.id, id));
  return row ?? null;
}

export async function lockClaim(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: string }>(sql`SELECT id, status FROM facility_claims WHERE id = ${id} FOR UPDATE`);
  return result.rows[0] ?? null;
}

export function claimsOfUser(db: DbOrTx, userId: string) {
  return db
    .select({
      id: facilityClaims.id,
      status: facilityClaims.status,
      note: facilityClaims.note,
      rejectionReason: facilityClaims.rejectionReason,
      createdAt: facilityClaims.createdAt,
      reviewedAt: facilityClaims.reviewedAt,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      documentCount: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.claim_id = ${facilityClaims.id} AND d.confirmed_at IS NOT NULL AND d.deleted_at IS NULL)`,
    })
    .from(facilityClaims)
    .innerJoin(facilities, eq(facilities.id, facilityClaims.facilityId))
    .where(eq(facilityClaims.userId, userId))
    .orderBy(desc(facilityClaims.createdAt));
}

export function claimQueue(db: DbOrTx, f: { status: string; limit: number; offset: number }) {
  return db
    .select({
      id: facilityClaims.id,
      status: facilityClaims.status,
      note: facilityClaims.note,
      createdAt: facilityClaims.createdAt,
      reviewedAt: facilityClaims.reviewedAt,
      rejectionReason: facilityClaims.rejectionReason,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilityCity: facilities.city,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      documentCount: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.claim_id = ${facilityClaims.id} AND d.confirmed_at IS NOT NULL AND d.deleted_at IS NULL)`,
    })
    .from(facilityClaims)
    .innerJoin(facilities, eq(facilities.id, facilityClaims.facilityId))
    .innerJoin(user, eq(user.id, facilityClaims.userId))
    .where(eq(facilityClaims.status, f.status))
    .orderBy(asc(facilityClaims.createdAt))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export async function insertDocument(
  db: DbOrTx,
  v: { claimId: string; objectKey: string; fileName: string; mime: string; sizeBytes: number },
) {
  const [row] = await db.insert(documents).values(v).returning();
  return row!;
}

export async function findDocument(db: DbOrTx, claimId: string, documentId: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.claimId, claimId), isNull(documents.deletedAt)));
  return row ?? null;
}

export async function confirmDocument(db: DbOrTx, id: string, sizeBytes: number) {
  await db.update(documents).set({ confirmedAt: new Date(), sizeBytes }).where(eq(documents.id, id));
}

export async function deleteDocumentRow(db: DbOrTx, id: string) {
  await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
}

export function confirmedDocuments(db: DbOrTx, claimId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.claimId, claimId), isNotNull(documents.confirmedAt), isNull(documents.deletedAt)))
    .orderBy(asc(documents.uploadedAt));
}

export async function decideClaim(
  db: DbOrTx,
  id: string,
  v: { status: 'disetujui' | 'ditolak'; reviewedBy: string | null; rejectionReason?: string | null; note?: string | null },
) {
  const [row] = await db
    .update(facilityClaims)
    .set({ ...v, reviewedAt: new Date() })
    .where(eq(facilityClaims.id, id))
    .returning();
  return row!;
}

export async function raiseFacilityVerification(db: DbOrTx, facilityId: string) {
  await db
    .update(facilities)
    .set({ verification: 'diverifikasi_admin', updatedAt: new Date() })
    .where(eq(facilities.id, facilityId));
}

export async function userEmail(db: DbOrTx, userId: string) {
  const [row] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId));
  return row ?? null;
}
