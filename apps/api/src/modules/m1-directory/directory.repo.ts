import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import {
  facilities,
  facilityPractitioners,
  regions,
  serviceCategories,
  type DbOrTx,
} from '@silk/db';
import type { FacilitySortOption, FacilityType, PractitionerSortOption, PriceType, ScheduleKind, VerificationLevel } from '@silk/shared';
import { CONSULTATION_CATEGORY } from '@silk/shared';
import { cityCondition, likeEscape } from '../../lib/sql';
import { consentAllowsPublic } from '../profiles/media.repo';

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

/** Dokter yang berpraktik di faskes ini, dengan foto profil praktik utamanya (Fase 4b). */
export async function practitionersForFacility(db: DbOrTx, facilityId: string) {
  const r = await db.execute<{ slug: string; name: string; specialty: string | null; photoUrl: string | null }>(sql`
    SELECT p.slug, p.name, p.specialty,
      (SELECT pm.public_url FROM profile_media pm
        WHERE pm.facility_id = pp.id AND pm.kind = 'foto' AND pm.status = 'approved' AND pm.public_url IS NOT NULL
        ORDER BY pm.sort_order ASC, pm.created_at ASC LIMIT 1) AS "photoUrl"
    FROM facility_practitioners fx JOIN practitioners p ON p.id = fx.practitioner_id
    ${PRIMARY_PRACTICE}
    WHERE fx.facility_id = ${facilityId} AND p.status = 'terbit'
    ORDER BY p.name ASC, p.slug ASC
  `);
  return r.rows;
}

/* ---------- Dokter (Fase 4b) ---------- */

/**
 * Satu-satunya definisi "dokter tampil publik": praktisi `terbit` yang tertaut ke minimal satu
 * faskes `terbit`. Dipakai detail, daftar, spesialisasi, sitemap, dan tautan penulis artikel.
 */
export function publicPractitionerCondition(alias = 'p'): SQL {
  const p = sql.raw(alias);
  return sql`(${p}.status = 'terbit' AND EXISTS (
    SELECT 1 FROM facility_practitioners pub_fp JOIN facilities pub_f ON pub_f.id = pub_fp.facility_id
    WHERE pub_fp.practitioner_id = ${p}.id AND pub_f.status = 'terbit'))`;
}
const PUBLIC_PRACTITIONER = publicPractitionerCondition('p');

/** Akun mitra tenaga medis milik praktisi `p` mengelola faskes `f` (profil yang dibuat dokter sendiri). */
const OWN_PRACTICE = sql`EXISTS (
  SELECT 1 FROM partners own_pa JOIN memberships own_m ON own_m.user_id = own_pa.user_id
  WHERE own_pa.practitioner_id = p.id AND own_m.facility_id = f.id)`;

/**
 * Profil praktik utama (D2): profil milik dokter sendiri, lalu faskes `praktik_dokter`; selain itu tidak ada.
 * Menghasilkan kolom `id` (alias lateral `pp`).
 */
const PRIMARY_PRACTICE = sql`LEFT JOIN LATERAL (
    SELECT f.id FROM facility_practitioners fp JOIN facilities f ON f.id = fp.facility_id AND f.status = 'terbit'
    WHERE fp.practitioner_id = p.id AND (${OWN_PRACTICE} OR f.type = 'praktik_dokter')
    ORDER BY ${OWN_PRACTICE} DESC, f.name ASC, f.id ASC
    LIMIT 1
  ) pp ON true`;

const PARTNER_VERIFIED = sql`EXISTS (SELECT 1 FROM partners pv WHERE pv.practitioner_id = p.id AND pv.status = 'verified')`;

export type PublishedPractitionerRow = {
  id: string;
  slug: string;
  name: string;
  specialty: string | null;
  str_no: string | null;
  str_verified_at: Date | null;
  partner_verified: boolean;
  primary_id: string | null;
};

export async function findPublishedPractitioner(db: DbOrTx, slug: string): Promise<PublishedPractitionerRow | null> {
  const r = await db.execute<PublishedPractitionerRow>(sql`
    SELECT p.id, p.slug, p.name, p.specialty, p.str_no, p.str_verified_at,
      ${PARTNER_VERIFIED} AS partner_verified, pp.id AS primary_id
    FROM practitioners p ${PRIMARY_PRACTICE}
    WHERE p.slug = ${slug} AND ${PUBLIC_PRACTITIONER}
  `);
  const row = r.rows[0];
  return row ? { ...row, str_verified_at: row.str_verified_at ? new Date(row.str_verified_at) : null } : null;
}

export type PracticeRow = {
  id: string;
  slug: string;
  name: string;
  type: FacilityType;
  city: string;
  address: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

/** Tempat praktik terbit; urutan nama (profil utama diletakkan di depan oleh service). */
export async function practicesOf(db: DbOrTx, practitionerId: string): Promise<PracticeRow[]> {
  const r = await db.execute<PracticeRow>(sql`
    SELECT f.id, f.slug, f.name, f.type, f.city, f.address, f.description, f.phone, f.website,
      ST_Y(f.location::geometry) AS lat, ST_X(f.location::geometry) AS lng
    FROM facility_practitioners fp JOIN facilities f ON f.id = fp.facility_id
    WHERE fp.practitioner_id = ${practitionerId} AND f.status = 'terbit'
    ORDER BY f.name ASC, f.id ASC
  `);
  return r.rows;
}

export type PracticeLocationRow = {
  facility_id: string;
  label: string | null;
  address: string;
  city: string;
  lat: number;
  lng: number;
  is_primary: boolean;
};

export async function locationsOfFacilities(db: DbOrTx, facilityIds: string[]): Promise<PracticeLocationRow[]> {
  if (facilityIds.length === 0) return [];
  const ids = sql.join(facilityIds.map((id) => sql`${id}::uuid`), sql`, `);
  const r = await db.execute<PracticeLocationRow>(sql`
    SELECT pl.facility_id, pl.label, pl.address, pl.city,
      ST_Y(pl.location::geometry) AS lat, ST_X(pl.location::geometry) AS lng, pl.is_primary
    FROM profile_locations pl
    WHERE pl.facility_id IN (${ids})
    ORDER BY pl.is_primary DESC, pl.sort_order ASC, pl.created_at ASC
  `);
  return r.rows;
}

export type PracticeScheduleRow = {
  facility_id: string;
  kind: ScheduleKind;
  weekday: number;
  start: string;
  end: string;
  timezone: string;
  note: string | null;
};

/**
 * Jadwal dokter: di profil utama semua jadwal umum dan jadwal dokter ini; di faskes lain hanya jadwal
 * yang memuat dokter ini. Jadwal dokter lain tidak pernah ikut.
 */
export async function schedulesOfPractitioner(
  db: DbOrTx,
  practitionerId: string,
  primaryId: string | null,
): Promise<PracticeScheduleRow[]> {
  const r = await db.execute<PracticeScheduleRow>(sql`
    SELECT s.facility_id, s.kind, s.weekday, to_char(s.start_time, 'HH24:MI') AS start, to_char(s.end_time, 'HH24:MI') AS "end",
      s.timezone, s.note
    FROM schedules s JOIN facilities f ON f.id = s.facility_id AND f.status = 'terbit'
    JOIN facility_practitioners fp ON fp.facility_id = f.id AND fp.practitioner_id = ${practitionerId}
    WHERE s.practitioner_id = ${practitionerId}
      ${primaryId ? sql`OR (s.facility_id = ${primaryId} AND s.practitioner_id IS NULL)` : sql``}
    ORDER BY s.kind ASC, s.weekday ASC, s.start_time ASC
  `);
  return r.rows;
}

export interface PractitionerSearchParams {
  q?: string;
  specialty?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: PractitionerSortOption;
  /** Hanya dokter dengan video perkenalan yang boleh tampil publik. */
  video?: boolean;
  /** Hanya dokter dengan biaya konsultasi berangka (bukan "tanya"). */
  fee?: boolean;
  limit: number;
  offset: number;
}

export type PractitionerSearchRow = {
  slug: string;
  name: string;
  specialty: string | null;
  str_verified: boolean;
  partner_verified: boolean;
  photo_url: string | null;
  cities: string[] | null;
  practices: { slug: string; name: string }[] | null;
  practice_count: number;
  distance_m: number | null;
  has_video: boolean;
  has_schedule: boolean;
  consultation: ConsultationJson | null;
  score: number;
};

/** Tarif konsultasi profil praktik utama dalam bentuk JSON (tanggal sebagai teks). */
export type ConsultationJson = {
  service_name: string;
  price_type: PriceType;
  price_min: number | null;
  price_max: number | null;
  effective_from: string;
  effective_to: string | null;
  verified_at: string | null;
  verification: VerificationLevel;
  source_kind: string | null;
  source_title: string | null;
  source_url: string | null;
  source_document_date: string | null;
};

/**
 * Biaya konsultasi (evaluasi USP R3): tarif terbit kategori konsultasi di profil praktik utama `pp`.
 * Membaca VIEW published_tariffs (satu-satunya definisi tarif terbit). Tarif berangka didahulukan.
 */
const CONSULTATION_JSON = sql`(SELECT json_build_object(
    'service_name', cs.name, 'price_type', ct.price_type, 'price_min', ct.price_min, 'price_max', ct.price_max,
    'effective_from', ct.effective_from, 'effective_to', ct.effective_to, 'verified_at', ct.verified_at,
    'verification', ct.verification, 'source_kind', cd.kind, 'source_title', cd.title, 'source_url', cd.url,
    'source_document_date', cd.document_date)
  FROM published_tariffs ct
  JOIN services cs ON cs.id = ct.service_id
  JOIN service_categories cc ON cc.id = cs.category_id AND cc.slug = ${CONSULTATION_CATEGORY}
  LEFT JOIN data_sources cd ON cd.id = ct.source_id
  WHERE ct.facility_id = pp.id
  ORDER BY (ct.price_type = 'tanya') ASC, cs.name ASC, ct.tariff_id ASC
  LIMIT 1)`;

/** Batas bawah biaya konsultasi berangka di profil praktik utama (untuk filter `fee` dan urutan `fee_asc`). */
const CONSULTATION_FEE_MIN = sql`(SELECT min(ct.price_min)
  FROM published_tariffs ct
  JOIN services cs ON cs.id = ct.service_id
  JOIN service_categories cc ON cc.id = cs.category_id AND cc.slug = ${CONSULTATION_CATEGORY}
  WHERE ct.facility_id = pp.id AND ct.price_type <> 'tanya' AND ct.price_min IS NOT NULL)`;

/** Video perkenalan profil utama yang boleh tampil publik (disetujui dan persetujuan aktif, evaluasi R6). */
const HAS_PUBLIC_VIDEO = sql`EXISTS (SELECT 1 FROM profile_media pm
  WHERE pm.facility_id = pp.id AND pm.kind = 'video' AND pm.status = 'approved' AND pm.public_url IS NOT NULL
    AND ${consentAllowsPublic(sql`pm.id`, sql`pm.kind`)})`;

/**
 * Daftar dan pencarian dokter (F-03, Fase 4b). Lokasi dokter = lokasi semua tempat praktiknya yang terbit.
 * Urutan: relevansi (ada `q`), jarak (ada titik), atau nama; pemecah seri `slug`.
 * Urutan TIDAK PERNAH memakai data pembayaran atau langganan (prinsip 1; diuji regresi).
 */
export async function searchPractitioners(db: DbOrTx, p: PractitionerSearchParams): Promise<PractitionerSearchRow[]> {
  const point = p.lat !== undefined && p.lng !== undefined ? sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography` : null;
  // Faskes terbit tempat dokter `p` berpraktik (alias `pf`).
  const practiceIds = sql`SELECT pf_fp.facility_id FROM facility_practitioners pf_fp
    JOIN facilities pf ON pf.id = pf_fp.facility_id AND pf.status = 'terbit' WHERE pf_fp.practitioner_id = p.id`;
  const where: SQL[] = [PUBLIC_PRACTITIONER];
  if (p.q) {
    const pattern = `%${likeEscape(p.q)}%`;
    where.push(sql`(p.name ILIKE ${pattern} OR p.specialty ILIKE ${pattern} OR p.name % ${p.q} OR ${p.q} <% p.name
      OR ${p.q} <% coalesce(p.specialty, ''))`);
  }
  if (p.specialty) where.push(sql`lower(btrim(p.specialty)) = lower(btrim(${p.specialty}))`);
  if (p.video) where.push(HAS_PUBLIC_VIDEO);
  if (p.fee) where.push(sql`${CONSULTATION_FEE_MIN} IS NOT NULL`);
  if (p.city) {
    where.push(sql`(EXISTS (
        SELECT 1 FROM facilities f LEFT JOIN regions r ON r.id = f.region_id
        WHERE f.id IN (${practiceIds}) AND ${cityCondition(p.city)}
      ) OR EXISTS (
        SELECT 1 FROM profile_locations pl LEFT JOIN regions pr ON pr.id = pl.region_id
        WHERE pl.facility_id IN (${practiceIds}) AND ${cityCondition(p.city, 'pl', 'pr')}
      ))`);
  }
  if (point && p.radius) {
    where.push(sql`(EXISTS (
        SELECT 1 FROM profile_locations pl WHERE pl.facility_id IN (${practiceIds}) AND ST_DWithin(pl.location, ${point}, ${p.radius})
      ) OR EXISTS (
        SELECT 1 FROM facilities fr WHERE fr.id IN (${practiceIds}) AND ST_DWithin(fr.location, ${point}, ${p.radius})
      ))`);
  }
  const score = p.q
    ? sql`GREATEST(similarity(p.name, ${p.q}), word_similarity(${p.q}, p.name),
        similarity(coalesce(p.specialty, ''), ${p.q}), word_similarity(${p.q}, coalesce(p.specialty, '')))`
    : sql`0`;
  const distance = point
    ? sql`(SELECT min(d) FROM (
        SELECT ST_Distance(pl.location, ${point}) AS d FROM profile_locations pl WHERE pl.facility_id IN (${practiceIds})
        UNION ALL
        SELECT ST_Distance(fd.location, ${point}) FROM facilities fd WHERE fd.id IN (${practiceIds}) AND fd.location IS NOT NULL
      ) dist)`
    : sql`NULL::float8`;
  const byName = sql`p.name ASC, p.slug ASC`;
  let orderBy: SQL;
  if (p.sort === 'name') orderBy = byName;
  else if (p.sort === 'distance') orderBy = sql`distance_m ASC NULLS LAST, ${byName}`;
  // Biaya tidak tercantum selalu di akhir; seri dipecah nama (urutan netral, prinsip 1).
  else if (p.sort === 'fee_asc') orderBy = sql`fee_min ASC NULLS LAST, ${byName}`;
  else if (p.q) orderBy = point ? sql`score DESC, distance_m ASC NULLS LAST, ${byName}` : sql`score DESC, ${byName}`;
  else orderBy = point ? sql`distance_m ASC NULLS LAST, ${byName}` : byName;

  const r = await db.execute<PractitionerSearchRow>(sql`
    SELECT p.slug, p.name, p.specialty, p.str_verified_at IS NOT NULL AS str_verified,
      ${PARTNER_VERIFIED} AS partner_verified,
      (SELECT pm.public_url FROM profile_media pm
        WHERE pm.facility_id = pp.id AND pm.kind = 'foto' AND pm.status = 'approved' AND pm.public_url IS NOT NULL
        ORDER BY pm.sort_order ASC, pm.created_at ASC LIMIT 1) AS photo_url,
      ${HAS_PUBLIC_VIDEO} AS has_video,
      EXISTS (SELECT 1 FROM schedules s WHERE s.facility_id IN (${practiceIds})
        AND (s.practitioner_id = p.id OR (s.facility_id = pp.id AND s.practitioner_id IS NULL))) AS has_schedule,
      (SELECT array_agg(c.city ORDER BY c.city) FROM (
        SELECT DISTINCT cf.city FROM facilities cf WHERE cf.id IN (${practiceIds})
        UNION
        SELECT DISTINCT cl.city FROM profile_locations cl WHERE cl.facility_id IN (${practiceIds})
        ORDER BY 1 LIMIT 3
      ) c) AS cities,
      (SELECT json_agg(json_build_object('slug', x.slug, 'name', x.name)) FROM (
        SELECT xf.slug, xf.name FROM facilities xf WHERE xf.id IN (${practiceIds})
        ORDER BY (xf.id = pp.id) DESC NULLS LAST, xf.name ASC, xf.id ASC LIMIT 2
      ) x) AS practices,
      (SELECT count(*)::int FROM (${practiceIds}) n) AS practice_count,
      ${CONSULTATION_JSON} AS consultation,
      ${CONSULTATION_FEE_MIN} AS fee_min,
      ${distance} AS distance_m,
      ${score} AS score
    FROM practitioners p ${PRIMARY_PRACTICE}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${orderBy}
    LIMIT ${p.limit + 1} OFFSET ${p.offset}
  `);
  return r.rows;
}

/** Spesialisasi dokter yang tampil, digabung tanpa membedakan huruf besar/kecil. */
export async function practitionerSpecialties(db: DbOrTx): Promise<{ name: string; count: number }[]> {
  const r = await db.execute<{ name: string; count: number }>(sql`
    SELECT min(btrim(p.specialty)) AS name, count(*)::int AS count
    FROM practitioners p
    WHERE ${PUBLIC_PRACTITIONER} AND p.specialty IS NOT NULL AND btrim(p.specialty) <> ''
    GROUP BY lower(btrim(p.specialty))
    ORDER BY lower(min(btrim(p.specialty))) ASC
  `);
  return r.rows;
}

/** Slug dokter yang berpraktik di faskes ini (revalidate halaman dokter saat data faskes berubah). */
export async function practitionerSlugsOfFacility(db: DbOrTx, facilityId: string): Promise<string[]> {
  const r = await db.execute<{ slug: string }>(sql`
    SELECT p.slug FROM facility_practitioners fp JOIN practitioners p ON p.id = fp.practitioner_id
    WHERE fp.facility_id = ${facilityId}
  `);
  return r.rows.map((x) => x.slug);
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
    db.execute<{ slug: string }>(sql`SELECT p.slug FROM practitioners p WHERE ${PUBLIC_PRACTITIONER} ORDER BY p.slug`),
    db.execute<{ slug: string; has_tariffs: boolean; last_verified: Date | null }>(sql`
      SELECT s.slug, count(pt.tariff_id) > 0 AS has_tariffs, max(pt.verified_at) AS last_verified
      FROM services s LEFT JOIN published_tariffs pt ON pt.service_id = s.id
      GROUP BY s.slug ORDER BY s.slug
    `),
  ]);
  return { facilityRows, practitionerRows: practitionerRows.rows, serviceRows: serviceRows.rows };
}
