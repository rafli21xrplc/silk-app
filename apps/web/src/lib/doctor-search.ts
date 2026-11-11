import { RADIUS_OPTIONS_M, searchHref } from './search-params';

/** Kunci query `/dokter` yang diteruskan ke `GET /v1/practitioners` (Fase 4b). */
const KEYS = ['q', 'specialty', 'city', 'lat', 'lng', 'radius', 'video', 'fee', 'sort', 'cursor'] as const;
export type DoctorSearchKey = (typeof KEYS)[number];
export type DoctorSearchState = Partial<Record<DoctorSearchKey, string>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
const isCoord = (v: string, limit: number) => v !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit;

/**
 * Normalkan query `/dokter` agar API tidak menolaknya (400): radius dan urut jarak hanya bila ada titik,
 * urut relevansi hanya bila ada kata kunci, radius hanya dari pilihan yang tersedia. Filter USP `video` dan `fee`
 * hanya bernilai `1`. Nilai lain dibuang.
 */
export function normalizeDoctorSearch(raw: Record<string, string | string[] | undefined>): DoctorSearchState {
  const s: DoctorSearchState = {};
  for (const k of KEYS) {
    const v = first(raw[k]);
    if (v) s[k] = v.slice(0, 100);
  }
  const hasPoint = isCoord(s.lat ?? '', 90) && isCoord(s.lng ?? '', 180);
  if (!hasPoint) {
    delete s.lat;
    delete s.lng;
    delete s.radius;
  }
  if (s.radius && !(RADIUS_OPTIONS_M as readonly number[]).includes(Number(s.radius))) delete s.radius;
  for (const k of ['video', 'fee'] as const) if (s[k] !== '1') delete s[k];
  const sortOk = s.sort === 'name' || s.sort === 'fee_asc' || (s.sort === 'distance' && hasPoint) || (s.sort === 'relevance' && !!s.q);
  if (!sortOk) delete s.sort;
  return s;
}

/** Query string untuk API (selalu dengan `limit`). */
export function doctorApiQuery(s: DoctorSearchState, limit = 20): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of KEYS) if (s[k]) p.set(k, s[k]!);
  p.set('limit', String(limit));
  return p;
}

/** Tautan `/dokter` dengan perubahan; kursor dibuang kecuali diisi lagi. `null` menghapus kunci. */
export function doctorHref(s: DoctorSearchState, patch: Partial<Record<DoctorSearchKey, string | null>> = {}): string {
  return searchHref(s, patch, '/dokter');
}
