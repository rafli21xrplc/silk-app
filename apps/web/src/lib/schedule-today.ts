/** Jadwal praktik hari ini untuk kartu dokter ("Hari ini 09.00–13.00"), dihitung dalam WIB. */

export type ScheduleSlot = { weekday: number; start: string; end: string };

const jakarta = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short' });
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** 1 = Senin … 7 = Minggu (sama dengan kolom `weekday` API), menurut tanggal di Asia/Jakarta. */
export function jakartaWeekday(now: Date): number {
  return WEEKDAY[jakarta.format(now)] ?? 1;
}

const hhmm = (v: string) => v.slice(0, 5).replace(':', '.');

/**
 * Sesi hari ini, urut jam mulai dan tanpa duplikat (dokter yang praktik di dua tempat dengan jam sama).
 * `null` bila dokter tidak punya jadwal sama sekali; array kosong = tidak praktik hari ini.
 */
export function todaySessions(slots: readonly ScheduleSlot[], now: Date): string[] | null {
  if (slots.length === 0) return null;
  const day = jakartaWeekday(now);
  const times = slots
    .filter((s) => s.weekday === day)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => `${hhmm(s.start)}–${hhmm(s.end)}`);
  return [...new Set(times)];
}
