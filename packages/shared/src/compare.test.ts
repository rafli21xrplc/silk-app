import { describe, expect, it } from 'vitest';
import { buildComparison } from './compare';

const row = (name: string, min: number | null, components: [string, boolean][], stale = false) => ({
  facility: { name },
  price: { type: min === null ? ('tanya' as const) : ('paket' as const), min, max: null },
  components: components.map(([label, included], i) => ({ label, included, sortOrder: i })),
  stale,
});

describe('buildComparison (M3)', () => {
  it('3 paket dengan komponen berbeda: semua komponen tampil, yang tidak ada = tidak termasuk', () => {
    const { columns, rows } = buildComparison([
      row('Klinik B', 400000, [['Hemoglobin', true], ['Kolesterol total', true]]),
      row('Klinik A', 350000, [['Hemoglobin', true], ['Gula darah puasa', true], ['Rontgen thorax', false]]),
      row('Klinik C', 500000, [['hemoglobin ', true], ['Rontgen thorax', true]]),
    ]);
    expect(columns).toEqual(['Hemoglobin', 'Kolesterol total', 'Gula darah puasa', 'Rontgen thorax']);
    expect(rows.map((r) => r.facility.name)).toEqual(['Klinik A', 'Klinik B', 'Klinik C']);
    expect(rows[0]?.components).toEqual({
      Hemoglobin: true,
      'Kolesterol total': false,
      'Gula darah puasa': true,
      'Rontgen thorax': false,
    });
    expect(rows[2]?.components['Hemoglobin']).toBe(true);
    for (const r of rows) expect(Object.keys(r.components)).toHaveLength(4);
  });

  it('tarif usang dapat disaring', () => {
    const { rows } = buildComparison(
      [row('A', 1, [['X', true]], true), row('B', 2, [['X', true]])],
      { hideStale: true },
    );
    expect(rows.map((r) => r.facility.name)).toEqual(['B']);
  });

  it('tarif tanya selalu di akhir, untuk urutan naik maupun turun', () => {
    const input = [row('Tanya', null, []), row('Murah', 1, []), row('Mahal', 9, [])];
    expect(buildComparison(input).rows.map((r) => r.facility.name)).toEqual(['Murah', 'Mahal', 'Tanya']);
    expect(buildComparison(input, { sort: 'price_desc' }).rows.map((r) => r.facility.name)).toEqual([
      'Mahal',
      'Murah',
      'Tanya',
    ]);
  });

  it('pengurutan deterministik: input sama menghasilkan urutan sama (M3-3)', () => {
    const input = [row('B', 5, []), row('A', 5, []), row('C', 5, [])];
    const a = buildComparison(input).rows.map((r) => r.facility.name);
    const b = buildComparison([...input].reverse()).rows.map((r) => r.facility.name);
    expect(a).toEqual(b);
  });
});
