import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import {
  facilities,
  facilityPractitioners,
  practitioners,
  regions,
  type DbOrTx,
} from '@silk/db';
import type { FacilityType, PriceType, SortOption, VerificationLevel } from '@silk/shared';
import { cityCondition } from '../../lib/sql';

export interface FacilitySearchParams {
  q?: string;
  city?: string;
  type?: FacilityType;
  serviceId?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: SortOption;
  limit: number;
  offset: number;
}

export type FacilitySearchRow = {
  id: string;
  slug: string;
  name: string;
  type: FacilityType;
  address: string;
  city: string;
  verification: VerificationLevel;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  score: number;
  tariff_id: string | null;
  price_type: PriceType | null;
  price_min: number | null;
  price_max: number | null;
  effective_from: string | null;
  effective_to: string | null;
  verified_at: Date | null;
  t_verification: VerificationLevel | null;
  source_kind: string | null;
  source_title: string | null;
  source_url: string | null;
  source_document_date: string | null;
};

/**
 * Pencarian faskes (M1): trigram untuk `q` (nama faskes, nama dan alias layanan),
 * `ST_DWithin` untuk radius, filter kota/jenis/layanan. Hanya faskes `terbit`.
 * Urutan tidak pernah memakai data pembayaran (prinsip 1).
 */
export async function searchFacilities(db: DbOrTx, p: FacilitySearchParams): Promise<FacilitySearchRow[]> {
  const point = p.lat !== undefined && p.lng !== undefined ? sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography` : null;
  const where: SQL[] = [sql`f.status = 'terbit'`];

  if (p.q) {
    where.push(sql`(
      f.name % ${p.q} OR ${p.q} <% f.name
      OR EXISTS (
        SELECT 1 FROM published_tariffs qt JOIN services qs ON qs.id = qt.service_id
        WHERE qt.facility_id = f.id AND (
          qs.name % ${p.q} OR ${p.q} <% qs.name
          OR EXISTS (SELECT 1 FROM unnest(qs.aliases) a WHERE a % ${p.q} OR ${p.q} <% a)
        )
      )
    )`);
  }
  if (p.city) where.push(cityCondition(p.city));
  if (p.type) where.push(sql`f.type = ${p.type}`);
  if (p.serviceId) where.push(sql`pt.tariff_id IS NOT NULL`);
  if (point && p.radius) where.push(sql`ST_DWithin(f.location, ${point}, ${p.radius})`);

  const score = p.q
    ? sql`GREATEST(similarity(f.name, ${p.q}), word_similarity(${p.q}, f.name), coalesce((
        SELECT max(GREATEST(similarity(qs.name, ${p.q}), word_similarity(${p.q}, qs.name)))
        FROM published_tariffs qt JOIN services qs ON qs.id = qt.service_id WHERE qt.facility_id = f.id
      ), 0) * 0.8)`
    : sql`0`;
  const distance = point ? sql`ST_Distance(f.location, ${point})` : sql`NULL::float8`;

  const priceKey = sql`CASE WHEN pt.price_type = 'tanya' OR pt.price_min IS NULL THEN NULL ELSE pt.price_min END`;
  let orderBy: SQL;
  switch (p.sort) {
    case 'distance':
      orderBy = sql`distance_m ASC NULLS LAST, f.name ASC`;
      break;
    case 'price_asc':
      orderBy = sql`${priceKey} ASC NULLS LAST, f.name ASC`;
      break;
    case 'price_desc':
      orderBy = sql`${priceKey} DESC NULLS LAST, f.name ASC`;
      break;
    case 'name':
      orderBy = sql`f.name ASC`;
      break;
    default:
      orderBy = p.q
        ? sql`score DESC, f.name ASC`
        : point
          ? sql`distance_m ASC NULLS LAST, f.name ASC`
          : sql`f.name ASC`;
  }

  // Tarif layanan yang diminta: ambil yang termurah per faskes untuk kartu hasil.
  const priceJoin = p.serviceId
    ? sql`LEFT JOIN LATERAL (
        SELECT x.* FROM published_tariffs x
        WHERE x.facility_id = f.id AND x.service_id = ${p.serviceId}
        ORDER BY (x.price_type = 'tanya'), x.price_min ASC NULLS LAST
        LIMIT 1
      ) pt ON true
      LEFT JOIN data_sources ds ON ds.id = pt.source_id`
    : sql`LEFT JOIN LATERAL (SELECT NULL::uuid AS tariff_id, NULL::price_type AS price_type, NULL::bigint AS price_min,
        NULL::bigint AS price_max, NULL::date AS effective_from, NULL::date AS effective_to, NULL::timestamptz AS verified_at,
        NULL::verification_level AS verification, NULL::uuid AS source_id) pt ON true
      LEFT JOIN data_sources ds ON false`;

  const result = await db.execute<FacilitySearchRow>(sql`
    SELECT f.id, f.slug, f.name, f.type, f.address, f.city, f.verification,
      ST_Y(f.location::geometry) AS lat, ST_X(f.location::geometry) AS lng,
      ${distance} AS distance_m,
      ${score} AS score,
      pt.tariff_id, pt.price_type, pt.price_min, pt.price_max, pt.effective_from, pt.effective_to,
      pt.verified_at, pt.verification AS t_verification,
      ds.kind AS source_kind, ds.title AS source_title, ds.url AS source_url, ds.document_date AS source_document_date
    FROM facilities f
    LEFT JOIN regions r ON r.id = f.region_id
    ${priceJoin}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${orderBy}
    LIMIT ${p.limit + 1} OFFSET ${p.offset}
  `);
  return result.rows;
}

export async function findPublishedFacilityBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({
      id: facilities.id,
      slug: facilities.slug,
      name: facilities.name,
      type: facilities.type,
      description: facilities.description,
      address: facilities.address,
      city: facilities.city,
      province: facilities.province,
      phone: facilities.phone,
      website: facilities.website,
      hours: facilities.hours,
      verification: facilities.verification,
      updatedAt: facilities.updatedAt,
      lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
      lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
      regionCode: regions.code,
      regionName: regions.name,
      regionType: regions.type,
    })
    .from(facilities)
    .leftJoin(regions, eq(regions.id, facilities.regionId))
    .where(and(eq(facilities.slug, slug), eq(facilities.status, 'terbit')));
  return row ?? null;
}

export function practitionersForFacility(db: DbOrTx, facilityId: string) {
  return db
    .select({ slug: practitioners.slug, name: practitioners.name, specialty: practitioners.specialty })
    .from(facilityPractitioners)
    .innerJoin(practitioners, eq(practitioners.id, facilityPractitioners.practitionerId))
    .where(and(eq(facilityPractitioners.facilityId, facilityId), eq(practitioners.status, 'terbit')))
    .orderBy(asc(practitioners.name));
}

export async function findPublishedPractitioner(db: DbOrTx, slug: string) {
  const [row] = await db
    .select()
    .from(practitioners)
    .where(and(eq(practitioners.slug, slug), eq(practitioners.status, 'terbit')));
  return row ?? null;
}

export function facilitiesForPractitioner(db: DbOrTx, practitionerId: string) {
  return db
    .select({ slug: facilities.slug, name: facilities.name, city: facilities.city })
    .from(facilityPractitioners)
    .innerJoin(facilities, eq(facilities.id, facilityPractitioners.facilityId))
    .where(and(eq(facilityPractitioners.practitionerId, practitionerId), eq(facilities.status, 'terbit')))
    .orderBy(asc(facilities.name));
}

/** URL sitemap: hanya entitas `terbit` (M12, aturan SEO 4). */
export async function sitemapEntries(db: DbOrTx) {
  const [facilityRows, practitionerRows, serviceRows] = await Promise.all([
    db
      .select({ slug: facilities.slug, updatedAt: facilities.updatedAt })
      .from(facilities)
      .where(eq(facilities.status, 'terbit'))
      .orderBy(asc(facilities.slug)),
    db.execute<{ slug: string }>(sql`
      SELECT DISTINCT p.slug FROM practitioners p
      JOIN facility_practitioners fp ON fp.practitioner_id = p.id
      JOIN facilities f ON f.id = fp.facility_id AND f.status = 'terbit'
      WHERE p.status = 'terbit' ORDER BY p.slug
    `),
    db.execute<{ slug: string; has_tariffs: boolean; last_verified: Date | null }>(sql`
      SELECT s.slug, count(pt.tariff_id) > 0 AS has_tariffs, max(pt.verified_at) AS last_verified
      FROM services s LEFT JOIN published_tariffs pt ON pt.service_id = s.id
      GROUP BY s.slug ORDER BY s.slug
    `),
  ]);
  return { facilityRows, practitionerRows: practitionerRows.rows, serviceRows: serviceRows.rows };
}
