import { and, desc, eq, sql } from 'drizzle-orm';
import { facilities, reviews, user, type DbOrTx } from '@silk/db';
import type { ReviewAspects, ReviewStatus } from '@silk/shared';

export type ReviewRow = typeof reviews.$inferSelect;

/** Semua ulasan disetujui satu profil (untuk ringkasan). Jumlahnya kecil per profil. */
export function approvedForSummary(db: DbOrTx, facilityId: string) {
  return db
    .select({ rating: reviews.rating, aspects: reviews.aspects, sample: reviews.isSample })
    .from(reviews)
    .where(and(eq(reviews.facilityId, facilityId), eq(reviews.status, 'approved')));
}

/** Ulasan disetujui terbaru dulu, dengan nama penulis (disingkat di service). */
export function approvedPage(db: DbOrTx, facilityId: string, p: { limit: number; offset: number }) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      aspects: reviews.aspects,
      comment: reviews.comment,
      sample: reviews.isSample,
      authorName: user.name,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(user, eq(user.id, reviews.authorId))
    .where(and(eq(reviews.facilityId, facilityId), eq(reviews.status, 'approved')))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(p.limit + 1)
    .offset(p.offset);
}

export async function findMine(db: DbOrTx, authorId: string, facilityId: string) {
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.authorId, authorId), eq(reviews.facilityId, facilityId)));
  return row ?? null;
}

/** Tulis atau ubah ulasan sendiri; selalu kembali ke antrean moderasi. */
export async function upsertMine(
  db: DbOrTx,
  v: { authorId: string; facilityId: string; rating: number; aspects: ReviewAspects; comment: string | null; declarationVersion: string },
) {
  const [row] = await db
    .insert(reviews)
    .values({ ...v, status: 'pending' })
    .onConflictDoUpdate({
      target: [reviews.authorId, reviews.facilityId],
      targetWhere: sql`${reviews.authorId} IS NOT NULL`,
      set: {
        rating: v.rating,
        aspects: v.aspects,
        comment: v.comment,
        declarationVersion: v.declarationVersion,
        status: 'pending',
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row!;
}

export async function deleteReview(db: DbOrTx, id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
}

export async function lockReview(db: DbOrTx, id: string) {
  const r = await db.execute<{ id: string; status: ReviewStatus; facility_id: string }>(
    sql`SELECT id, status, facility_id FROM reviews WHERE id = ${id} FOR UPDATE`,
  );
  return r.rows[0] ?? null;
}

export async function decide(
  db: DbOrTx,
  id: string,
  v: { status: 'approved' | 'rejected'; reviewedBy: string | null; rejectionReason: string | null },
) {
  const [row] = await db
    .update(reviews)
    .set({ ...v, reviewedAt: sql`now()` })
    .where(eq(reviews.id, id))
    .returning();
  return row!;
}

export function queue(db: DbOrTx, f: { status: ReviewStatus; limit: number; offset: number }) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      aspects: reviews.aspects,
      comment: reviews.comment,
      status: reviews.status,
      rejectionReason: reviews.rejectionReason,
      sample: reviews.isSample,
      authorName: user.name,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(facilities, eq(facilities.id, reviews.facilityId))
    .leftJoin(user, eq(user.id, reviews.authorId))
    .where(eq(reviews.status, f.status))
    // Antrean: yang paling lama menunggu dulu.
    .orderBy(reviews.updatedAt, reviews.id)
    .limit(f.limit + 1)
    .offset(f.offset);
}

/**
 * Hitung ulang `facility_ratings` dari ulasan pengguna yang disetujui. Data contoh tidak ikut, jadi rating di
 * kartu pencarian tidak pernah berasal dari data contoh. Idempoten; tanpa ulasan → baris dihapus.
 */
export async function refreshRating(db: DbOrTx, facilityId: string) {
  await db.execute(sql`
    WITH s AS (
      SELECT count(*)::int AS n, round(avg(rating)::numeric, 1) AS a
      FROM reviews WHERE facility_id = ${facilityId} AND status = 'approved' AND NOT is_sample
    ), del AS (
      DELETE FROM facility_ratings WHERE facility_id = ${facilityId} AND (SELECT n FROM s) = 0
    )
    INSERT INTO facility_ratings (facility_id, rating_avg, rating_count, updated_at)
    SELECT ${facilityId}, a, n, now() FROM s WHERE n > 0
    ON CONFLICT (facility_id) DO UPDATE SET rating_avg = EXCLUDED.rating_avg, rating_count = EXCLUDED.rating_count, updated_at = now()
  `);
}

export async function facilityOf(db: DbOrTx, facilityId: string) {
  const [row] = await db.select({ slug: facilities.slug, status: facilities.status }).from(facilities).where(eq(facilities.id, facilityId));
  return row ?? null;
}
