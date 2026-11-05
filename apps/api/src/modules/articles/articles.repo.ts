import { desc, eq, sql } from 'drizzle-orm';
import { partnerArticles, type DbOrTx } from '@silk/db';
import type { ArticleStatus, PartnerType } from '@silk/shared';

export type ArticleRow = typeof partnerArticles.$inferSelect;

/** Penulis untuk tampilan: nama praktisi (tenaga medis) atau nama usaha, plus profil publik bila ada. */
export type AuthorRow = {
  author_name: string;
  partner_type: PartnerType;
  partner_status: string;
  profile_path: string | null;
};

const AUTHOR_JOIN = sql`
  JOIN partners p ON p.id = a.partner_id
  LEFT JOIN practitioners pr ON pr.id = p.practitioner_id
  LEFT JOIN LATERAL (
    SELECT f.slug FROM memberships m JOIN facilities f ON f.id = m.facility_id
    WHERE m.user_id = p.user_id AND f.status = 'terbit'
    ORDER BY m.created_at, f.id LIMIT 1
  ) pf ON true`;

const AUTHOR_COLS = sql`
  CASE WHEN p.partner_type = 'tenaga_medis' AND pr.name IS NOT NULL THEN pr.name ELSE p.business_name END AS author_name,
  p.partner_type, p.status AS partner_status,
  CASE
    WHEN pf.slug IS NOT NULL THEN '/faskes/' || pf.slug
    WHEN pr.slug IS NOT NULL AND pr.status = 'terbit' THEN '/dokter/' || pr.slug
  END AS profile_path`;

/**
 * Satu-satunya definisi "tampil publik": ada salinan terbit, tidak ditarik (`withdrawn_at` hanya dikosongkan
 * saat disetujui lagi), mitra masih terverifikasi.
 * Filter M17 saat dibaca diterapkan di service karena aturannya dibaca dari tabel lain.
 */
const LIVE = sql`a.published_body IS NOT NULL AND a.withdrawn_at IS NULL AND p.status = 'verified'`;

export async function insertArticle(
  db: DbOrTx,
  v: { partnerId: string; authorUserId: string | null; slug: string; title: string; summary: string; body: string },
): Promise<ArticleRow> {
  const [row] = await db.insert(partnerArticles).values(v).returning();
  return row!;
}

export async function lockArticle(db: DbOrTx, id: string): Promise<ArticleRow | null> {
  const [row] = await db.select().from(partnerArticles).where(eq(partnerArticles.id, id)).for('update');
  return row ?? null;
}

export async function findArticle(db: DbOrTx, id: string): Promise<ArticleRow | null> {
  const [row] = await db.select().from(partnerArticles).where(eq(partnerArticles.id, id));
  return row ?? null;
}

export async function updateArticle(db: DbOrTx, id: string, patch: Partial<Omit<ArticleRow, 'id' | 'partnerId' | 'createdAt'>>): Promise<ArticleRow> {
  const [row] = await db
    .update(partnerArticles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(partnerArticles.id, id))
    .returning();
  return row!;
}

export async function deleteArticle(db: DbOrTx, id: string): Promise<void> {
  await db.delete(partnerArticles).where(eq(partnerArticles.id, id));
}

export function listByPartner(db: DbOrTx, partnerId: string) {
  return db.select().from(partnerArticles).where(eq(partnerArticles.partnerId, partnerId)).orderBy(desc(partnerArticles.updatedAt), desc(partnerArticles.id));
}

export async function countPending(db: DbOrTx, partnerId: string, exceptId: string): Promise<number> {
  const r = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM partner_articles
    WHERE partner_id = ${partnerId} AND status = 'pending' AND id <> ${exceptId}
  `);
  return r.rows[0]?.n ?? 0;
}

export async function partnerIsVerified(db: DbOrTx, partnerId: string): Promise<boolean> {
  const r = await db.execute<{ ok: boolean }>(sql`SELECT status = 'verified' AS ok FROM partners WHERE id = ${partnerId}`);
  return r.rows[0]?.ok ?? false;
}

/* ---------- Admin ---------- */

export type QueueRow = AuthorRow & {
  id: string;
  slug: string;
  status: ArticleStatus;
  title: string;
  needs_review: boolean;
  revision: boolean;
  submitted_at: string | null;
  updated_at: string;
};

export async function queue(db: DbOrTx, f: { status: ArticleStatus; limit: number; offset: number }): Promise<QueueRow[]> {
  const r = await db.execute<QueueRow>(sql`
    SELECT a.id, a.slug, a.status, a.title, a.needs_review, a.published_body IS NOT NULL AS revision,
      a.submitted_at::text AS submitted_at, a.updated_at::text AS updated_at, ${AUTHOR_COLS}
    FROM partner_articles a ${AUTHOR_JOIN}
    WHERE a.status = ${f.status}::article_status
    ORDER BY a.submitted_at ASC NULLS LAST, a.updated_at ASC, a.id
    LIMIT ${f.limit + 1} OFFSET ${f.offset}
  `);
  return r.rows;
}

export async function authorOf(db: DbOrTx, id: string): Promise<AuthorRow | null> {
  const r = await db.execute<AuthorRow>(sql`SELECT ${AUTHOR_COLS} FROM partner_articles a ${AUTHOR_JOIN} WHERE a.id = ${id}`);
  return r.rows[0] ?? null;
}

/* ---------- Publik (hanya salinan terbit) ---------- */

export type PublicRow = AuthorRow & {
  slug: string;
  published_title: string;
  published_summary: string;
  published_body: string;
  first_published_at: string;
  published_updated_at: string;
};

const PUBLIC_COLS = sql`a.slug, a.published_title, a.published_summary, a.published_body,
  to_char(a.first_published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS first_published_at,
  to_char(a.published_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_updated_at`;

export async function publicList(db: DbOrTx, f: { limit: number; offset: number }): Promise<PublicRow[]> {
  const r = await db.execute<PublicRow>(sql`
    SELECT ${PUBLIC_COLS}, ${AUTHOR_COLS}
    FROM partner_articles a ${AUTHOR_JOIN}
    WHERE ${LIVE}
    ORDER BY a.first_published_at DESC, a.id
    LIMIT ${f.limit + 1} OFFSET ${f.offset}
  `);
  return r.rows;
}

export async function publicBySlug(db: DbOrTx, slug: string): Promise<PublicRow | null> {
  const r = await db.execute<PublicRow>(sql`
    SELECT ${PUBLIC_COLS}, ${AUTHOR_COLS}
    FROM partner_articles a ${AUTHOR_JOIN}
    WHERE a.slug = ${slug} AND ${LIVE}
  `);
  return r.rows[0] ?? null;
}

/** Slug artikel yang sedang tampil milik satu mitra (revalidate saat status mitra berubah). */
export async function liveSlugsOfPartner(db: DbOrTx, partnerId: string): Promise<string[]> {
  const r = await db.execute<{ slug: string }>(sql`
    SELECT a.slug FROM partner_articles a WHERE a.partner_id = ${partnerId} AND a.published_body IS NOT NULL AND a.withdrawn_at IS NULL
  `);
  return r.rows.map((x) => x.slug);
}
