/** Nilai enum yang dipakai bersama database, API, dan frontend. */

export const FACILITY_TYPES = [
  'rumah_sakit',
  'klinik',
  'puskesmas',
  'laboratorium',
  'praktik_dokter',
  'apotek',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

/** Urutan dari paling lemah ke paling kuat. */
export const VERIFICATION_LEVELS = [
  'publik_belum_diverifikasi',
  'dari_dokumen_publik',
  'diisi_faskes',
  'diverifikasi_admin',
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const PRICE_TYPES = ['tetap', 'rentang', 'mulai_dari', 'paket', 'tanya'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const ENTITY_STATUSES = ['draft', 'menunggu_tinjauan', 'terbit', 'ditarik'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const USER_ROLES = ['faskes', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DATA_SOURCE_KINDS = ['perda', 'pmk', 'faskes', 'admin', 'lainnya'] as const;
export type DataSourceKind = (typeof DATA_SOURCE_KINDS)[number];

export const CLAIM_STATUSES = ['menunggu', 'disetujui', 'ditolak'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const IMPORT_BATCH_STATUSES = [
  'diunggah',
  'divalidasi',
  'ditinjau',
  'diterbitkan',
  'ditolak',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const REPORT_STATUSES = ['baru', 'diproses', 'selesai', 'ditolak'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONTENT_RULE_KINDS = ['kata', 'regex'] as const;
export type ContentRuleKind = (typeof CONTENT_RULE_KINDS)[number];

/** `blokir` menolak penerbitan; `tinjau` mengirim ke antrean moderator. */
export const CONTENT_RULE_LEVELS = ['blokir', 'tinjau'] as const;
export type ContentRuleLevel = (typeof CONTENT_RULE_LEVELS)[number];

/** Pengurutan yang diizinkan. Tidak ada pengurutan berbasis pembayaran (prinsip 1). */
export const SORT_OPTIONS = ['price_asc', 'price_desc', 'name', 'distance'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const DEFAULT_STALE_AFTER_DAYS = 180;

/** Batas unggahan dokumen klaim (M7). */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentMime = (typeof DOCUMENT_ALLOWED_MIME)[number];

/** Batas unggahan CSV (M5, M6). Tetap di bawah batas body tidak relevan karena lewat signed URL. */
export const CSV_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_CHUNK_SIZE = 500;
export const PORTAL_IMPORT_MAX_ROWS = 2000;

export const CSV_COLUMNS = [
  'facility_name',
  'city',
  'service_slug',
  'price_type',
  'price_min',
  'price_max',
  'effective_from',
  'source_title',
  'source_url',
] as const;

export const ANALYTICS_EVENTS = [
  'search_performed',
  'facility_viewed',
  'compare_viewed',
  'contact_clicked',
  'route_clicked',
  'report_submitted',
  'claim_started',
  'tariff_published',
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
