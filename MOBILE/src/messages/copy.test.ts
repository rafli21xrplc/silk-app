import { describe, expect, it } from 'vitest';
import { checkContent, type ContentRule } from '@silk/shared';
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

function texts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const fn = value as (...a: unknown[]) => unknown;
    try {
      return [[path, String(fn(1, true))]];
    } catch {
      return [[path, String(fn('contoh', 'contoh'))]];
    }
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => texts(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}

describe('teks SILK Mobile', () => {
  const all = texts(t, 't');

  it.each(all)('%s lolos filter konten (M17)', (_path, text) => {
    expect(checkContent({ text }, RULES).violations).toEqual([]);
  });

  it('USP dan label perkiraan', () => {
    expect(t.site.tagline).toBe('Tahu biayanya, kenal dokternya, sebelum datang');
    expect(t.price.estimate).toBe('Perkiraan');
    expect(t.price.estimateHelp).toMatch(/konfirmasikan/i);
  });

  it('urutan netral disebut eksplisit', () => {
    expect(t.home.neutralBody).toMatch(/pembayaran tidak pernah/i);
  });
});
