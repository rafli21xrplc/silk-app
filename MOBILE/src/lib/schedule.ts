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

export interface Clock {
  /** 1 = Senin … 7 = Minggu (sama dengan kolom `weekday` API). */
  weekday: number;
  /** Menit sejak tengah malam. */
  minutes: number;
}

const jakarta = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Hari dan jam sekarang di Asia/Jakarta (jadwal praktik ditulis dalam WIB). */
export function jakartaClock(now: Date = new Date()): Clock {
  const parts = Object.fromEntries(jakarta.formatToParts(now).map((p) => [p.type, p.value]));
  return { weekday: WEEKDAY[parts.weekday ?? 'Mon'] ?? 1, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export interface NextSession {
  weekday: number;
  start: string;
  end: string;
  note: string | null;
  /** 0 = hari ini, 1 = besok, … */
  inDays: number;
  /** Sedang berlangsung sekarang. */
  ongoing: boolean;
}

/** Sesi praktik terdekat dari `clock` (termasuk yang sedang berlangsung); null bila tidak ada jadwal. */
export function nextSession(slots: readonly Slot[], clock: Clock): NextSession | null {
  for (let inDays = 0; inDays < 8; inDays++) {
    const weekday = ((clock.weekday - 1 + inDays) % 7) + 1;
    const today = slots
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => a.start.localeCompare(b.start))
      .find((s) => inDays > 0 || toMinutes(s.end) > clock.minutes);
    // inDays 7 = hari yang sama pekan depan, bila semua sesi hari ini sudah lewat.
    if (today) {
      return {
        weekday,
        start: today.start,
        end: today.end,
        note: today.note ?? null,
        inDays,
        ongoing: inDays === 0 && toMinutes(today.start) <= clock.minutes,
      };
    }
  }
  return null;
}

/** Hari-hari yang punya jadwal (1–7), untuk strip pekan. */
export function activeWeekdays(slots: readonly Slot[]): Set<number> {
  return new Set(slots.map((s) => s.weekday));
}

/**
 * Jam buka: hari berurutan dengan jam sama digabung ("Senin–Jumat", "Setiap hari").
 * `hours` berurutan Senin → Minggu; null = belum dicantumkan.
 */
export function groupHours(hours: readonly (string | null)[], names: readonly string[], everyDay: string): { days: string; value: string | null }[] {
  const out: { from: number; to: number; value: string | null }[] = [];
  hours.forEach((value, i) => {
    const last = out[out.length - 1];
    if (last && last.value === value && last.to === i - 1) last.to = i;
    else out.push({ from: i, to: i, value });
  });
  if (out.length === 1 && out[0]!.to === hours.length - 1) return [{ days: everyDay, value: out[0]!.value }];
  return out.map((g) => ({ days: g.from === g.to ? names[g.from]! : `${names[g.from]}–${names[g.to]}`, value: g.value }));
}
