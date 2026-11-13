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
