import { describe, expect, it } from 'vitest';
import { csvRowSchema } from './schemas/import';

const base = {
  facility_name: 'RSUD Kota Malang',
  city: 'Kota Malang',
  service_slug: 'hemoglobin',
  price_type: 'tetap',
  price_min: '35.000',
  price_max: '',
  effective_from: '2026-01-01',
  source_title: 'Perda Kota Malang No. 1/2026',
  source_url: '',
};

describe('csvRowSchema', () => {
  it('mengubah angka berformat menjadi integer rupiah', () => {
    const r = csvRowSchema.parse(base);
    expect(r.price_min).toBe(35000);
    expect(r.price_max).toBeNull();
    expect(r.source_url).toBeNull();
  });
  it('menolak tanggal salah dan rentang terbalik', () => {
    expect(csvRowSchema.safeParse({ ...base, effective_from: '01/01/2026' }).success).toBe(false);
    expect(
      csvRowSchema.safeParse({ ...base, price_type: 'rentang', price_min: '500000', price_max: '100000' }).success,
    ).toBe(false);
  });
});
