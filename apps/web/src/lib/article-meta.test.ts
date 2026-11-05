import { checkContent, type ContentRule } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { t } from '../messages/id';
import { headingIds, readingMinutes, slugify, themeIndex, tocOf } from './article-meta';
import { SAMPLE_ARTICLES } from './sample-articles';
import type { PortableBlock } from './sanity';

const h2 = (text: string): PortableBlock => ({ _type: 'block', style: 'h2', children: [{ text }] });
const p = (text: string): PortableBlock => ({
  _type: 'block',
  style: 'normal',
  children: [{ text }],
});

describe('readingMinutes', () => {
  it('minimal 1 menit; ±200 kata per menit', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('kata '.repeat(50))).toBe(1);
    expect(readingMinutes('kata '.repeat(600))).toBe(3);
  });
});

describe('slugify & daftar isi', () => {
  it('membuat id anchor yang rapi', () => {
    expect(slugify('Kenapa rentang harganya lebar?')).toBe('kenapa-rentang-harganya-lebar');
    expect(slugify('Tarif   “paket” & satuan')).toBe('tarif-paket-satuan');
    expect(slugify('!!!')).toBe('bagian');
  });

  it('hanya h2 yang masuk; judul kembar diberi akhiran', () => {
    const blocks = [p('Pembuka'), h2('Soal biaya'), p('isi'), h2('Soal biaya'), h2('Penutup')];
    expect(tocOf(blocks)).toEqual([
      { id: 'soal-biaya', text: 'Soal biaya' },
      { id: 'soal-biaya-2', text: 'Soal biaya' },
      { id: 'penutup', text: 'Penutup' },
    ]);
    expect([...headingIds(blocks).keys()]).toEqual([1, 3, 4]);
  });
});

describe('themeIndex', () => {
  it('deterministik dan dalam rentang', () => {
    const i = themeIndex('contoh-biaya', 5);
    expect(i).toBe(themeIndex('contoh-biaya', 5));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(5);
  });
});

// Sama dengan aturan bawaan seed (lihat messages/auth-copy.test.ts).
const RULES: ContentRule[] = [
  'termurah',
  'terbaik',
  'paling murah',
  'nomor satu',
  'pasti sembuh',
  'dijamin sembuh',
  '100% aman',
  'tanpa efek samping',
  'promo',
  'diskon',
].map((pattern, i) => ({ id: i + 1, pattern, kind: 'kata', level: i < 8 ? 'blokir' : 'tinjau' }));
const plain = (blocks: PortableBlock[]) =>
  blocks.map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).join('\n');

describe('teks artikel lolos filter konten (M17)', () => {
  it.each(SAMPLE_ARTICLES.map((a) => [a.slug, a] as const))('contoh %s', (_slug, a) => {
    expect(
      checkContent({ title: a.title, description: a.description, body: plain(a.body) }, RULES)
        .violations,
    ).toEqual([]);
  });

  it('teks antarmuka artikel', () => {
    const texts = Object.values(t.articles).map((v) =>
      typeof v === 'function' ? String((v as (...a: unknown[]) => string)(3, 'mcu')) : v,
    );
    for (const text of texts) expect(checkContent({ text }, RULES).violations).toEqual([]);
  });

  it('slug contoh unik dan diawali "contoh-"', () => {
    const slugs = SAMPLE_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => s.startsWith('contoh-'))).toBe(true);
  });
});
