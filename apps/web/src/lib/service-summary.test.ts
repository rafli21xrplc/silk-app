import { checkContent, type ContentRule } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { t } from '../messages/id';
import { matchesQuery } from './search-text';
import {
  filterCatalog,
  groupByCategory,
  mapLimit,
  priceRangeText,
  scalePercent,
  summarizeCities,
  type CatalogItem,
} from './service-summary';

const city = (over: Partial<Parameters<typeof summarizeCities>[0][number]> = {}) => ({
  city: 'Kota Malang',
  facilityCount: 3,
  minPrice: 20000,
  maxPrice: 45000,
  medianPrice: 30000,
  latestVerifiedAt: '2026-10-02T02:00:00.000Z',
  ...over,
});

const item = (slug: string, category: string, over: Partial<CatalogItem> = {}): CatalogItem => ({
  id: `00000000-0000-4000-8000-${slug.padEnd(12, '0').slice(0, 12).replace(/[^0-9a-f]/g, '0')}`,
  slug,
  name: slug.replace(/-/g, ' '),
  description: null,
  category: { slug: category, name: category.toUpperCase() },
  aliases: [],
  summary: null,
  ...over,
});

describe('summarizeCities', () => {
  it('menggabungkan rentang, jumlah faskes, wilayah, dan verifikasi terbaru', () => {
    const s = summarizeCities([
      city(),
      city({ city: 'Kabupaten Malang', facilityCount: 8, minPrice: 18000, maxPrice: 40000, latestVerifiedAt: '2026-11-01T00:00:00.000Z' }),
    ]);
    expect(s).toEqual({
      minPrice: 18000,
      maxPrice: 45000,
      facilityCount: 11,
      cityCount: 2,
      cities: ['Kota Malang', 'Kabupaten Malang'],
      latestVerifiedAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('wilayah tanpa harga (tanya) tidak menurunkan rentang; maxPrice kosong memakai minPrice', () => {
    const s = summarizeCities([
      city({ minPrice: null, maxPrice: null, medianPrice: null, latestVerifiedAt: null }),
      city({ city: 'B', minPrice: 50000, maxPrice: null }),
    ]);
    expect(s.minPrice).toBe(50000);
    expect(s.maxPrice).toBe(50000);
  });

  it('tanpa wilayah: semua kosong', () => {
    expect(summarizeCities([])).toEqual({
      minPrice: null,
      maxPrice: null,
      facilityCount: 0,
      cityCount: 0,
      cities: [],
      latestVerifiedAt: null,
    });
  });
});

describe('priceRangeText', () => {
  it('rentang, satu angka, dan kosong', () => {
    expect(priceRangeText(20000, 47000)).toBe('Rp20.000 – Rp47.000');
    expect(priceRangeText(20000, 20000)).toBe('Rp20.000');
    expect(priceRangeText(20000, null)).toBe('Rp20.000');
    expect(priceRangeText(null, null)).toBeNull();
  });
});

describe('scalePercent', () => {
  it('memetakan nilai ke 0–100 dan menjepit di luar skala', () => {
    expect(scalePercent(15, 10, 20)).toBe(50);
    expect(scalePercent(5, 10, 20)).toBe(0);
    expect(scalePercent(25, 10, 20)).toBe(100);
    expect(scalePercent(10, 10, 10)).toBe(0);
  });
});

describe('mapLimit', () => {
  it('menjaga urutan hasil dan membatasi jumlah yang berjalan bersamaan', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3, 0, 6], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running--;
      return n * 2;
    });
    expect(out).toEqual([10, 2, 8, 4, 6, 0, 12]);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('daftar kosong', async () => {
    expect(await mapLimit([], 4, async (x: number) => x)).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('mengelompokkan dengan urutan kemunculan pertama', () => {
    const groups = groupByCategory([item('a', 'lab'), item('b', 'mcu'), item('c', 'lab')]);
    expect(groups.map((g) => [g.slug, g.items.map((i) => i.slug)])).toEqual([
      ['lab', ['a', 'c']],
      ['mcu', ['b']],
    ]);
  });
});

describe('filterCatalog', () => {
  const items = [
    item('asam-urat', 'laboratorium', { aliases: ['uric acid'] }),
    item('gula-darah-puasa', 'laboratorium', { description: 'Kadar glukosa setelah puasa.' }),
    item('rontgen-thorax', 'radiologi-penunjang'),
  ];

  it('mencocokkan nama, deskripsi, dan alias tanpa peka huruf/aksen', () => {
    expect(filterCatalog(items, 'URIC', '').map((s) => s.slug)).toEqual(['asam-urat']);
    expect(filterCatalog(items, 'glukosa', '').map((s) => s.slug)).toEqual(['gula-darah-puasa']);
    expect(filterCatalog(items, 'rontgén', '').map((s) => s.slug)).toEqual(['rontgen-thorax']);
  });

  it('menyaring kategori dan menggabungkan dengan kueri', () => {
    expect(filterCatalog(items, '', 'laboratorium')).toHaveLength(2);
    expect(filterCatalog(items, 'rontgen', 'laboratorium')).toHaveLength(0);
    expect(filterCatalog(items, '', '')).toHaveLength(3);
  });
});

describe('matchesQuery', () => {
  it('semua kata harus muncul, urutan bebas', () => {
    expect(matchesQuery('Gula darah puasa', 'puasa gula')).toBe(true);
    expect(matchesQuery('Gula darah puasa', 'gula urin')).toBe(false);
    expect(matchesQuery('apa saja', '   ')).toBe(true);
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

describe('teks publik katalog layanan lolos filter konten (M17)', () => {
  it('tidak ada pelanggaran', () => {
    const texts = Object.values(t.services)
      .map((v) => (typeof v === 'function' ? (v as (a: string | number) => string)(3) : v))
      .join('\n');
    expect(checkContent({ body: texts }, RULES).violations).toEqual([]);
  });
});
