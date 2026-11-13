import { z } from 'zod';
import { FACILITY_TYPES } from '@silk/shared';

/**
 * Parameter pencarian dari URL. Nilai yang tidak sah dibuang (bukan galat), sehingga tautan lama atau
 * hasil ketikan tetap membuka halaman. Kombinasi yang ditolak API (mis. urut harga tanpa layanan)
 * dinormalkan di sini, jadi permintaan ke API selalu sah.
 */
const text = z.string().trim().min(1).max(100).optional().catch(undefined);
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120)
  .optional()
  .catch(undefined);
const coord = (min: number, max: number) => z.coerce.number().min(min).max(max).optional().catch(undefined);
const flag = z
  .enum(['1'])
  .optional()
  .catch(undefined);
const cursor = z.string().min(1).max(500).optional().catch(undefined);

export const FACILITY_SORTS = ['price_asc', 'price_desc', 'name', 'distance'] as const;
export const DOCTOR_SORTS = ['name', 'fee_asc'] as const;

const facilityShape = z.object({
  q: text,
  city: text,
  type: z.enum(FACILITY_TYPES).optional().catch(undefined),
  service: slug,
  category: slug,
  sort: z.enum(FACILITY_SORTS).optional().catch(undefined),
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  /** `1` = pengguna memilih mencari kata kunci sebagai teks, bukan nama layanan. */
  teks: flag,
  cursor,
});
export type FacilityParams = z.infer<typeof facilityShape>;

const doctorShape = z.object({
  q: text,
  specialty: text,
  sort: z.enum(DOCTOR_SORTS).optional().catch(undefined),
  video: flag,
  fee: flag,
  cursor,
});
export type DoctorParams = z.infer<typeof doctorShape>;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function toRecord(raw: RawParams): Record<string, string | undefined> {
  if (raw instanceof URLSearchParams) return Object.fromEntries(raw.entries());
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

export function parseFacilityParams(raw: RawParams): FacilityParams {
  const p = facilityShape.parse(toRecord(raw));
  const hasPoint = p.lat !== undefined && p.lng !== undefined;
  if (!hasPoint) {
    p.lat = undefined;
    p.lng = undefined;
  }
  if ((p.sort === 'price_asc' || p.sort === 'price_desc') && !p.service) p.sort = undefined;
  if (p.sort === 'distance' && !hasPoint) p.sort = undefined;
  return p;
}

export function parseDoctorParams(raw: RawParams): DoctorParams {
  return doctorShape.parse(toRecord(raw));
}

/** Parameter → query string; nilai kosong dibuang, urutan kunci stabil (kunci cache yang sama). */
export function toQueryString(p: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const key of Object.keys(p).sort()) {
    const v = p[key];
    if (v !== undefined && v !== null && v !== '') qs.set(key, String(v));
  }
  return qs.toString();
}

/** Jumlah filter yang dipilih pengguna (untuk lencana tombol Filter). */
export function activeFacilityFilters(p: FacilityParams): number {
  return [p.city, p.type, p.service, p.category, p.sort].filter(Boolean).length;
}

/* ---------- Kata kunci → layanan (evaluasi UI/UX A1) ---------- */

export function normalizeTerm(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type ServiceLike = { slug: string; name: string; aliases?: readonly string[] };

/**
 * Kata kunci yang persis nama (dengan atau tanpa keterangan dalam kurung), slug, atau alias SATU layanan
 * diperlakukan sebagai filter layanan, supaya harga langsung tampil di setiap kartu.
 */
export function resolveServiceQuery<T extends ServiceLike>(q: string, services: readonly T[]): T | null {
  const term = normalizeTerm(q);
  if (term.length < 2) return null;
  const keys = (s: T) => [s.name, s.name.replace(/\(.*?\)/g, ''), s.slug, ...(s.aliases ?? [])].map(normalizeTerm).filter(Boolean);
  const hits = services.filter((s) => keys(s).includes(term));
  return hits.length === 1 ? hits[0]! : null;
}
