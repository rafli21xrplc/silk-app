import { describe, expect, it } from 'vitest';
import { checkPriceFields, formatPrice, formatRupiah } from './price';
import { tariffCreateSchema } from './schemas/portal';

describe('formatRupiah', () => {
  it('memformat tanpa spasi dengan pemisah ribuan titik (M2-4)', () => {
    expect(formatRupiah(1250000)).toBe('Rp1.250.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(350000)).toBe('Rp350.000');
  });
});

describe('formatPrice', () => {
  it('tarif tanya tampil "Tanyakan ke faskes", bukan nol (M2-3)', () => {
    expect(formatPrice({ type: 'tanya', min: null, max: null })).toBe('Tanyakan ke faskes');
  });
  it('rentang, mulai dari, dan tetap', () => {
    expect(formatPrice({ type: 'rentang', min: 100000, max: 250000 })).toBe('Rp100.000–Rp250.000');
    expect(formatPrice({ type: 'mulai_dari', min: 100000, max: null })).toBe('Mulai Rp100.000');
    expect(formatPrice({ type: 'tetap', min: 75000, max: null })).toBe('Rp75.000');
  });
});

describe('checkPriceFields', () => {
  it('menolak rentang dengan max < min (M2-1)', () => {
    const issues = checkPriceFields({ priceType: 'rentang', priceMin: 500, priceMax: 100, hasPackage: false });
    expect(issues.map((i) => i.path)).toContain('priceMax');
  });
  it('tetap wajib price_min dan tanpa price_max', () => {
    expect(checkPriceFields({ priceType: 'tetap', priceMin: null, priceMax: null, hasPackage: false })).toHaveLength(1);
    expect(checkPriceFields({ priceType: 'tetap', priceMin: 1, priceMax: 2, hasPackage: false })).toHaveLength(1);
    expect(checkPriceFields({ priceType: 'tetap', priceMin: 1, priceMax: null, hasPackage: false })).toHaveLength(0);
  });
  it('tanya tidak boleh punya angka; paket wajib paket', () => {
    expect(checkPriceFields({ priceType: 'tanya', priceMin: 0, priceMax: null, hasPackage: false })).toHaveLength(1);
    expect(checkPriceFields({ priceType: 'paket', priceMin: 1, priceMax: null, hasPackage: false })).toHaveLength(1);
  });
  it('skema Zod tarif memakai aturan yang sama', () => {
    const r = tariffCreateSchema.safeParse({
      serviceId: '0b1c2d3e-4f50-4a6b-9c7d-8e9f0a1b2c3d',
      priceType: 'rentang',
      priceMin: 500000,
      priceMax: 100000,
      effectiveFrom: '2026-09-01',
    });
    expect(r.success).toBe(false);
  });
});
