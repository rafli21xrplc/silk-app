import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import {
  facilities,
  facilityPractitioners,
  practitioners,
  regions,
  serviceCategories,
  type DbOrTx,
} from '@silk/db';
import type { FacilitySortOption, FacilityType, PriceType, VerificationLevel } from '@silk/shared';
import { cityCondition } from '../../lib/sql';

export interface FacilitySearchParams {
  q?: string;
  city?: string;
  type?: FacilityType;
  serviceId?: string;
  /** Fase 3: kategori layanan (id), faskes dengan tarif terbit di kategori itu. */
  categoryId?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  /** Fase 3: rentang biaya (rupiah); hanya bersama serviceId atau categoryId. */
  priceMin?: number;
  priceMax?: number;
  /** Fase 3/6: hanya bila flag reviews_enabled menyala (diperiksa service). */
  ratings?: { enabled: true; minRating?: number; minCount: number };
  sort?: FacilitySortOption;
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
  nl_label: string | null;
  nl_address: string | null;
  nl_city: string | null;
  nl_primary: boolean | null;
  score: number;
  tariff_count: number;
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
  rating_avg: string | number | null;
  rating_count: number | null;
};

const hasPriceRange = (p: FacilitySearchParams) => p.priceMin !== undefined || p.priceMax !== undefined;

/** Tarif di lingkup layanan/kategori yang dicari (alias `x` untuk published_tariffs). */
function tariffScope(p: FacilitySearchParams): SQL | null {
  if (p.serviceId) return sql`x.service_id = ${p.serviceId}`;
  if (p.categoryId !== undefined) return sql`x.service_id IN (SELECT sc.id FROM services sc WHERE sc.category_id = ${p.categoryId})`;
  return null;
}

/**
 * Tarif beririsan dengan rentang biaya (sama dengan `priceMatchesRange` di shared):
 * tetap/paket/rentang = [min, max ?? min], mulai_dari = [min, ∞), `tanya` tidak pernah cocok.
 */
function priceRangeCondition(p: FacilitySearchParams): SQL {
  const parts: SQL[] = [sql`x.price_type <> 'tanya'`, sql`x.price_min IS NOT NULL`];
  if (p.priceMax !== undefined) parts.push(sql`x.price_min <= ${p.priceMax}`);
  if (p.priceMin !== undefined) parts.push(sql`(x.price_type = 'mulai_dari' OR coalesce(x.price_max, x.price_min) >= ${p.priceMin})`);
  return sql.join(parts, sql` AND `);
}

const searchPoint = (p: FacilitySearchParams) =>
  p.lat !== undefined && p.lng !== undefined ? sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography` : null;

/**
 * Kondisi WHERE selain filter biaya. Lokasi (radius, kota) mencakup semua lokasi profil (Fase 2, K6),
 * dengan kolom faskes sebagai cadangan untuk data lama.
 */
function baseConditions(p: FacilitySearchParams): SQL[] {
  const point = searchPoint(p);
  const where: SQL[] = [sql`f.status = 'terbit'`];
  if (p.q) {
    // UNION agar tiap cabang bisa memakai indeks trigram (OR dengan EXISTS memaksa seq scan).
    where.push(sql`f.id IN (
      SELECT fq.id FROM facilities fq WHERE fq.name % ${p.q} OR ${p.q} <% fq.name
      UNION
      SELECT qt.facility_id FROM published_tariffs qt
      WHERE qt.service_id IN (
        SELECT qs.id FROM services qs WHERE qs.name % ${p.q} OR ${p.q} <% qs.name
        UNION
        SELECT qs.id FROM services qs WHERE EXISTS (SELECT 1 FROM unnest(qs.aliases) a WHERE a % ${p.q} OR ${p.q} <% a)
      )
    )`);
  }
  if (p.city) {
    where.push(sql`(${cityCondition(p.city)} OR EXISTS (
      SELECT 1 FROM profile_locations pl LEFT JOIN regions pr ON pr.id = pl.region_id
      WHERE pl.facility_id = f.id AND ${cityCondition(p.city, 'pl', 'pr')}
    ))`);
  }
  if (p.type) where.push(sql`f.type = ${p.type}`);
  if (point && p.radius) {
    // Semua lokasi profil (indeks GiST), plus kolom faskes untuk data tanpa baris lokasi.
    where.push(sql`f.id IN (
      SELECT pl.facility_id FROM profile_locations pl WHERE ST_DWithin(pl.location, ${point}, ${p.radius})
      UNION
      SELECT fr2.id FROM facilities fr2 WHERE ST_DWithin(fr2.location, ${point}, ${p.radius})
    )`);
  }
  const scope = tariffScope(p);
  // Layanan/kategori: faskes yang menawarkannya lewat tarif terbit (termasuk `tanya`).
  if (scope) where.push(sql`EXISTS (SELECT 1 FROM published_tariffs x WHERE x.facility_id = f.id AND ${scope})`);
  if (p.ratings?.minRating !== undefined) where.push(sql`fr.rating_avg >= ${p.ratings.minRating}`);
  return where;
}

/**
 * Pencarian faskes (M1, F-03): trigram untuk `q`, jarak ke lokasi profil terdekat, filter kota/jenis/
 * layanan/kategori/biaya/rating. Hanya faskes `terbit`.
 *
 * Urutan bawaan = relevansi lalu jarak (atau jarak saja, atau nama). Harga dan rating hanya dipakai bila
 * pengguna memilih urutannya; yang belum punya angka/rating menjadi kelompok terpisah sesudahnya dengan
 * urutan bawaan. Urutan TIDAK PERNAH memakai data pembayaran atau langganan (prinsip 1; diuji regresi).
 */
export async function searchFacilities(db: DbOrTx, p: FacilitySearchParams): Promise<FacilitySearchRow[]> {
  const result = await db.execute<FacilitySearchRow>(buildSearchQuery(p));
  return result.rows;
}

/** Query pencarian lengkap; dipisah agar uji bisa memeriksa rencana eksekusinya (EXPLAIN). */
export function buildSearchQuery(p: FacilitySearchParams): SQL {
  const point = searchPoint(p);
  const where = baseConditions(p);
  const scope = tariffScope(p);
  if (scope && hasPriceRange(p)) {
    where.push(sql`EXISTS (SELECT 1 FROM published_tariffs x WHERE x.facility_id = f.id AND ${scope} AND ${priceRangeCondition(p)})`);
  }

  const score = p.q
    ? sql`GREATEST(similarity(f.name, ${p.q}), word_similarity(${p.q}, f.name), coalesce((
        SELECT max(GREATEST(similarity(qs.name, ${p.q}), word_similarity(${p.q}, qs.name)))
        FROM published_tariffs qt JOIN services qs ON qs.id = qt.service_id WHERE qt.facility_id = f.id
      ), 0) * 0.8)`
    : sql`0`;
  const distance = point ? sql`coalesce(nl.distance_m, ST_Distance(f.location, ${point}))` : sql`NULL::float8`;

  const defaultOrder = p.q
    ? point
      ? sql`score DESC, distance_m ASC NULLS LAST, f.name ASC, f.id ASC`
      : sql`score DESC, f.name ASC, f.id ASC`
    : point
      ? sql`distance_m ASC NULLS LAST, f.name ASC, f.id ASC`
      : sql`f.name ASC, f.id ASC`;
  const priceKey = sql`CASE WHEN pt.price_type = 'tanya' OR pt.price_min IS NULL THEN NULL ELSE pt.price_min END`;
  let orderBy: SQL;
  switch (p.sort) {
    case 'distance':
      orderBy = sql`distance_m ASC NULLS LAST, f.name ASC, f.id ASC`;
      break;
    case 'price_asc':
      orderBy = sql`(${priceKey} IS NULL) ASC, ${priceKey} ASC, ${defaultOrder}`;
      break;
    case 'price_desc':
      orderBy = sql`(${priceKey} IS NULL) ASC, ${priceKey} DESC, ${defaultOrder}`;
      break;
    case 'rating':
      orderBy = p.ratings ? sql`(fr.rating_avg IS NULL) ASC, fr.rating_avg DESC, fr.rating_count DESC, ${defaultOrder}` : defaultOrder;
      break;
    case 'name':
      orderBy = sql`f.name ASC, f.id ASC`;
      break;
    default:
      orderBy = defaultOrder;
  }

  // Tarif layanan yang diminta: harga terendah per faskes (dalam rentang biaya bila difilter) untuk kartu.
  const priceJoin = p.serviceId
    ? sql`LEFT JOIN LATERAL (
        SELECT x.* FROM published_tariffs x
        WHERE x.facility_id = f.id AND x.service_id = ${p.serviceId}
          ${hasPriceRange(p) ? sql`AND ${priceRangeCondition(p)}` : sql``}
        ORDER BY (x.price_type = 'tanya'), x.price_min ASC NULLS LAST, x.tariff_id
        LIMIT 1
      ) pt ON true
      LEFT JOIN data_sources ds ON ds.id = pt.source_id`
    : sql`LEFT JOIN LATERAL (SELECT NULL::uuid AS tariff_id, NULL::price_type AS price_type, NULL::bigint AS price_min,
        NULL::bigint AS price_max, NULL::date AS effective_from, NULL::date AS effective_to, NULL::timestamptz AS verified_at,
        NULL::verification_level AS verification, NULL::uuid AS source_id) pt ON true
      LEFT JOIN data_sources ds ON false`;
  const nearestJoin = point
    ? sql`LEFT JOIN LATERAL (
        SELECT pl.label, pl.address, pl.city, pl.is_primary, ST_Distance(pl.location, ${point}) AS distance_m
        FROM profile_locations pl WHERE pl.facility_id = f.id
        ORDER BY ST_Distance(pl.location, ${point}) ASC, pl.is_primary DESC
        LIMIT 1
      ) nl ON true`
    : sql`LEFT JOIN LATERAL (SELECT NULL::text AS label, NULL::text AS address, NULL::text AS city, NULL::boolean AS is_primary,
        NULL::float8 AS distance_m) nl ON true`;
  const ratingJoin = p.ratings
    ? sql`LEFT JOIN facility_ratings fr ON fr.facility_id = f.id AND fr.rating_count >= ${p.ratings.minCount}`
    : sql`LEFT JOIN LATERAL (SELECT NULL::numeric AS rating_avg, NULL::int AS rating_count) fr ON true`;

  return sql`
    SELECT f.id, f.slug, f.name, f.type, f.address, f.city, f.verification,
      ST_Y(f.location::geometry) AS lat, ST_X(f.location::geometry) AS lng,
      ${distance} AS distance_m,
      nl.label AS nl_label, nl.address AS nl_address, nl.city AS nl_city, nl.is_primary AS nl_primary,
      ${score} AS score,
      (SELECT count(*)::int FROM published_tariffs c WHERE c.facility_id = f.id) AS tariff_count,
      pt.tariff_id, pt.price_type, pt.price_min, pt.price_max, pt.effective_from, pt.effective_to,
      pt.verified_at, pt.verification AS t_verification,
      ds.kind AS source_kind, ds.title AS source_title, ds.url AS source_url, ds.document_date AS source_document_date,
      fr.rating_avg, fr.rating_count
    FROM facilities f
    LEFT JOIN regions r ON r.id = f.region_id
    ${nearestJoin}
    ${priceJoin}
    ${ratingJoin}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${orderBy}
    LIMIT ${p.limit + 1} OFFSET ${p.offset}
  `;
}

/**
 * Faskes yang cocok dengan semua filter kecuali biaya, menawarkan layanan/kategori itu, tetapi belum
 * punya angka harga di lingkup itu (hanya `tanya`). Ditampilkan sebagai tautan saat filter biaya aktif.
 */
export async function countUnpriced(db: DbOrTx, p: FacilitySearchParams): Promise<number> {
  const scope = tariffScope(p);
  if (!scope) return 0;
  const ratingJoin = p.ratings
    ? sql`LEFT JOIN facility_ratings fr ON fr.facility_id = f.id AND fr.rating_count >= ${p.ratings.minCount}`
    : sql``;
  const result = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
    FROM facilities f
    LEFT JOIN regions r ON r.id = f.region_id
    ${ratingJoin}
    WHERE ${sql.join(baseConditions(p), sql` AND `)}
      AND NOT EXISTS (
        SELECT 1 FROM published_tariffs x
        WHERE x.facility_id = f.id AND ${scope} AND x.price_type <> 'tanya' AND x.price_min IS NOT NULL
      )
  `);
  return result.rows[0]?.n ?? 0;
}

export async function findCategoryIdBySlug(db: DbOrTx, slug: string): Promise<number | null> {
  const [row] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.slug, slug));
  return row?.id ?? null;
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
