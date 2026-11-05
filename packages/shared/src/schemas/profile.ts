import { z } from 'zod';
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_MAX_BYTES,
  PROFILE_MAX_LOCATIONS,
  PROFILE_MAX_SCHEDULES,
  REVIEW_STATUSES,
  SCHEDULE_KINDS,
  TIMEZONES,
  DEFAULT_TIMEZONE,
  VIDEO_ALLOWED_MIME,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SECONDS,
} from '../constants';
import { cursorSchema, limitSchema, uuidSchema } from './common';

/* ---------- Fase 2 (F-02): profil layanan ---------- */

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** Jam lokal "HH:MM" (00:00–23:59). */
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:MM');

/** Menit sejak tengah malam, untuk membandingkan jam. */
export const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const locationInputSchema = z.object({
  label: optionalText(80),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isPrimary: z.boolean(),
});
export type LocationInput = z.infer<typeof locationInputSchema>;

export const locationsSchema = z
  .array(locationInputSchema)
  .min(1, 'Minimal satu lokasi')
  .max(PROFILE_MAX_LOCATIONS, `Maksimal ${PROFILE_MAX_LOCATIONS} lokasi`)
  .refine((ls) => ls.filter((l) => l.isPrimary).length === 1, 'Tepat satu lokasi harus menjadi lokasi utama');

/** Jadwal berulang per hari: jam lokal + zona waktu, bukan UTC (K7). Lewat tengah malam = dua baris. */
export const scheduleInputSchema = z
  .object({
    kind: z.enum(SCHEDULE_KINDS),
    weekday: z.number().int().min(1).max(7),
    start: clockTimeSchema,
    end: clockTimeSchema,
    timezone: z.enum(TIMEZONES).default(DEFAULT_TIMEZONE),
    practitionerId: uuidSchema.nullable().optional(),
    note: optionalText(200),
  })
  .refine((s) => minutesOf(s.end) > minutesOf(s.start), { message: 'Jam selesai harus setelah jam mulai', path: ['end'] });
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const schedulesSchema = z.array(scheduleInputSchema).max(PROFILE_MAX_SCHEDULES);

/** Field publik profil yang bisa diubah mitra. Pada profil terbit, perubahan menjadi revisi (K3). */
export const profileFieldsSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  description: optionalText(2000),
  phone: optionalText(40),
  website: z.url().max(300).nullable().optional(),
  locations: locationsSchema.optional(),
  schedules: schedulesSchema.optional(),
});
export type ProfileFields = z.infer<typeof profileFieldsSchema>;

export const profileCreateSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description: optionalText(2000),
  phone: optionalText(40),
  website: z.url().max(300).nullable().optional(),
  locations: locationsSchema,
  schedules: schedulesSchema.optional(),
});
export type ProfileCreateInput = z.infer<typeof profileCreateSchema>;

/* ---------- Media ---------- */

const fileName = z.string().trim().min(1).max(200);
const caption = optionalText(200);

export const mediaPresignSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('foto'),
    fileName,
    caption,
    mime: z.enum(PHOTO_ALLOWED_MIME, { message: 'Foto harus JPEG, PNG, atau WebP' }),
    sizeBytes: z.number().int().positive().max(PHOTO_MAX_BYTES, 'Ukuran foto maksimal 5 MB'),
  }),
  z.object({
    kind: z.literal('video'),
    fileName,
    caption,
    mime: z.enum(VIDEO_ALLOWED_MIME, { message: 'Video harus MP4 atau WebM' }),
    sizeBytes: z.number().int().positive().max(VIDEO_MAX_BYTES, 'Ukuran video maksimal 100 MB'),
    /** Diukur browser sebelum unggah; MP4 dicek ulang di server. */
    durationSec: z.number().positive().max(VIDEO_MAX_SECONDS, `Durasi video maksimal ${VIDEO_MAX_SECONDS} detik`),
  }),
]);
export type MediaPresignInput = z.infer<typeof mediaPresignSchema>;

export const mediaOrderSchema = z.object({ ids: z.array(uuidSchema).min(1).max(20) });

/* ---------- Harga dan layanan ---------- */

/** Sumber harga wajib pada setiap permintaan perubahan harga (K4). */
export const tariffSourceFields = {
  sourceTitle: z.string().trim().min(3).max(200),
  sourceUrl: z.url().max(500).nullable().optional(),
};

export const tariffActiveSchema = z.object({ active: z.boolean() });

/* ---------- Moderasi ---------- */

export const reviewQueueQuerySchema = z.object({
  status: z.enum(REVIEW_STATUSES).default('pending'),
  limit: limitSchema,
  cursor: cursorSchema,
});

export const rejectReasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
