/** Kunci query `/cari` yang diteruskan ke `GET /v1/facilities` (F-03). */
const KEYS = ['q', 'city', 'type', 'service', 'category', 'lat', 'lng', 'radius', 'priceMin', 'priceMax', 'minRating', 'sort', 'cursor'] as const;
export type SearchKey = (typeof KEYS)[number];
export type SearchState = Partial<Record<SearchKey, string>>;

export const RADIUS_OPTIONS_M = [1000, 3000, 5000, 10_000, 25_000] as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

/** "Rp150.000" atau "150 000" → "150000"; kosong bila tidak ada angka. */
export function parseRupiahInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return digits.slice(0, 13);
}

const isCoord = (v: string, limit: number) => v !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit;

/**
 * Normalkan query `/cari` agar API tidak menolaknya (400): filter biaya hanya bila ada layanan atau
 * kategori, urut harga hanya bila ada layanan, jarak dan radius hanya bila ada titik, rating hanya bila
 * fitur ulasan menyala. Nilai lain dibuang.
 */
export function normalizeSearch(raw: Record<string, string | string[] | undefined>, opts: { ratings: boolean }): SearchState {
  const s: SearchState = {};
  for (const k of KEYS) {
    const v = first(raw[k]);
    if (v) s[k] = v;
  }
  for (const k of ['priceMin', 'priceMax'] as const) {
    if (s[k] !== undefined) {
      const n = parseRupiahInput(s[k]);
      if (n) s[k] = n;
      else delete s[k];
    }
  }
  if (!s.service && !s.category) {
    delete s.priceMin;
    delete s.priceMax;
  }
  if (s.priceMin && s.priceMax && Number(s.priceMin) > Number(s.priceMax)) [s.priceMin, s.priceMax] = [s.priceMax, s.priceMin];
  const hasPoint = isCoord(s.lat ?? '', 90) && isCoord(s.lng ?? '', 180);
  if (!hasPoint) {
    delete s.lat;
    delete s.lng;
    delete s.radius;
  }
  if (s.radius && !(RADIUS_OPTIONS_M as readonly number[]).includes(Number(s.radius))) delete s.radius;
  if (!opts.ratings) delete s.minRating;
  else if (s.minRating && !['1', '2', '3', '4', '5'].includes(s.minRating)) delete s.minRating;
  const sortOk =
    s.sort === 'name' ||
    ((s.sort === 'price_asc' || s.sort === 'price_desc') && !!s.service) ||
    (s.sort === 'distance' && hasPoint) ||
    (s.sort === 'rating' && opts.ratings);
  if (!sortOk) delete s.sort;
  return s;
}

/** Query string untuk API (selalu dengan `limit`). */
export function apiQuery(s: SearchState, limit = 20): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of KEYS) if (s[k]) p.set(k, s[k]!);
  p.set('limit', String(limit));
  return p;
}

/** Halaman yang memakai formulir pencarian dengan "Dekat saya" (faskes dan dokter). */
export type SearchPath = '/cari' | '/dokter';

/**
 * Tautan pencarian dengan perubahan; kursor selalu dibuang kecuali diisi lagi. `null` menghapus kunci.
 * `path` bawaan `/cari`; `/dokter` dipakai pencarian dokter (Fase 4b).
 */
export function searchHref(s: Partial<Record<string, string>>, patch: Partial<Record<string, string | null>> = {}, path: SearchPath = '/cari'): string {
  const p = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...s, cursor: undefined };
  for (const [k, v] of Object.entries(patch)) merged[k] = v ?? undefined;
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Huruf kecil, tanpa diakritik dan tanda baca, spasi tunggal. */
export function normalizeTerm(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface ServiceLike {
  slug: string;
  name: string;
  aliases?: readonly string[];
}

/**
 * USP "tahu biayanya": kata kunci yang persis nama, slug, alias, atau nama tanpa keterangan dalam kurung
 * satu layanan dipetakan ke layanan itu, sehingga hasil pencarian langsung menampilkan harganya.
 * Bila lebih dari satu layanan cocok, tidak ada pemetaan (pengguna memilih sendiri).
 */
export function resolveServiceQuery<T extends ServiceLike>(q: string, services: readonly T[]): T | null {
  const term = normalizeTerm(q);
  if (term.length < 2) return null;
  const keys = (s: T) =>
    [s.name, s.name.replace(/\(.*?\)/g, ''), s.slug, ...(s.aliases ?? [])].map(normalizeTerm).filter(Boolean);
  const hits = services.filter((s) => keys(s).includes(term));
  return hits.length === 1 ? hits[0]! : null;
}
