import { describe, expect, it } from 'vitest';
import { apiQuery, normalizeSearch, parseRupiahInput, resolveServiceQuery, searchHref } from './search-params';

describe('parseRupiahInput', () => {
  it('membuang pemisah ribuan dan teks', () => {
    expect(parseRupiahInput('Rp150.000')).toBe('150000');
    expect(parseRupiahInput('150 000')).toBe('150000');
    expect(parseRupiahInput('000')).toBe('0');
    expect(parseRupiahInput('abc')).toBe('');
  });
});

describe('normalizeSearch', () => {
  const off = { ratings: false };

  it('filter biaya dibuang tanpa layanan atau kategori; min/maks ditukar bila terbalik', () => {
    expect(normalizeSearch({ priceMin: '100.000' }, off)).toEqual({});
    expect(normalizeSearch({ category: 'laboratorium', priceMin: '300000', priceMax: '100.000' }, off)).toEqual({
      category: 'laboratorium',
      priceMin: '100000',
      priceMax: '300000',
    });
  });

  it('urut harga hanya dengan layanan; urut jarak dan radius hanya dengan titik', () => {
    expect(normalizeSearch({ sort: 'price_asc', category: 'mcu' }, off)).toEqual({ category: 'mcu' });
    expect(normalizeSearch({ sort: 'price_asc', service: 'mcu-dasar' }, off).sort).toBe('price_asc');
    expect(normalizeSearch({ sort: 'distance', radius: '5000' }, off)).toEqual({});
    expect(normalizeSearch({ sort: 'distance', radius: '5000', lat: '-7.9', lng: '112.6' }, off)).toMatchObject({ sort: 'distance', radius: '5000' });
    expect(normalizeSearch({ lat: '-7.9', lng: '112.6', radius: '7777' }, off).radius).toBeUndefined();
    expect(normalizeSearch({ lat: '999', lng: '112.6' }, off)).toEqual({});
  });

  it('rating hanya bila fitur ulasan menyala', () => {
    expect(normalizeSearch({ minRating: '4', sort: 'rating' }, off)).toEqual({});
    expect(normalizeSearch({ minRating: '4', sort: 'rating' }, { ratings: true })).toEqual({ minRating: '4', sort: 'rating' });
    expect(normalizeSearch({ minRating: '9' }, { ratings: true })).toEqual({});
  });

  it('kunci tak dikenal dibuang; nilai array diambil yang pertama', () => {
    expect(normalizeSearch({ q: ['lab', 'x'], foo: 'bar' }, off)).toEqual({ q: 'lab' });
  });
});

describe('apiQuery dan searchHref', () => {
  it('apiQuery menambah limit', () => {
    expect(apiQuery({ q: 'lab' }).toString()).toBe('q=lab&limit=20');
  });

  it('searchHref membuang kursor, menerapkan patch, null menghapus', () => {
    expect(searchHref({ q: 'lab', cursor: 'abc', priceMin: '1' }, { priceMin: null, view: 'peta' })).toBe('/cari?q=lab&view=peta');
    expect(searchHref({})).toBe('/cari');
  });
});

describe('resolveServiceQuery (USP: kata kunci layanan langsung menampilkan harga)', () => {
  const services = [
    { slug: 'hemoglobin', name: 'Hemoglobin', aliases: ['hb', 'cek hb'] },
    { slug: 'gula-darah-puasa', name: 'Gula darah puasa', aliases: ['gdp'] },
    { slug: 'fungsi-ginjal', name: 'Fungsi ginjal (ureum/kreatinin)', aliases: [] },
    { slug: 'kolesterol-total', name: 'Kolesterol total', aliases: ['kolesterol'] },
    { slug: 'kolesterol-ldl', name: 'Kolesterol LDL', aliases: ['kolesterol'] },
  ];
  it('nama, alias, slug, dan nama tanpa kurung; tanpa beda huruf besar dan tanda baca', () => {
    expect(resolveServiceQuery('Hemoglobin', services)?.slug).toBe('hemoglobin');
    expect(resolveServiceQuery('  cek HB ', services)?.slug).toBe('hemoglobin');
    expect(resolveServiceQuery('GDP', services)?.slug).toBe('gula-darah-puasa');
    expect(resolveServiceQuery('gula-darah-puasa', services)?.slug).toBe('gula-darah-puasa');
    expect(resolveServiceQuery('fungsi ginjal', services)?.slug).toBe('fungsi-ginjal');
  });
  it('tidak memetakan kata kunci sebagian, nama faskes, atau yang ambigu', () => {
    expect(resolveServiceQuery('hemo', services)).toBeNull();
    expect(resolveServiceQuery('Klinik Contoh Bunulrejo', services)).toBeNull();
    expect(resolveServiceQuery('kolesterol', services)).toBeNull();
    expect(resolveServiceQuery('h', services)).toBeNull();
  });
});
