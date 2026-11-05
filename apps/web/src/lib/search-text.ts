const DIACRITICS = /[̀-ͯ]/g;

/** Huruf kecil tanpa tanda diakritik, agar "é" cocok dengan "e". */
export const normalizeText = (s: string) => s.normalize('NFD').replace(DIACRITICS, '').toLowerCase();

/** Semua kata pada kueri harus muncul di teks (urutan bebas). Kueri kosong selalu cocok. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = normalizeText(haystack);
  return words.every((w) => hay.includes(w));
}
