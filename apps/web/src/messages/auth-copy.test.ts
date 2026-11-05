import { checkContent, type ContentRule } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { t } from './id';

// Sama dengan aturan bawaan di packages/db/seed/data.ts (CONTENT_RULES).
const RULES: ContentRule[] = [
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
function texts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') return [[path, String((value as (...a: number[]) => unknown)(1, 2))]];
  if (Array.isArray(value)) return value.flatMap((v, i) => texts(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}

describe('teks halaman akun (M17)', () => {
  const all = [...texts(t.auth, 'auth'), ...texts(t.authPanel, 'authPanel')];

  it('punya teks untuk diperiksa', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it.each(all)('%s lolos filter konten', (_path, text) => {
    const result = checkContent({ text }, RULES);
    expect(result.violations).toEqual([]);
  });

  it('penanda langkah verifikasi memakai angka yang diberikan', () => {
    expect(t.auth.step(2, 2)).toBe('Langkah 2 dari 2');
  });
});
