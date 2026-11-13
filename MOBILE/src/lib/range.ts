/** Posisi (0–100 %) setiap nilai pada batang rentang [min, max]. Satu nilai → di tengah. */
export function rangePositions(values: readonly number[], min: number, max: number): number[] {
  if (max <= min) return values.map(() => 50);
  return values.map((v) => Math.round(((Math.min(Math.max(v, min), max) - min) / (max - min)) * 1000) / 10);
}

/** Lebar garis relatif (persen dari nilai tertinggi), minimal 4 % agar tetap terlihat. */
export function relativeWidth(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

export interface CityRange {
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
}

/**
 * Tanda untuk batang sebaran ringkas di kartu layanan: satu ruas [min, max] dan satu titik nilai tengah
 * per wilayah, pada skala harga terendah–tertinggi semua wilayah. Wilayah tanpa angka dilewati.
 */
export function spreadMarks(cities: readonly CityRange[]): { segments: { left: number; width: number }[]; medians: number[] } {
  const priced = cities.filter((c): c is CityRange & { minPrice: number } => c.minPrice !== null);
  if (priced.length === 0) return { segments: [], medians: [] };
  const lo = Math.min(...priced.map((c) => c.minPrice));
  const hi = Math.max(...priced.map((c) => c.maxPrice ?? c.minPrice));
  const segments = priced.map((c) => {
    const [a, b] = rangePositions([c.minPrice, c.maxPrice ?? c.minPrice], lo, hi) as [number, number];
    return { left: a, width: Math.round((b - a) * 10) / 10 };
  });
  const medians = rangePositions(
    priced.flatMap((c) => (c.medianPrice !== null ? [c.medianPrice] : [])),
    lo,
    hi,
  );
  return { segments, medians };
}
