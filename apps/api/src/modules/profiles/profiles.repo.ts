import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { searchAny } from '../../lib/sql';
import {
  facilities,
  facilityPractitioners,
  memberships,
  partners,
  practitioners,
  profileLocations,
  profileRevisions,
  schedules,
  user,
  type DbOrTx,
} from '@silk/db';
import {
  CONSULTATION_CATEGORY,
  type ConsultationReadiness,
  type EntityStatus,
  type FacilityType,
  type LocationInput,
  type MediaReadiness,
  type ReadinessFacts,
  type ReviewStatus,
  type ScheduleInput,
  type VideoReadiness,
} from '@silk/shared';
import { consentAllowsPublic } from './media.repo';

/* ---------- Mitra ---------- */

export async function partnerOfUser(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({
      id: partners.id,
      partnerType: partners.partnerType,
      facilityKind: partners.facilityKind,
      status: partners.status,
      businessName: partners.businessName,
      specialty: partners.specialty,
      strNo: partners.strNo,
      practitionerId: partners.practitionerId,
    })
    .from(partners)
    .where(eq(partners.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function lockPartner(db: DbOrTx, partnerId: string) {
  await db.execute(sql`SELECT id FROM partners WHERE id = ${partnerId} FOR UPDATE`);
}

export async function membershipCount(db: DbOrTx, userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(memberships).where(eq(memberships.userId, userId));
  return row?.n ?? 0;
}

/** Slug unik: `base`, lalu `base-2`, `base-3`, … */
export async function uniqueFacilitySlug(db: DbOrTx, base: string): Promise<string> {
  const result = await db.execute<{ slug: string }>(
    sql`SELECT slug FROM facilities WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`,
  );
  const taken = new Set(result.rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function uniquePractitionerSlug(db: DbOrTx, base: string): Promise<string> {
  const result = await db.execute<{ slug: string }>(
    sql`SELECT slug FROM practitioners WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`,
  );
  const taken = new Set(result.rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/* ---------- Profil (baris facilities) ---------- */

export async function insertFacility(
  db: DbOrTx,
  v: {
    slug: string;
    name: string;
    type: FacilityType;
    description: string | null;
    phone: string | null;
    website: string | null;
    address: string;
    city: string;
    province: string;
  },
) {
  const [row] = await db
    .insert(facilities)
    .values({ ...v, status: 'draft', verification: 'diisi_faskes' })
    .returning({ id: facilities.id, slug: facilities.slug, name: facilities.name, status: facilities.status });
  return row!;
}

export async function lockFacility(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; slug: string; status: EntityStatus }>(
    sql`SELECT id, slug, status FROM facilities WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

export async function updateProfileFields(
  db: DbOrTx,
  id: string,
  v: {
    name?: string;
    description?: string | null;
    phone?: string | null;
    website?: string | null;
    hours?: Record<string, string> | null;
    status?: EntityStatus;
  },
) {
  await db
    .update(facilities)
    .set({ ...v, updatedAt: new Date() })
    .where(eq(facilities.id, id));
}

/* ---------- Lokasi (K6) ---------- */

export function listLocations(db: DbOrTx, facilityId: string) {
  return db
    .select({
      id: profileLocations.id,
      label: profileLocations.label,
      address: profileLocations.address,
      city: profileLocations.city,
      province: profileLocations.province,
      lat: sql<number>`ST_Y(${profileLocations.location}::geometry)`.mapWith(Number),
      lng: sql<number>`ST_X(${profileLocations.location}::geometry)`.mapWith(Number),
      isPrimary: profileLocations.isPrimary,
    })
    .from(profileLocations)
    .where(eq(profileLocations.facilityId, facilityId))
    .orderBy(desc(profileLocations.isPrimary), asc(profileLocations.sortOrder), asc(profileLocations.createdAt));
}

/**
 * Ganti semua lokasi, lalu salin lokasi utama ke kolom `facilities` agar pencarian dan peta yang ada
 * tidak berubah (K6). Wilayah dicocokkan dari nama kota; bila tidak cocok dan kota tidak berubah,
 * wilayah lama dipertahankan.
 */
export async function replaceLocations(db: DbOrTx, facilityId: string, locations: LocationInput[]) {
  const rows = locations.map((l, i) => ({
    label: l.label ?? null,
    address: l.address,
    city: l.city,
    province: l.province,
    lat: l.lat,
    lng: l.lng,
    is_primary: l.isPrimary,
    sort_order: i,
  }));
  await db.execute(sql`DELETE FROM profile_locations WHERE facility_id = ${facilityId}`);
  await db.execute(sql`
    INSERT INTO profile_locations (facility_id, label, address, city, province, region_id, location, is_primary, sort_order)
    SELECT ${facilityId}::uuid, x.label, x.address, x.city, x.province,
      (SELECT r.id FROM regions r
        WHERE r.type IN ('kota', 'kabupaten') AND lower(r.name) = lower(x.city)
        ORDER BY (r.type = 'kota') DESC, r.id LIMIT 1),
      ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography, x.is_primary, x.sort_order
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS x(label text, address text, city text, province text, lat float8, lng float8, is_primary boolean, sort_order int)
  `);
  await copyPrimaryLocation(db, facilityId);
}

export async function copyPrimaryLocation(db: DbOrTx, facilityId: string) {
  await db.execute(sql`
    UPDATE facilities f
    SET address = l.address, city = l.city, province = l.province, location = l.location,
        region_id = COALESCE(l.region_id, CASE WHEN lower(f.city) = lower(l.city) THEN f.region_id END),
        updated_at = now()
    FROM profile_locations l
    WHERE l.facility_id = f.id AND l.is_primary AND f.id = ${facilityId}
  `);
}

/** Admin mengoreksi koordinat faskes (M15): titik lokasi utama ikut disesuaikan. */
export async function syncPrimaryPointFromFacility(db: DbOrTx, facilityId: string) {
  await db.execute(sql`
    UPDATE profile_locations l SET location = f.location
    FROM facilities f
    WHERE f.id = l.facility_id AND l.is_primary AND f.id = ${facilityId} AND f.location IS NOT NULL
  `);
}

/* ---------- Jadwal (K7) ---------- */

export function listSchedules(db: DbOrTx, facilityId: string) {
  return db
    .select({
      id: schedules.id,
      kind: schedules.kind,
      weekday: schedules.weekday,
      start: sql<string>`to_char(${schedules.startTime}, 'HH24:MI')`,
      end: sql<string>`to_char(${schedules.endTime}, 'HH24:MI')`,
      timezone: schedules.timezone,
      practitionerId: schedules.practitionerId,
      note: schedules.note,
    })
    .from(schedules)
    .where(eq(schedules.facilityId, facilityId))
    .orderBy(asc(schedules.kind), asc(schedules.weekday), asc(schedules.startTime));
}

/** Jadwal untuk publik; jadwal praktik hanya menyebut tenaga medis yang terbit. */
export function publicSchedules(db: DbOrTx, facilityId: string) {
  return db
    .select({
      kind: schedules.kind,
      weekday: schedules.weekday,
      start: sql<string>`to_char(${schedules.startTime}, 'HH24:MI')`,
      end: sql<string>`to_char(${schedules.endTime}, 'HH24:MI')`,
      timezone: schedules.timezone,
      note: schedules.note,
      practitioner: sql<{ slug: string; name: string } | null>`CASE WHEN ${practitioners.status} = 'terbit'
        THEN json_build_object('slug', ${practitioners.slug}, 'name', ${practitioners.name}) END`,
    })
    .from(schedules)
    .leftJoin(practitioners, eq(practitioners.id, schedules.practitionerId))
    .where(eq(schedules.facilityId, facilityId))
    .orderBy(asc(schedules.kind), asc(schedules.weekday), asc(schedules.startTime));
}

export async function replaceSchedules(db: DbOrTx, facilityId: string, items: ScheduleInput[]) {
  await db.execute(sql`DELETE FROM schedules WHERE facility_id = ${facilityId}`);
  if (items.length === 0) return;
  const rows = items.map((s) => ({
    kind: s.kind,
    weekday: s.weekday,
    start: s.start,
    end: s.end,
    timezone: s.timezone,
    practitioner_id: s.practitionerId ?? null,
    note: s.note ?? null,
  }));
  await db.execute(sql`
    INSERT INTO schedules (facility_id, kind, weekday, start_time, end_time, timezone, practitioner_id, note)
    SELECT ${facilityId}::uuid, x.kind::schedule_kind, x.weekday, x.start::time, x."end"::time, x.timezone, x.practitioner_id, x.note
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS x(kind text, weekday smallint, start text, "end" text, timezone text, practitioner_id uuid, note text)
  `);
}

/* ---------- Tenaga medis ---------- */

export async function linkedPractitionerIds(db: DbOrTx, facilityId: string): Promise<string[]> {
  const rows = await db
    .select({ id: facilityPractitioners.practitionerId })
    .from(facilityPractitioners)
    .where(eq(facilityPractitioners.facilityId, facilityId));
  return rows.map((r) => r.id);
}

export function practitionersOfFacility(db: DbOrTx, facilityId: string) {
  return db
    .select({ id: practitioners.id, name: practitioners.name, specialty: practitioners.specialty, status: practitioners.status })
    .from(facilityPractitioners)
    .innerJoin(practitioners, eq(practitioners.id, facilityPractitioners.practitionerId))
    .where(eq(facilityPractitioners.facilityId, facilityId))
    .orderBy(asc(practitioners.name));
}

export async function insertPractitioner(
  db: DbOrTx,
  v: { slug: string; name: string; specialty: string | null; strNo: string | null },
) {
  const [row] = await db.insert(practitioners).values({ ...v, status: 'draft' }).returning({ id: practitioners.id });
  return row!;
}

export async function linkPractitioner(db: DbOrTx, facilityId: string, practitionerId: string) {
  await db.insert(facilityPractitioners).values({ facilityId, practitionerId }).onConflictDoNothing();
}

export async function setPartnerPractitioner(db: DbOrTx, partnerId: string, practitionerId: string) {
  await db.update(partners).set({ practitionerId, updatedAt: new Date() }).where(eq(partners.id, partnerId));
}

/**
 * Status praktisi milik mitra tenaga medis mengikuti profilnya: terbit bersama profil, tersembunyi
 * saat profil ditarik. Praktisi dari data publik tidak tersentuh.
 */
export async function syncPartnerPractitioners(db: DbOrTx, facilityId: string, status: EntityStatus) {
  await db.execute(sql`
    UPDATE practitioners p SET status = ${status}::entity_status
    FROM facility_practitioners fp
    WHERE fp.practitioner_id = p.id AND fp.facility_id = ${facilityId}
      AND EXISTS (SELECT 1 FROM partners pa WHERE pa.practitioner_id = p.id)
  `);
}

/* ---------- Revisi profil terbit (K3) ---------- */

const revisionColumns = {
  id: profileRevisions.id,
  facilityId: profileRevisions.facilityId,
  payload: profileRevisions.payload,
  status: profileRevisions.status,
  submittedBy: profileRevisions.submittedBy,
  reviewedBy: profileRevisions.reviewedBy,
  reviewedAt: profileRevisions.reviewedAt,
  rejectionReason: profileRevisions.rejectionReason,
  createdAt: profileRevisions.createdAt,
};

export async function pendingRevision(db: DbOrTx, facilityId: string) {
  const [row] = await db
    .select(revisionColumns)
    .from(profileRevisions)
    .where(and(eq(profileRevisions.facilityId, facilityId), eq(profileRevisions.status, 'pending')))
    .limit(1);
  return row ?? null;
}

export async function lastDecidedRevision(db: DbOrTx, facilityId: string) {
  const [row] = await db
    .select(revisionColumns)
    .from(profileRevisions)
    .where(and(eq(profileRevisions.facilityId, facilityId), sql`${profileRevisions.status} IN ('approved', 'rejected')`))
    .orderBy(desc(profileRevisions.reviewedAt))
    .limit(1);
  return row ?? null;
}

export async function supersedeRevision(db: DbOrTx, id: string) {
  await db.update(profileRevisions).set({ status: 'superseded' }).where(eq(profileRevisions.id, id));
}

export async function insertRevision(db: DbOrTx, v: { facilityId: string; payload: unknown; submittedBy: string | null }) {
  const [row] = await db.insert(profileRevisions).values(v).returning(revisionColumns);
  return row!;
}

export async function lockRevision(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: ReviewStatus }>(
    sql`SELECT id, status FROM profile_revisions WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

export async function findRevision(db: DbOrTx, id: string) {
  const [row] = await db.select(revisionColumns).from(profileRevisions).where(eq(profileRevisions.id, id));
  return row ?? null;
}

export async function decideRevision(
  db: DbOrTx,
  id: string,
  v: { status: 'approved' | 'rejected'; reviewedBy: string | null; rejectionReason?: string },
) {
  const [row] = await db
    .update(profileRevisions)
    .set({ ...v, reviewedAt: new Date() })
    .where(eq(profileRevisions.id, id))
    .returning(revisionColumns);
  return row!;
}

export function revisionQueue(db: DbOrTx, f: { status: ReviewStatus; q?: string; limit: number; offset: number }) {
  return db
    .select({
      id: profileRevisions.id,
      status: profileRevisions.status,
      payload: profileRevisions.payload,
      createdAt: profileRevisions.createdAt,
      reviewedAt: profileRevisions.reviewedAt,
      rejectionReason: profileRevisions.rejectionReason,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      facilityType: facilities.type,
      submitterEmail: user.email,
    })
    .from(profileRevisions)
    .innerJoin(facilities, eq(facilities.id, profileRevisions.facilityId))
    .leftJoin(user, eq(user.id, profileRevisions.submittedBy))
    .where(and(eq(profileRevisions.status, f.status), searchAny(f.q, [facilities.name, user.email])))
    .orderBy(asc(profileRevisions.createdAt), asc(profileRevisions.id))
    .limit(f.limit + 1)
    .offset(f.offset);
}

/* ---------- Kesiapan USP ---------- */

/**
 * Fakta kesiapan profil, memakai aturan yang sama dengan halaman publik: tarif dari VIEW `published_tariffs`,
 * media disetujui ber-URL publik, video hanya bila persetujuannya aktif. Satu query.
 */
export async function readinessFacts(db: DbOrTx, facilityId: string): Promise<ReadinessFacts | null> {
  const mediaState = (kind: 'foto' | 'video') => sql`CASE
    WHEN EXISTS (SELECT 1 FROM profile_media pm WHERE pm.facility_id = f.id AND pm.kind = ${kind}::media_kind
      AND pm.status = 'approved' AND pm.public_url IS NOT NULL AND ${consentAllowsPublic(sql`pm.id`, sql`pm.kind`)}) THEN 'publik'
    WHEN EXISTS (SELECT 1 FROM profile_media pm WHERE pm.facility_id = f.id AND pm.kind = ${kind}::media_kind
      AND pm.status = 'approved') THEN 'tanpa_persetujuan'
    WHEN EXISTS (SELECT 1 FROM profile_media pm WHERE pm.facility_id = f.id AND pm.kind = ${kind}::media_kind
      AND pm.status = 'pending' AND pm.confirmed_at IS NOT NULL) THEN 'menunggu'
    ELSE 'tidak_ada' END`;
  const r = await db.execute<{
    type: FacilityType;
    status: EntityStatus;
    photo: MediaReadiness | 'tanpa_persetujuan';
    video: VideoReadiness;
    consultation: ConsultationReadiness;
    priced_tariffs: number;
    practitioners: number;
    has_schedule: boolean;
    has_location: boolean;
    has_contact: boolean;
    has_description: boolean;
  }>(sql`
    SELECT f.type, f.status,
      ${mediaState('foto')} AS photo,
      ${mediaState('video')} AS video,
      COALESCE((
        SELECT CASE WHEN count(*) = 0 THEN NULL WHEN bool_or(pt.price_type <> 'tanya') THEN 'angka' ELSE 'tanya' END
        FROM published_tariffs pt
        JOIN services s ON s.id = pt.service_id
        JOIN service_categories c ON c.id = s.category_id AND c.slug = ${CONSULTATION_CATEGORY}
        WHERE pt.facility_id = f.id
      ), 'tidak_ada') AS consultation,
      (SELECT count(*)::int FROM published_tariffs pt WHERE pt.facility_id = f.id AND pt.price_type <> 'tanya') AS priced_tariffs,
      (SELECT count(*)::int FROM facility_practitioners fp JOIN practitioners p ON p.id = fp.practitioner_id
        WHERE fp.facility_id = f.id AND p.status = 'terbit') AS practitioners,
      EXISTS (SELECT 1 FROM schedules sc WHERE sc.facility_id = f.id) AS has_schedule,
      (f.location IS NOT NULL OR EXISTS (SELECT 1 FROM profile_locations pl WHERE pl.facility_id = f.id)) AS has_location,
      (nullif(btrim(f.phone), '') IS NOT NULL OR nullif(btrim(f.website), '') IS NOT NULL) AS has_contact,
      (length(btrim(coalesce(f.description, ''))) >= 20) AS has_description
    FROM facilities f WHERE f.id = ${facilityId}
  `);
  const row = r.rows[0];
  if (!row) return null;
  return {
    type: row.type,
    status: row.status,
    // Foto tidak butuh persetujuan; "tanpa_persetujuan" hanya mungkin untuk video.
    photo: row.photo === 'tanpa_persetujuan' ? 'publik' : row.photo,
    video: row.video,
    consultation: row.consultation,
    pricedTariffs: row.priced_tariffs,
    practitioners: row.practitioners,
    hasSchedule: row.has_schedule,
    hasLocation: row.has_location,
    hasContact: row.has_contact,
    hasDescription: row.has_description,
  };
}
