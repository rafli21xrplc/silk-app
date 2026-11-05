import { describe, expect, it } from 'vitest';
import { priceBounds, priceMatchesRange } from './price';
import { facilitySearchQuerySchema, practitionerSearchQuerySchema } from './schemas/public';

describe('rentang harga untuk filter biaya (F-03)', () => {
  it('batas per jenis harga', () => {
    expect(priceBounds({ type: 'tetap', min: 100, max: null })).toEqual({ low: 100, high: 100 });
    expect(priceBounds({ type: 'paket', min: 100, max: 150 })).toEqual({ low: 100, high: 150 });
    expect(priceBounds({ type: 'rentang', min: 100, max: 300 })).toEqual({ low: 100, high: 300 });
    expect(priceBounds({ type: 'mulai_dari', min: 100, max: null })).toEqual({ low: 100, high: Number.POSITIVE_INFINITY });
    expect(priceBounds({ type: 'tanya', min: null, max: null })).toBeNull();
  });

  it('cocok bila beririsan; batas kosong terbuka; tanya tidak pernah cocok', () => {
    const rentang = { type: 'rentang' as const, min: 100_000, max: 300_000 };
    expect(priceMatchesRange(rentang, { from: 250_000, to: 400_000 })).toBe(true);
    expect(priceMatchesRange(rentang, { from: 301_000 })).toBe(false);
    expect(priceMatchesRange(rentang, { to: 99_999 })).toBe(false);
    expect(priceMatchesRange({ type: 'mulai_dari', min: 500_000, max: null }, { from: 2_000_000 })).toBe(true);
    expect(priceMatchesRange({ type: 'tetap', min: 150_000, max: null }, {})).toBe(true);
    expect(priceMatchesRange({ type: 'tanya', min: null, max: null }, {})).toBe(false);
  });
});

describe('facilitySearchQuerySchema (Fase 3)', () => {
  const ok = (q: Record<string, string>) => facilitySearchQuerySchema.safeParse(q).success;

  it('parameter lama tetap sah', () => {
    expect(ok({ q: 'lab', city: 'malang', type: 'klinik' })).toBe(true);
    expect(ok({ service: 'cek-darah', sort: 'price_asc' })).toBe(true);
  });

  it('filter biaya memerlukan layanan atau kategori, dan min ≤ maks', () => {
    expect(ok({ priceMin: '100000' })).toBe(false);
    expect(ok({ category: 'laboratorium', priceMin: '100000', priceMax: '200000' })).toBe(true);
    expect(ok({ service: 'cek-darah', priceMax: '200000' })).toBe(true);
    expect(ok({ service: 'cek-darah', priceMin: '300000', priceMax: '200000' })).toBe(false);
    expect(ok({ service: 'cek-darah', priceMin: '-1' })).toBe(false);
  });

  it('rating 1–5 dan urut rating diterima skema (flag diperiksa di service)', () => {
    expect(ok({ minRating: '4' })).toBe(true);
    expect(ok({ minRating: '6' })).toBe(false);
    expect(ok({ sort: 'rating' })).toBe(true);
  });

  it('urut harga tetap memerlukan layanan', () => {
    expect(ok({ category: 'laboratorium', sort: 'price_asc' })).toBe(false);
  });
});

describe('practitionerSearchQuerySchema (Fase 4b)', () => {
  const parse = (q: Record<string, string>) => practitionerSearchQuerySchema.safeParse(q);

  it('menerima filter dasar dan mengisi limit bawaan', () => {
    const r = parse({ q: 'anak', specialty: 'Anak', city: 'Malang' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBeGreaterThan(0);
  });

  it('radius dan urut jarak memerlukan lat/lng', () => {
    expect(parse({ radius: '5000' }).success).toBe(false);
    expect(parse({ sort: 'distance' }).success).toBe(false);
    expect(parse({ lat: '-7.98' }).success).toBe(false);
    expect(parse({ lat: '-7.98', lng: '112.63', radius: '5000', sort: 'distance' }).success).toBe(true);
  });

  it('urut relevansi memerlukan kata kunci', () => {
    expect(parse({ sort: 'relevance' }).success).toBe(false);
    expect(parse({ sort: 'relevance', q: 'jantung' }).success).toBe(true);
  });

  it('menolak urutan yang tidak dikenal, termasuk harga dan rating', () => {
    for (const sort of ['price_asc', 'rating', 'promoted', 'subscription']) expect(parse({ sort }).success).toBe(false);
  });
});
