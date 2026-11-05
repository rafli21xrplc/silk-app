import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { facilities, services, tariffs, tariffVersions, type DbOrTx } from '@silk/db';
import type { EntityStatus, VerificationLevel } from '@silk/shared';
import { pointSql } from '@silk/db';

export function listFacilities(db: DbOrTx, f: { status?: EntityStatus; q?: string; limit: number; offset: number }) {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(facilities.status, f.status));
  if (f.q) conds.push(sql`(${facilities.name} % ${f.q} OR ${f.q} <% ${facilities.name} OR ${facilities.slug} = ${f.q})`);
  return db
    .select({
      id: facilities.id,
      slug: facilities.slug,
      name: facilities.name,
      type: facilities.type,
      city: facilities.city,
      status: facilities.status,
      verification: facilities.verification,
      updatedAt: facilities.updatedAt,
    })
    .from(facilities)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(facilities.updatedAt), asc(facilities.name))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export async function findFacility(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: facilities.id,
      slug: facilities.slug,
      status: facilities.status,
      verification: facilities.verification,
      lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
      lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
    })
    .from(facilities)
    .where(eq(facilities.id, id));
  return row ?? null;
}

export async function updateFacility(
  db: DbOrTx,
  id: string,
  v: { status?: EntityStatus; verification?: VerificationLevel; lat?: number; lng?: number },
) {
  const { lat, lng, ...rest } = v;
  await db
    .update(facilities)
    .set({ ...rest, ...(lat !== undefined && lng !== undefined ? { location: pointSql(lat, lng) } : {}), updatedAt: new Date() })
    .where(eq(facilities.id, id));
}

export function tariffQueue(db: DbOrTx, f: { status: EntityStatus; limit: number; offset: number }) {
  return db
    .select({
      id: tariffs.id,
      status: tariffs.status,
      facilityId: facilities.id,
      facilityName: facilities.name,
      serviceSlug: services.slug,
      serviceName: services.name,
      versionNo: tariffVersions.versionNo,
      priceType: tariffVersions.priceType,
      priceMin: tariffVersions.priceMin,
      priceMax: tariffVersions.priceMax,
      effectiveFrom: tariffVersions.effectiveFrom,
      inclusions: tariffVersions.inclusions,
      exclusions: tariffVersions.exclusions,
      createdAt: tariffVersions.createdAt,
    })
    .from(tariffs)
    .innerJoin(facilities, eq(facilities.id, tariffs.facilityId))
    .innerJoin(services, eq(services.id, tariffs.serviceId))
    .leftJoin(tariffVersions, eq(tariffVersions.id, tariffs.currentVersionId))
    .where(eq(tariffs.status, f.status))
    .orderBy(asc(tariffVersions.createdAt))
    .limit(f.limit + 1)
    .offset(f.offset);
}

/** Jumlah item yang menunggu tindakan di tiap antrean (ringkasan panel admin). */
export async function queueCounts(db: DbOrTx) {
  type Counts = {
    claims: number;
    tariffs: number;
    reports: number;
    imports: number;
    profiles: number;
    revisions: number;
    media: number;
    tariffRequests: number;
    articles: number;
  };
  // Batch portal yang tervalidasi menunggu lewat permintaan harga, bukan antrean impor admin.
  const result = await db.execute<Counts>(sql`
    SELECT
      (SELECT count(*)::int FROM facility_claims WHERE status = 'menunggu') AS claims,
      (SELECT count(*)::int FROM tariffs WHERE status = 'menunggu_tinjauan') AS tariffs,
      (SELECT count(*)::int FROM data_reports WHERE status = 'baru') AS reports,
      (SELECT count(*)::int FROM import_batches WHERE status IN ('divalidasi', 'ditinjau') AND facility_id IS NULL) AS imports,
      (SELECT count(*)::int FROM facilities WHERE status = 'menunggu_tinjauan') AS profiles,
      (SELECT count(*)::int FROM profile_revisions WHERE status = 'pending') AS revisions,
      (SELECT count(*)::int FROM profile_media WHERE status = 'pending' AND confirmed_at IS NOT NULL) AS media,
      (SELECT count(*)::int FROM tariff_change_requests WHERE status = 'pending') AS "tariffRequests",
      (SELECT count(*)::int FROM partner_articles WHERE status = 'pending') AS articles
  `);
  return result.rows[0] ?? { claims: 0, tariffs: 0, reports: 0, imports: 0, profiles: 0, revisions: 0, media: 0, tariffRequests: 0, articles: 0 };
}
