/** Nilai enum yang dipakai bersama database, API, dan frontend. */

export const FACILITY_TYPES = [
  'rumah_sakit',
  'klinik',
  'puskesmas',
  'laboratorium',
  'praktik_dokter',
  'apotek',
  // Fase 2 (F-02): profil mitra gaya hidup sehat dan rumah duka.
  'gaya_hidup',
  'rumah_duka',
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

/** Role akun (F-01). `faskes` = mitra fasilitas kesehatan. Role staf hanya diberikan admin. */
export const USER_ROLES = ['pasien', 'faskes', 'tenaga_medis', 'gaya_hidup', 'apotek', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES = ['moderator', 'admin'] as const satisfies readonly UserRole[];
export const PARTNER_ROLES = ['faskes', 'tenaga_medis', 'gaya_hidup', 'apotek'] as const satisfies readonly UserRole[];
export type PartnerRole = (typeof PARTNER_ROLES)[number];

/** Jenis mitra (diagram kelas SRS: FasilitasKesehatan, TenagaMedis, PenyediaGayaHidup, ApotekMitra). */
export const PARTNER_TYPES = ['fasilitas', 'tenaga_medis', 'gaya_hidup', 'apotek'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** Pilihan saat daftar mandiri. Tidak ada jalur ke role staf. */
export const ACCOUNT_TYPES = ['pasien', ...PARTNER_TYPES] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

const ACCOUNT_TYPE_ROLE: Record<AccountType, UserRole> = {
  pasien: 'pasien',
  fasilitas: 'faskes',
  tenaga_medis: 'tenaga_medis',
  gaya_hidup: 'gaya_hidup',
  apotek: 'apotek',
};
const ROLE_PARTNER_TYPE: Record<PartnerRole, PartnerType> = {
  faskes: 'fasilitas',
  tenaga_medis: 'tenaga_medis',
  gaya_hidup: 'gaya_hidup',
  apotek: 'apotek',
};

/** Role untuk jenis akun yang dipilih saat daftar; nilai tak dikenal jatuh ke `pasien`. */
export function roleForAccountType(type: unknown): UserRole {
  return (ACCOUNT_TYPES as readonly unknown[]).includes(type) ? ACCOUNT_TYPE_ROLE[type as AccountType] : 'pasien';
}

export const isPartnerRole = (role: string | null | undefined): role is PartnerRole =>
  (PARTNER_ROLES as readonly string[]).includes(role ?? '');
export const isStaffRole = (role: string | null | undefined): boolean =>
  (STAFF_ROLES as readonly string[]).includes(role ?? '');
export const partnerTypeForRole = (role: PartnerRole): PartnerType => ROLE_PARTNER_TYPE[role];

/**
 * Jenis profil layanan (`facilities.type`) untuk mitra baru (Fase 2, K1). Mitra fasilitas memakai
 * jenis yang dia isi di data mitra.
 */
export function profileTypeForPartner(p: { partnerType: PartnerType; facilityKind: FacilityType | null }): FacilityType {
  switch (p.partnerType) {
    case 'tenaga_medis':
      return 'praktik_dokter';
    case 'gaya_hidup':
      return 'gaya_hidup';
    case 'apotek':
      return 'apotek';
    case 'fasilitas':
      return p.facilityKind ?? 'klinik';
  }
}

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

/**
 * Urutan pencarian faskes (F-03). `rating` hanya bila flag `reviews_enabled` menyala dan hanya bila
 * pengguna memilihnya; urutan bawaan tidak pernah memakai rating, pembayaran, atau langganan.
 */
export const FACILITY_SORT_OPTIONS = [...SORT_OPTIONS, 'rating'] as const;
export type FacilitySortOption = (typeof FACILITY_SORT_OPTIONS)[number];

/** Fase 4b: urutan daftar dokter. Netral: relevansi, nama, jarak. Tidak pernah pembayaran atau langganan. */
export const PRACTITIONER_SORT_OPTIONS = ['relevance', 'name', 'distance'] as const;
export type PractitionerSortOption = (typeof PRACTITIONER_SORT_OPTIONS)[number];
/** Jumlah artikel dokter yang ditampilkan di halaman profilnya. */
export const PRACTITIONER_ARTICLE_LIMIT = 6;

/** Rating dianggap ada setelah sekian ulasan disetujui (filter dan urut rating, Fase 3/6). */
export const RATING_MIN_COUNT = 3;

/**
 * Ulasan pengalaman (Fase 6 ramping, evaluasi USP R8). Di balik flag `reviews_enabled`, OFF di produksi sampai
 * opini hukum tertulis. Aspek = pilar P3 (kenyamanan dan pelayanan staf), dinilai "baik"/"kurang"; tidak ada
 * penilaian hasil klinis. Rating tidak pernah menjadi urutan bawaan.
 */
export const REVIEW_ASPECTS = ['kenyamanan_tempat', 'keramahan_staf', 'kejelasan_penjelasan', 'waktu_tunggu', 'kesesuaian_biaya'] as const;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[number];
export const REVIEW_ASPECT_VALUES = ['baik', 'kurang'] as const;
export type ReviewAspectValue = (typeof REVIEW_ASPECT_VALUES)[number];
export const REVIEW_COMMENT_MAX = 1000;
/** Versi teks pernyataan penulis ulasan (pengalaman sendiri, bukan iklan). Naikkan bila teksnya berubah. */
export const REVIEW_DECLARATION_VERSION = 'ulasan-2026-11';

export const DEFAULT_STALE_AFTER_DAYS = 180;

/** Batas unggahan dokumen klaim (M7). */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentMime = (typeof DOCUMENT_ALLOWED_MIME)[number];

/* ---------- Fase 2 (F-02): profil layanan ---------- */

/** Jenis jadwal: jam buka tempat, atau jadwal praktik tenaga medis. */
export const SCHEDULE_KINDS = ['operasional', 'praktik'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/** Hari ISO: Senin = 1 … Minggu = 7. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';
export const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const;

/**
 * Slug kategori biaya konsultasi dokter (evaluasi USP R3). Tarif kategori ini di profil praktik utama
 * tampil sebagai "Biaya konsultasi" di kartu dan profil dokter.
 */
export const CONSULTATION_CATEGORY = 'konsultasi';

export const MEDIA_KINDS = ['foto', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Status moderasi untuk revisi profil, media, dan permintaan harga. */
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'superseded'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Fase 4 (F-05): status artikel mitra. Label UI ada di berkas pesan web. */
export const ARTICLE_STATUSES = ['draft', 'pending', 'published', 'rejected', 'withdrawn'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
/** Role mitra yang boleh menulis artikel (apotek tidak, lihat rencana fase 4 A2). */
export const ARTICLE_AUTHOR_ROLES = ['faskes', 'tenaga_medis', 'gaya_hidup'] as const satisfies readonly UserRole[];
export const ARTICLE_TITLE_MIN = 10;
export const ARTICLE_TITLE_MAX = 140;
export const ARTICLE_SUMMARY_MIN = 30;
export const ARTICLE_SUMMARY_MAX = 300;
export const ARTICLE_BODY_MIN = 300;
export const ARTICLE_BODY_MAX = 20_000;
/** Maksimal artikel berstatus `pending` per mitra, agar antrean moderasi tidak dibanjiri. */
export const ARTICLE_MAX_PENDING = 5;

/** Permintaan harga: satu tarif dari form, atau satu berkas CSV portal. */
export const TARIFF_REQUEST_KINDS = ['tunggal', 'impor'] as const;
export type TariffRequestKind = (typeof TARIFF_REQUEST_KINDS)[number];

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_COUNT = 10;
/**
 * Video perkenalan 30–60 detik (dokumen USP). Batas evaluasi USP R5: 20–90 detik, maks. 50 MB
 * (cukup untuk 90 detik 720p H.264), MP4 atau WebM.
 */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_ALLOWED_MIME = ['video/mp4', 'video/webm'] as const;
export const VIDEO_MIN_SECONDS = 20;
export const VIDEO_MAX_SECONDS = 90;
export const VIDEO_MAX_COUNT = 1;

/**
 * Persetujuan tertulis orang yang tampil di video (evaluasi USP R6).
 * - `pernyataan_akun`: orang yang tampil adalah pemilik akun tenaga medis yang mengunggah; persetujuan
 *   diberikan lewat pernyataan elektronik di akunnya.
 * - `dokumen`: formulir persetujuan bertanda tangan diunggah (wajib untuk akun selain tenaga medis).
 */
export const CONSENT_METHODS = ['pernyataan_akun', 'dokumen'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];
/** Cakupan pemakaian; `profil_web` selalu wajib, `media_sosial` opsional (pilar konten "Kenalan sama dokter"). */
export const CONSENT_SCOPES = ['profil_web', 'media_sosial'] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
/** Versi teks pernyataan persetujuan video yang ditampilkan di portal. Naikkan bila teksnya berubah. */
export const VIDEO_CONSENT_TEXT_VERSION = 'video-2026-11';
export const CONSENT_DOC_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const CONSENT_DOC_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_MAX_LOCATIONS = 10;
export const PROFILE_MAX_SCHEDULES = 70;

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
