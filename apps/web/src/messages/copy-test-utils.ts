import type { ContentRule } from '@silk/shared';

// Sama dengan aturan bawaan di packages/db/seed/data.ts (CONTENT_RULES).
export const RULES: ContentRule[] = [
  { id: 1, pattern: 'termurah', kind: 'kata', level: 'blokir' },
  { id: 2, pattern: 'terbaik', kind: 'kata', level: 'blokir' },
  { id: 3, pattern: 'paling murah', kind: 'kata', level: 'blokir' },
  { id: 4, pattern: 'nomor satu', kind: 'kata', level: 'blokir' },
  { id: 5, pattern: 'pasti sembuh', kind: 'kata', level: 'blokir' },
  { id: 6, pattern: 'dijamin sembuh', kind: 'kata', level: 'blokir' },
  { id: 7, pattern: '100% aman', kind: 'kata', level: 'blokir' },
  { id: 8, pattern: 'tanpa efek samping', kind: 'kata', level: 'blokir' },
  { id: 9, pattern: 'promo', kind: 'kata', level: 'tinjau' },
  { id: 10, pattern: 'diskon', kind: 'kata', level: 'tinjau' },
];

/** Ratakan semua teks (termasuk hasil fungsi dan isi array) jadi satu daftar. */
export function texts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    // Fungsi teks menerima angka atau teks; coba angka dulu, lalu teks contoh.
    const fn = value as (...a: unknown[]) => unknown;
    try {
      return [[path, String(fn(1, 2))]];
    } catch {
      try {
        return [[path, String(fn('contoh', 'contoh'))]];
      } catch {
        return []; // butuh argumen terstruktur; diuji di komponen pemakainya
      }
    }
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => texts(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}
