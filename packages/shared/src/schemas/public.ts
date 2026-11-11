import { z } from 'zod';
import { FACILITY_SORT_OPTIONS, FACILITY_TYPES, MEDIA_KINDS, PRACTITIONER_SORT_OPTIONS, SCHEDULE_KINDS } from '../constants';
import { publicArticleSummarySchema } from './article';
import {
  booleanQuerySchema,
  cursorSchema,
  isoDateSchema,
  limitSchema,
  priceSchema,
  slugSchema,
  sortSchema,
  trustSchema,
  uuidSchema,
  verificationSchema,
} from './common';

const latSchema = z.coerce.number().min(-90).max(90);
const lngSchema = z.coerce.number().min(-180).max(180);

/** Rupiah utuh dari query string (filter biaya). */
const rupiahQuerySchema = z.coerce.number().int().min(0).max(1_000_000_000_000);

export const facilitySearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    type: z.enum(FACILITY_TYPES).optional(),
    service: slugSchema.optional(),
    /** Fase 3: slug kategori layanan; faskes yang punya tarif terbit di kategori itu. */
    category: slugSchema.optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    radius: z.coerce.number().int().min(100).max(50_000).optional(),
    /** Fase 3: rentang biaya (rupiah), wajib bersama `service` atau `category`. */
    priceMin: rupiahQuerySchema.optional(),
    priceMax: rupiahQuerySchema.optional(),
    /** Fase 3: rating minimal; hanya bila flag reviews_enabled menyala (selain itu 404). */
    minRating: z.coerce.number().int().min(1).max(5).optional(),
    sort: z.enum(FACILITY_SORT_OPTIONS).optional(),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'lat dan lng harus diisi bersama' });
    }
    if ((v.sort === 'distance' || v.radius !== undefined) && v.lat === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Pengurutan jarak dan radius memerlukan lat/lng' });
    }
    if ((v.sort === 'price_asc' || v.sort === 'price_desc') && !v.service) {
      ctx.addIssue({ code: 'custom', path: ['sort'], message: 'Pengurutan harga memerlukan parameter service' });
    }
    if ((v.priceMin !== undefined || v.priceMax !== undefined) && !v.service && !v.category) {
      ctx.addIssue({ code: 'custom', path: ['priceMin'], message: 'Filter biaya memerlukan layanan atau kategori' });
    }
    if (v.priceMin !== undefined && v.priceMax !== undefined && v.priceMin > v.priceMax) {
      ctx.addIssue({ code: 'custom', path: ['priceMax'], message: 'Biaya maksimal harus lebih besar dari biaya minimal' });
    }
  });
export type FacilitySearchQuery = z.infer<typeof facilitySearchQuerySchema>;

export const serviceCategorySchema = z.object({ slug: z.string(), name: z.string(), serviceCount: z.number().int() });
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;

export const servicesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: slugSchema.optional(),
  limit: limitSchema,
  cursor: cursorSchema,
});
export type ServicesQuery = z.infer<typeof servicesQuerySchema>;

export const compareQuerySchema = z
  .object({
    service: slugSchema,
    facilityIds: z
      .string()
      .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
      .pipe(z.array(uuidSchema).min(1).max(10))
      .optional(),
    city: z.string().trim().min(1).max(100).optional(),
    sort: sortSchema.exclude(['distance']).default('price_asc'),
    hideStale: booleanQuerySchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((v) => v.facilityIds || v.city, {
    message: 'Isi facilityIds atau city',
    path: ['facilityIds'],
  });
export type CompareQuery = z.infer<typeof compareQuerySchema>;

export const reportCreateSchema = z.object({
  tariffId: uuidSchema,
  reason: z.string().trim().min(10).max(1000),
  contactEmail: z.email().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

/* ---------- Respons publik ---------- */

export const facilityListItemSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  type: z.enum(FACILITY_TYPES),
  address: z.string(),
  city: z.string(),
  verification: verificationSchema,
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  distanceM: z.number().nullable(),
  price: priceSchema.nullable(),
  trust: trustSchema.nullable(),
  /** Fase 3: jumlah tarif terbit; 0 = "tarif belum tersedia". */
  publishedTariffCount: z.number().int(),
  /** Fase 3: ada angka harga untuk layanan yang dicari (bukan `tanya`). */
  priceAvailable: z.boolean(),
  /** Fase 3: lokasi terdekat dari titik pencarian bila bukan lokasi utama. */
  nearestLocation: z.object({ label: z.string().nullable(), address: z.string(), city: z.string() }).nullable(),
  /** Fase 3/6: rata-rata rating; hanya bila reviews_enabled dan jumlah ulasan cukup. */
  rating: z.object({ avg: z.number(), count: z.number().int() }).nullable(),
});
export type FacilityListItem = z.infer<typeof facilityListItemSchema>;

export const componentSchema = z.object({ label: z.string(), included: z.boolean() });

export const publicTariffSchema = z.object({
  id: uuidSchema,
  versionNo: z.number().int(),
  /** `categorySlug` aditif (evaluasi USP R3): penanda kategori tanpa bergantung pada nama tampilan. */
  service: z.object({ slug: z.string(), name: z.string(), category: z.string(), categorySlug: z.string() }),
  package: z.object({ name: z.string(), notes: z.string().nullable(), components: z.array(componentSchema) }).nullable(),
  price: priceSchema,
  trust: trustSchema,
  inclusions: z.string().nullable(),
  exclusions: z.string().nullable(),
});
export type PublicTariff = z.infer<typeof publicTariffSchema>;

export const facilityDetailSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  type: z.enum(FACILITY_TYPES),
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  province: z.string(),
  region: z.object({ code: z.string(), name: z.string(), type: z.string() }).nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  hours: z.record(z.string(), z.string()).nullable(),
  verification: verificationSchema,
  updatedAt: z.string(),
  /** Fase 4b: `photoUrl` = foto pertama profil praktik utama dokter (aditif). */
  practitioners: z.array(z.object({ slug: z.string(), name: z.string(), specialty: z.string().nullable(), photoUrl: z.string().nullable() })),
  tariffs: z.array(publicTariffSchema),
  /** Fase 2: semua lokasi (utama lebih dulu), jadwal terstruktur, dan media yang sudah disetujui. */
  locations: z.array(
    z.object({
      label: z.string().nullable(),
      address: z.string(),
      city: z.string(),
      province: z.string(),
      lat: z.number(),
      lng: z.number(),
      isPrimary: z.boolean(),
    }),
  ),
  schedules: z.array(
    z.object({
      kind: z.enum(SCHEDULE_KINDS),
      weekday: z.number().int().min(1).max(7),
      start: z.string(),
      end: z.string(),
      timezone: z.string(),
      note: z.string().nullable(),
      practitioner: z.object({ slug: z.string(), name: z.string() }).nullable(),
    }),
  ),
  media: z.array(
    z.object({
      id: uuidSchema,
      kind: z.enum(MEDIA_KINDS),
      url: z.string(),
      mime: z.string(),
      caption: z.string().nullable(),
      durationSec: z.number().nullable(),
    }),
  ),
});
export type FacilityDetail = z.infer<typeof facilityDetailSchema>;

/** Fase 4b: lencana verifikasi dokter. `partner` = akun mitra tenaga medis berstatus `verified`. */
export const practitionerVerificationSchema = z.object({ str: z.boolean(), partner: z.boolean() });

const practiceScheduleSchema = z.object({
  kind: z.enum(SCHEDULE_KINDS),
  weekday: z.number().int().min(1).max(7),
  start: z.string(),
  end: z.string(),
  timezone: z.string(),
  note: z.string().nullable(),
});

export const practitionerDetailSchema = z.object({
  slug: z.string(),
  name: z.string(),
  specialty: z.string().nullable(),
  /** Hanya terisi bila STR sudah diverifikasi (M1). */
  strNo: z.string().nullable(),
  strVerifiedAt: z.string().nullable(),
  facilities: z.array(z.object({ slug: z.string(), name: z.string(), city: z.string() })),
  /* Fase 4b (aditif). Foto, tentang, kontak, video, dan tarif berasal dari profil praktik utama. */
  verification: practitionerVerificationSchema,
  /** Foto pertama galeri profil praktik utama yang sudah disetujui. */
  photo: z.object({ url: z.string(), caption: z.string().nullable() }).nullable(),
  about: z.string().nullable(),
  contact: z.object({ phone: z.string().nullable(), website: z.string().nullable() }).nullable(),
  video: z.object({ url: z.string(), mime: z.string(), durationSec: z.number().nullable(), caption: z.string().nullable() }).nullable(),
  /** Tempat praktik; profil utama lebih dulu. Jadwal faskes lain hanya yang memuat dokter ini. */
  practices: z.array(
    z.object({
      facility: z.object({ id: uuidSchema, slug: z.string(), name: z.string(), type: z.enum(FACILITY_TYPES), city: z.string() }),
      isPrimary: z.boolean(),
      locations: z.array(
        z.object({
          label: z.string().nullable(),
          address: z.string(),
          city: z.string(),
          lat: z.number(),
          lng: z.number(),
          isPrimary: z.boolean(),
        }),
      ),
      schedules: z.array(practiceScheduleSchema),
    }),
  ),
  /** Tarif terbit profil praktik utama (VIEW published_tariffs). */
  tariffs: z.array(publicTariffSchema),
  /**
   * Evaluasi USP R3 (aditif): biaya konsultasi = tarif terbit kategori `konsultasi` di profil praktik utama.
   * Tarif berangka didahulukan atas tarif "tanya"; `null` bila tidak ada.
   */
  consultation: publicTariffSchema.nullable(),
  articles: z.array(publicArticleSummarySchema),
  /** Fase 6: rating dokter; `null` selama flag reviews_enabled mati. */
  rating: z.object({ avg: z.number(), count: z.number().int() }).nullable(),
});
export type PractitionerDetail = z.infer<typeof practitionerDetailSchema>;

/** Fase 4b: daftar dan pencarian dokter (`GET /v1/practitioners`). */
export const practitionerSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    specialty: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    radius: z.coerce.number().int().min(100).max(50_000).optional(),
    sort: z.enum(PRACTITIONER_SORT_OPTIONS).optional(),
    /** USP "kenal dokternya": hanya dokter dengan video perkenalan yang tampil (disetujui + persetujuan aktif). */
    video: booleanQuerySchema.optional(),
    /** USP "tahu biayanya": hanya dokter yang biaya konsultasinya tercantum berupa angka. */
    fee: booleanQuerySchema.optional(),
    limit: limitSchema,
    cursor: cursorSchema,
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'lat dan lng harus diisi bersama' });
    }
    if ((v.sort === 'distance' || v.radius !== undefined) && v.lat === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Pengurutan jarak dan radius memerlukan lat/lng' });
    }
    if (v.sort === 'relevance' && !v.q) {
      ctx.addIssue({ code: 'custom', path: ['sort'], message: 'Pengurutan relevansi memerlukan kata kunci' });
    }
  });
export type PractitionerSearchQuery = z.infer<typeof practitionerSearchQuerySchema>;

export const practitionerConsultationSchema = z.object({ serviceName: z.string(), price: priceSchema, trust: trustSchema });
export type PractitionerConsultation = z.infer<typeof practitionerConsultationSchema>;

export const practitionerListItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  specialty: z.string().nullable(),
  verification: practitionerVerificationSchema,
  photoUrl: z.string().nullable(),
  /** Kota tempat praktik (unik, maks. 3). */
  cities: z.array(z.string()),
  /** Maks. 2 tempat praktik; profil utama lebih dulu. */
  practices: z.array(z.object({ slug: z.string(), name: z.string() })),
  practiceCount: z.number().int(),
  /** Jarak ke tempat praktik terdekat, hanya bila ada titik pencarian. */
  distanceM: z.number().nullable(),
  hasVideo: z.boolean(),
  hasSchedule: z.boolean(),
  /** Evaluasi USP R3 (aditif): biaya konsultasi di profil praktik utama, dari VIEW published_tariffs. */
  consultation: practitionerConsultationSchema.nullable(),
});
export type PractitionerListItem = z.infer<typeof practitionerListItemSchema>;

export const practitionerSpecialtySchema = z.object({ name: z.string(), count: z.number().int() });
export type PractitionerSpecialty = z.infer<typeof practitionerSpecialtySchema>;

export const serviceListItemSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.object({ slug: z.string(), name: z.string() }),
  /** Nama lain (mis. "hb", "gdp"); aditif, dipakai web untuk memetakan kata kunci ke layanan. */
  aliases: z.array(z.string()),
});
export type ServiceListItem = z.infer<typeof serviceListItemSchema>;

export const cityPriceSummarySchema = z.object({
  city: z.string(),
  facilityCount: z.number().int(),
  minPrice: z.number().int().nullable(),
  maxPrice: z.number().int().nullable(),
  medianPrice: z.number().int().nullable(),
  latestVerifiedAt: z.string().nullable(),
});

export const serviceDetailSchema = serviceListItemSchema.extend({
  aliases: z.array(z.string()),
  cities: z.array(cityPriceSummarySchema),
});
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

export const compareRowSchema = z.object({
  tariffId: uuidSchema,
  facility: z.object({ id: uuidSchema, slug: z.string(), name: z.string(), city: z.string() }),
  price: priceSchema,
  components: z.record(z.string(), z.boolean()),
  effectiveFrom: isoDateSchema,
  verifiedAt: z.string().nullable(),
  verification: verificationSchema,
  stale: z.boolean(),
  source: z.object({ kind: z.string(), title: z.string() }).nullable(),
});

export const compareResponseSchema = z.object({
  service: z.object({ slug: z.string(), name: z.string() }),
  columns: z.array(z.string()),
  rows: z.array(compareRowSchema),
});
export type CompareResponse = z.infer<typeof compareResponseSchema>;

export const tariffHistoryItemSchema = z.object({
  versionNo: z.number().int(),
  price: priceSchema,
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  verifiedAt: z.string().nullable(),
  verification: verificationSchema,
  source: z.object({ kind: z.string(), title: z.string(), url: z.string().nullable() }).nullable(),
  createdBy: z.object({ name: z.string().nullable() }).nullable(),
  createdAt: z.string(),
  current: z.boolean(),
});
export type TariffHistoryItem = z.infer<typeof tariffHistoryItemSchema>;
