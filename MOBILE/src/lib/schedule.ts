import { formatTime } from './format';

type Slot = { weekday: number; start: string; end: string; note?: string | null };

/** Jadwal per hari (Senin → Minggu), jam diurutkan; "08.00–12.00 · catatan". */
export function groupByWeekday(slots: readonly Slot[]): { weekday: number; times: string[] }[] {
  const days = new Map<number, Slot[]>();
  for (const s of slots) days.set(s.weekday, [...(days.get(s.weekday) ?? []), s]);
  return [...days.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, list]) => ({
      weekday,
      times: [...list]
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((s) => `${formatTime(s.start)}–${formatTime(s.end)}${s.note ? ` · ${s.note}` : ''}`),
    }));
}
