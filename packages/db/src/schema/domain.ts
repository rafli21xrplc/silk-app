import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  serial,
  smallint,
  smallserial,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import {
  articleStatus,
  citext,
  entityStatus,
  facilityType,
  geographyPoint,
  inet,
  mediaKind,
  consentMethod,
  partnerStatus,
  partnerType,
  priceType,
  reviewStatus,
  scheduleKind,
  tariffRequestKind,
  verificationLevel,
} from './enums';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/* ---------- Wilayah ---------- */

/** Kode kanonik = kode wilayah Kemendagri (mis. 35.73 Kota Malang, 35.07 Kabupaten Malang). */
export const regions = pgTable(
  'regions',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    type: text('type').notNull(), // provinsi | kota | kabupaten
    parentId: integer('parent_id').references((): AnyPgColumn => regions.id),
    source: text('source').notNull(),
  },
  (t) => [
    index('regions_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
    check('regions_type_check', sql`${t.type} IN ('provinsi','kota','kabupaten')`),
  ],
);

/* ---------- M1: faskes dan tenaga medis ---------- */

export const facilities = pgTable(
  'facilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    type: facilityType('type').notNull(),
    description: text('description'),
    address: text('address').notNull(),
    city: text('city').notNull(),
    province: text('province').notNull(),
    regionId: integer('region_id').references(() => regions.id),
    location: geographyPoint('location'),
    phone: text('phone'),
    website: text('website'),
    licenseNo: text('license_no'),
    hours: jsonb('hours').$type<Record<string, string>>(),
    verification: verificationLevel('verification').notNull().default('publik_belum_diverifikasi'),
    status: entityStatus('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('facilities_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`),
    index('facilities_location_gix').using('gist', t.location),
    index('facilities_city_type').on(t.city, t.type).where(sql`${t.status} = 'terbit'`),
    index('facilities_region_idx').on(t.regionId),
  ],
);

export const practitioners = pgTable('practitioners', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  specialty: text('specialty'),
  strNo: text('str_no'),
  strVerifiedAt: timestamp('str_verified_at', { withTimezone: true }),
  status: entityStatus('status').notNull().default('draft'),
});

export const facilityPractitioners = pgTable(
  'facility_practitioners',
  {
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.facilityId, t.practitionerId] })],
);

/* ---------- Fase 1 (F-01): mitra ---------- */

/**
 * Data usaha dan izin mitra (diagram kelas SRS: Mitra dan turunannya). Satu baris per akun mitra.
 * Kolom per jenis bersifat nullable; CHECK menjamin atribut wajib per jenis. Profil faskes tetap di
 * `facilities` (lewat `memberships`), tenaga medis ditautkan ke `practitioners` lewat `practitioner_id`.
 */
export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    partnerType: partnerType('partner_type').notNull(),
    businessName: text('business_name').notNull(),
    licenseNo: text('license_no'),
    status: partnerStatus('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => user.id, { onDelete: 'set null' }),
    specialty: text('specialty'),
    strNo: text('str_no'),
    practitionerId: uuid('practitioner_id').references(() => practitioners.id, { onDelete: 'set null' }),
    facilityKind: facilityType('facility_kind'),
    roomCount: integer('room_count'),
    field: text('field'),
    siaNo: text('sia_no'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('partners_status_type_idx').on(t.status, t.partnerType, t.createdAt),
    check(
      'partners_type_attributes',
      sql`(${t.partnerType} <> 'tenaga_medis' OR ${t.strNo} IS NOT NULL)
        AND (${t.partnerType} <> 'fasilitas' OR ${t.facilityKind} IS NOT NULL)
        AND (${t.partnerType} <> 'gaya_hidup' OR ${t.field} IS NOT NULL)
        AND (${t.partnerType} <> 'apotek' OR ${t.siaNo} IS NOT NULL)`,
    ),
    check('partners_verified_at', sql`(${t.status} = 'verified') = (${t.verifiedAt} IS NOT NULL)`),
    check('partners_rejection_reason', sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`),
    check('partners_room_count', sql`${t.roomCount} IS NULL OR ${t.roomCount} >= 0`),
  ],
);

/* ---------- M2: layanan, paket, tarif ---------- */

export const serviceCategories = pgTable('service_categories', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  parentId: smallint('parent_id').references((): AnyPgColumn => serviceCategories.id),
});

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: smallint('category_id')
      .notNull()
      .references(() => serviceCategories.id),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index('services_name_trgm').using('gin', sql`${t.name} gin_trgm_ops`)],
);

export const packages = pgTable('packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  facilityId: uuid('facility_id')
    .notNull()
    .references(() => facilities.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id),
  name: text('name').notNull(),
  notes: text('notes'),
});

export const packageComponents = pgTable(
  'package_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    included: boolean('included').notNull().default(true),
    sortOrder: smallint('sort_order').notNull().default(0),
  },
  (t) => [index('package_components_package_idx').on(t.packageId)],
);

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(), // perda | pmk | faskes | admin | lainnya
    title: text('title').notNull(),
    url: text('url'),
    documentDate: date('document_date', { mode: 'string' }),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('data_sources_kind_title_url').on(t.kind, t.title, sql`coalesce(${t.url}, '')`),
    check('data_sources_kind_check', sql`${t.kind} IN ('perda','pmk','faskes','admin','lainnya')`),
  ],
);

export const tariffs = pgTable(
  'tariffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    packageId: uuid('package_id').references(() => packages.id),
    /** Diisi setelah versi pertama dibuat. */
    currentVersionId: uuid('current_version_id'),
    status: entityStatus('status').notNull().default('draft'),
    /** Fase 2 (K5): mitra bisa menonaktifkan layanan; VIEW published_tariffs menyaring `active`. */
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    unique('tariffs_facility_service_package').on(t.facilityId, t.serviceId, t.packageId).nullsNotDistinct(),
    foreignKey({
      name: 'tariffs_current_fk',
      columns: [t.currentVersionId],
      foreignColumns: [tariffVersions.id],
    }),
    index('tariffs_service_status_idx').on(t.serviceId, t.status),
  ],
);

/** Append-only: UPDATE dan DELETE ditolak trigger di database (lihat migrasi 0002). */
export const tariffVersions = pgTable(
  'tariff_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tariffId: uuid('tariff_id')
      .notNull()
      .references((): AnyPgColumn => tariffs.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    priceType: priceType('price_type').notNull(),
    priceMin: bigint('price_min', { mode: 'number' }),
    priceMax: bigint('price_max', { mode: 'number' }),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveTo: date('effective_to', { mode: 'string' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verification: verificationLevel('verification').notNull(),
    sourceId: uuid('source_id').references(() => dataSources.id),
    inclusions: text('inclusions'),
    exclusions: text('exclusions'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique('tariff_versions_tariff_version').on(t.tariffId, t.versionNo),
    check('tariff_versions_price_required', sql`${t.priceType} IN ('tanya') OR ${t.priceMin} IS NOT NULL`),
    check('tariff_versions_price_order', sql`${t.priceMax} IS NULL OR ${t.priceMax} >= ${t.priceMin}`),
    check('tariff_versions_price_nonneg', sql`${t.priceMin} IS NULL OR ${t.priceMin} >= 0`),
    // "Tanyakan ke faskes" tidak pernah membawa angka (M2-3).
    check('tariff_versions_ask_no_price', sql`${t.priceType} <> 'tanya' OR (${t.priceMin} IS NULL AND ${t.priceMax} IS NULL)`),
  ],
);

/* ---------- M6, M7: keanggotaan, klaim, dokumen ---------- */

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('pengelola'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.facilityId] })],
);

export const facilityClaims = pgTable(
  'facility_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    status: text('status').notNull().default('menunggu'), // menunggu | disetujui | ditolak
    reviewedBy: uuid('reviewed_by').references(() => user.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    note: text('note'),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('facility_claims_one_pending')
      .on(t.facilityId, t.userId)
      .where(sql`${t.status} = 'menunggu'`),
    index('facility_claims_status_idx').on(t.status, t.createdAt),
    check('facility_claims_status_check', sql`${t.status} IN ('menunggu','disetujui','ditolak')`),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Induk dokumen: klaim (M7) atau permintaan harga (Fase 2); tepat satu terisi. */
    claimId: uuid('claim_id').references(() => facilityClaims.id, { onDelete: 'cascade' }),
    tariffChangeRequestId: uuid('tariff_change_request_id').references((): AnyPgColumn => tariffChangeRequests.id, {
      onDelete: 'cascade',
    }),
    objectKey: text('object_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Terisi setelah API memeriksa ukuran dan magic bytes objek di penyimpanan. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_claim_idx').on(t.claimId),
    index('documents_tariff_request_idx').on(t.tariffChangeRequestId),
    check('documents_one_parent', sql`num_nonnulls(${t.claimId}, ${t.tariffChangeRequestId}) = 1`),
  ],
);

/* ---------- M5: impor ---------- */

export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => dataSources.id),
    uploadedBy: uuid('uploaded_by').references(() => user.id),
    /** Terisi untuk impor portal: semua baris wajib milik faskes ini (M6). */
    facilityId: uuid('facility_id').references(() => facilities.id),
    status: text('status').notNull().default('diunggah'), // diunggah | divalidasi | ditinjau | diterbitkan | ditolak
    objectKey: text('object_key').notNull(),
    fileName: text('file_name'),
    fileSha256: text('file_sha256'),
    sourceKind: text('source_kind').notNull().default('perda'),
    rowsTotal: integer('rows_total'),
    rowsProcessed: integer('rows_processed').notNull().default(0),
    rowsValid: integer('rows_valid').notNull().default(0),
    rowsInvalid: integer('rows_invalid').notNull().default(0),
    error: text('error'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('import_batches_status_idx').on(t.status, t.createdAt),
    check(
      'import_batches_status_check',
      sql`${t.status} IN ('diunggah','divalidasi','ditinjau','diterbitkan','ditolak')`,
    ),
  ],
);

export const importRows = pgTable(
  'import_rows',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => importBatches.id, { onDelete: 'cascade' }),
    rowNo: integer('row_no').notNull(),
    raw: jsonb('raw').$type<Record<string, string>>().notNull(),
    errors: jsonb('errors').$type<{ field: string; code: string; message: string }[]>(),
    /** Nilai tervalidasi (camelCase) untuk penerbitan. */
    parsed: jsonb('parsed').$type<Record<string, unknown>>(),
    status: text('status').notNull().default('valid'), // valid | galat | ambigu
    matchedFacilityId: uuid('matched_facility_id'),
    matchedServiceId: uuid('matched_service_id'),
    candidates: jsonb('candidates').$type<{ id: string; name: string; city: string; score: number }[]>(),
  },
  (t) => [
    unique('import_rows_batch_row').on(t.batchId, t.rowNo),
    index('import_rows_batch_status_idx').on(t.batchId, t.status),
  ],
);

/* ---------- M14: laporan data ---------- */

export const dataReports = pgTable(
  'data_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tariffId: uuid('tariff_id')
      .notNull()
      .references(() => tariffs.id),
    tariffVersionId: uuid('tariff_version_id').references(() => tariffVersions.id),
    reason: text('reason').notNull(),
    contactEmail: text('contact_email'),
    status: text('status').notNull().default('baru'),
    note: text('note'),
    handledBy: uuid('handled_by').references(() => user.id),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('data_reports_status_idx').on(t.status, t.createdAt)],
);

/* ---------- M15: audit ---------- */

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    requestId: text('request_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entity, t.entityId, t.at.desc()),
    index('audit_actor_idx').on(t.actorId, t.at.desc()),
  ],
);

/* ---------- M17: aturan konten ---------- */

export const contentRules = pgTable(
  'content_rules',
  {
    id: serial('id').primaryKey(),
    pattern: text('pattern').notNull(),
    kind: text('kind').notNull().default('kata'), // kata | regex
    level: text('level').notNull().default('blokir'), // blokir | tinjau
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique('content_rules_pattern_kind').on(t.pattern, t.kind),
    check('content_rules_kind_check', sql`${t.kind} IN ('kata','regex')`),
    check('content_rules_level_check', sql`${t.level} IN ('blokir','tinjau')`),
  ],
);

/* ---------- Job latar (Vercel Cron + tabel jobs) ---------- */

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('antre'), // antre | berjalan | selesai | gagal
    attempts: integer('attempts').notNull().default(0),
    /** Mencegah job ganda untuk pekerjaan yang sama (idempoten). */
    dedupeKey: text('dedupe_key'),
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('jobs_pick_idx').on(t.type, t.status, t.runAfter),
    uniqueIndex('jobs_dedupe_active')
      .on(t.dedupeKey)
      .where(sql`${t.dedupeKey} IS NOT NULL AND ${t.status} IN ('antre','berjalan')`),
  ],
);

/* ---------- Rate limit aplikasi (laporan publik, dsb.) ---------- */

export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/* ---------- Tampilan tarif terbit ---------- */

/**
 * Satu-satunya definisi "tarif terbit" (bagian 4): faskes dan tarif berstatus `terbit`, dengan versi
 * yang tanggal berlakunya paling akhir namun sudah dimulai (effective_from <= hari ini WIB) dan belum
 * berakhir; ralat pada tanggal yang sama dimenangkan nomor versi tertinggi. Layanan nonaktif
 * (`tariffs.active = false`, Fase 2) tidak ikut.
 * Dibuat di migrasi 0003, diganti di 0006; skema di sini hanya untuk tipe query.
 */
export const publishedTariffs = pgView('published_tariffs', {
  tariffId: uuid('tariff_id').notNull(),
  facilityId: uuid('facility_id').notNull(),
  serviceId: uuid('service_id').notNull(),
  packageId: uuid('package_id'),
  versionId: uuid('version_id').notNull(),
  versionNo: integer('version_no').notNull(),
  priceType: priceType('price_type').notNull(),
  priceMin: bigint('price_min', { mode: 'number' }),
  priceMax: bigint('price_max', { mode: 'number' }),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  effectiveTo: date('effective_to', { mode: 'string' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verification: verificationLevel('verification').notNull(),
  sourceId: uuid('source_id'),
  inclusions: text('inclusions'),
  exclusions: text('exclusions'),
}).existing();

/* ---------- Fase 2 (F-02): profil layanan ---------- */

/**
 * Lokasi profil (boleh lebih dari satu). Lokasi utama juga disalin ke kolom `facilities`
 * (address, city, province, region_id, location) agar pencarian dan peta lama tetap berjalan.
 */
export const profileLocations = pgTable(
  'profile_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    label: text('label'),
    address: text('address').notNull(),
    city: text('city').notNull(),
    province: text('province').notNull(),
    regionId: integer('region_id').references(() => regions.id),
    location: geographyPoint('location').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('profile_locations_facility_idx').on(t.facilityId),
    uniqueIndex('profile_locations_one_primary').on(t.facilityId).where(sql`${t.isPrimary}`),
    index('profile_locations_location_gix').using('gist', t.location),
  ],
);

/** Jadwal berulang: jam lokal + zona waktu (bukan UTC), Senin = 1 … Minggu = 7. */
export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    practitionerId: uuid('practitioner_id').references(() => practitioners.id, { onDelete: 'set null' }),
    kind: scheduleKind('kind').notNull(),
    weekday: smallint('weekday').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    note: text('note'),
  },
  (t) => [
    index('schedules_facility_idx').on(t.facilityId, t.weekday),
    check('schedules_weekday', sql`${t.weekday} BETWEEN 1 AND 7`),
    check('schedules_time_order', sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** Foto dan video profil. Tampil publik hanya setelah `approved` (disalin ke penyimpanan publik). */
export const profileMedia = pgTable(
  'profile_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    objectKey: text('object_key').notNull().unique(),
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationSec: integer('duration_sec'),
    caption: text('caption'),
    status: reviewStatus('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    sortOrder: smallint('sort_order').notNull().default(0),
    /** URL publik; terisi setelah disetujui. */
    publicUrl: text('public_url'),
    uploadedBy: uuid('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    /** Terisi setelah API memeriksa ukuran dan magic bytes; sebelum itu bukan antrean moderasi. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('profile_media_facility_idx').on(t.facilityId, t.kind, t.sortOrder),
    index('profile_media_queue_idx').on(t.status, t.createdAt).where(sql`${t.confirmedAt} IS NOT NULL`),
    check('profile_media_rejection_reason', sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`),
    check('profile_media_public_url', sql`${t.status} = 'approved' OR ${t.publicUrl} IS NULL`),
  ],
);

/**
 * Persetujuan tertulis orang yang tampil di video profil (evaluasi USP R6). Video hanya bisa disetujui
 * moderator dan hanya tampil publik bila ada persetujuan aktif. Menghapus video = mencabut persetujuan;
 * barisnya tetap ada (media_id menjadi NULL) sebagai jejak kapan persetujuan berlaku.
 * Formulir bertanda tangan (metode `dokumen`) disimpan privat di penyimpanan; hanya pemilik profil
 * dan moderator yang bisa membukanya lewat signed URL berumur pendek.
 */
export const mediaConsents = pgTable(
  'media_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mediaId: uuid('media_id').references(() => profileMedia.id, { onDelete: 'set null' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    subjectName: text('subject_name').notNull(),
    method: consentMethod('method').notNull(),
    /** `profil_web` (wajib) dan opsional `media_sosial`. */
    scopes: text('scopes').array().notNull(),
    textVersion: text('text_version').notNull(),
    documentObjectKey: text('document_object_key').unique(),
    documentFileName: text('document_file_name'),
    documentMime: text('document_mime'),
    documentSizeBytes: integer('document_size_bytes'),
    /** Terisi setelah API memeriksa ukuran dan magic bytes formulir. */
    documentConfirmedAt: timestamp('document_confirmed_at', { withTimezone: true }),
    grantedBy: uuid('granted_by').references(() => user.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => user.id, { onDelete: 'set null' }),
    revokeReason: text('revoke_reason'),
  },
  (t) => [
    uniqueIndex('media_consents_active_media').on(t.mediaId).where(sql`${t.revokedAt} IS NULL AND ${t.mediaId} IS NOT NULL`),
    index('media_consents_facility_idx').on(t.facilityId),
    check(
      'media_consents_scopes',
      sql`cardinality(${t.scopes}) >= 1 AND ${t.scopes} <@ ARRAY['profil_web','media_sosial']::text[] AND 'profil_web' = ANY(${t.scopes})`,
    ),
    check(
      'media_consents_document',
      sql`(${t.method} = 'dokumen') = (${t.documentObjectKey} IS NOT NULL)`,
    ),
    check('media_consents_revoked', sql`${t.revokedAt} IS NULL OR ${t.revokeReason} IS NOT NULL`),
  ],
);

/**
 * Usulan perubahan field publik profil yang sudah terbit (K3). Publik tetap melihat data lama sampai
 * disetujui. Maksimal satu `pending` per profil; usulan baru digabung dan yang lama menjadi `superseded`.
 */
export const profileRevisions = pgTable(
  'profile_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    status: reviewStatus('status').notNull().default('pending'),
    submittedBy: uuid('submitted_by').references(() => user.id, { onDelete: 'set null' }),
    reviewedBy: uuid('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('profile_revisions_one_pending').on(t.facilityId).where(sql`${t.status} = 'pending'`),
    index('profile_revisions_queue_idx').on(t.status, t.createdAt),
    check('profile_revisions_rejection_reason', sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`),
  ],
);

/**
 * Usulan harga dari mitra (K4). `tariff_versions` baru ditulis saat moderator menyetujui, sehingga
 * tabel itu tetap append-only dan hanya berisi harga yang sudah diverifikasi.
 */
export const tariffChangeRequests = pgTable(
  'tariff_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    kind: tariffRequestKind('kind').notNull(),
    /** Null = layanan baru untuk profil ini (tarif dibuat saat disetujui). */
    tariffId: uuid('tariff_id').references(() => tariffs.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id),
    /** Paket baru (nama, catatan, komponen) untuk tarif baru bertipe paket. */
    packagePayload: jsonb('package_payload'),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, { onDelete: 'cascade' }),
    /** Nomor versi saat usulan dibuat; beda saat disetujui = harga sudah berubah, usulan harus diulang. */
    baseVersionNo: integer('base_version_no'),
    priceType: priceType('price_type'),
    priceMin: bigint('price_min', { mode: 'number' }),
    priceMax: bigint('price_max', { mode: 'number' }),
    effectiveFrom: date('effective_from', { mode: 'string' }),
    effectiveTo: date('effective_to', { mode: 'string' }),
    inclusions: text('inclusions'),
    exclusions: text('exclusions'),
    sourceTitle: text('source_title').notNull(),
    sourceUrl: text('source_url'),
    status: reviewStatus('status').notNull().default('pending'),
    submittedBy: uuid('submitted_by').references(() => user.id, { onDelete: 'set null' }),
    decidedBy: uuid('decided_by').references(() => user.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    resultingVersionId: uuid('resulting_version_id').references(() => tariffVersions.id),
    createdAt: createdAt(),
  },
  (t) => [
    index('tariff_change_requests_queue_idx').on(t.status, t.createdAt),
    index('tariff_change_requests_facility_idx').on(t.facilityId, t.createdAt),
    check(
      'tariff_change_requests_kind_fields',
      sql`(${t.kind} = 'tunggal' AND ${t.serviceId} IS NOT NULL AND ${t.priceType} IS NOT NULL AND ${t.effectiveFrom} IS NOT NULL)
        OR (${t.kind} = 'impor' AND ${t.importBatchId} IS NOT NULL)`,
    ),
    check('tariff_change_requests_price_order', sql`${t.priceMax} IS NULL OR ${t.priceMax} >= ${t.priceMin}`),
    check('tariff_change_requests_rejection_reason', sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`),
  ],
);

/**
 * Ringkasan rating per profil (Fase 3, P5). Dibuat kosong di Fase 3; Fase 6 mengisinya dari ulasan
 * yang disetujui. Dibaca pencarian hanya bila flag `reviews_enabled` menyala, dan tidak pernah
 * dipakai urutan bawaan.
 */
export const facilityRatings = pgTable(
  'facility_ratings',
  {
    facilityId: uuid('facility_id')
      .primaryKey()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    ratingAvg: numeric('rating_avg', { precision: 2, scale: 1, mode: 'number' }).notNull(),
    ratingCount: integer('rating_count').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('facility_ratings_avg_range', sql`${t.ratingAvg} BETWEEN 1 AND 5`),
    check('facility_ratings_count', sql`${t.ratingCount} >= 0`),
  ],
);

/**
 * Artikel edukasi dari mitra (Fase 4, F-05). Satu baris menyimpan salinan kerja (`title`, `summary`, `body`)
 * dan salinan terbit (`published_*`). Endpoint publik hanya membaca salinan terbit, jadi draf dan perubahan
 * yang menunggu tinjauan tidak pernah tampil. Artikel editorial tetap di Sanity.
 */
export const partnerArticles = pgTable(
  'partner_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => user.id, { onDelete: 'set null' }),
    slug: citext('slug').notNull().unique(),
    status: articleStatus('status').notNull().default('draft'),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    /** Markdown terbatas (lihat `parseArticleBody` di @silk/shared). */
    body: text('body').notNull().default(''),
    publishedTitle: text('published_title'),
    publishedSummary: text('published_summary'),
    publishedBody: text('published_body'),
    firstPublishedAt: timestamp('first_published_at', { withTimezone: true }),
    publishedUpdatedAt: timestamp('published_updated_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    /** Cocok dengan aturan M17 `tinjau` saat diajukan. */
    needsReview: boolean('needs_review').notNull().default(false),
    withdrawnReason: text('withdrawn_reason'),
    /** Diisi saat ditarik, dikosongkan hanya saat moderator menyetujui lagi: artikel tarikan tidak muncul kembali sebelum ditinjau. */
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    /** Waktu mitra mencentang pernyataan bebas promosi saat terakhir mengajukan. */
    declarationAt: timestamp('declaration_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('partner_articles_queue_idx').on(t.status, t.submittedAt),
    index('partner_articles_partner_idx').on(t.partnerId, t.updatedAt.desc()),
    index('partner_articles_public_idx').on(t.publishedUpdatedAt.desc()).where(sql`${t.publishedBody} IS NOT NULL`),
    check(
      'partner_articles_published_together',
      sql`(${t.publishedTitle} IS NULL) = (${t.publishedBody} IS NULL) AND (${t.publishedSummary} IS NULL) = (${t.publishedBody} IS NULL)
        AND (${t.publishedBody} IS NULL) = (${t.firstPublishedAt} IS NULL)`,
    ),
    check('partner_articles_published_status', sql`${t.status} <> 'published' OR (${t.publishedBody} IS NOT NULL AND ${t.withdrawnAt} IS NULL)`),
    check('partner_articles_withdrawn_at', sql`${t.status} <> 'withdrawn' OR ${t.withdrawnAt} IS NOT NULL`),
    check('partner_articles_rejection_reason', sql`${t.status} <> 'rejected' OR ${t.rejectionReason} IS NOT NULL`),
  ],
);
