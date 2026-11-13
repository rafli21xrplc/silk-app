'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { activeWeekdays, groupByWeekday, jakartaClock, nextSession, type Clock } from '@/lib/schedule';
import { t } from '@/messages/id';

type Slot = { weekday: number; start: string; end: string; note?: string | null };

/*
 * "Hari ini" dan "jadwal terdekat" dihitung di peramban: halaman di-cache (ISR), jadi waktu render server
 * bisa sudah lewat. Saat render server dan hidrasi nilainya null (tampilan netral), lalu diperbarui per menit.
 */
const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
};
const snapshot = () => {
  const c = jakartaClock();
  return c.weekday * 1440 + c.minutes;
};
export function useJakartaClock(): Clock | null {
  const v = useSyncExternalStore<number | null>(subscribe, snapshot, () => null);
  return v === null ? null : { weekday: Math.floor(v / 1440), minutes: v % 1440 };
}

/** "Sedang praktik, sampai 20.00" · "Hari ini 16.00–20.00" · "Besok …" · "Jumat …". */
export function nextSessionText(slots: readonly Slot[], clock: Clock | null): { text: string; soon: boolean } | null {
  if (!clock) return null;
  const n = nextSession(slots, clock);
  if (!n) return null;
  const time = `${formatTime(n.start)}–${formatTime(n.end)}`;
  if (n.ongoing) return { text: t.doctors.ongoing(formatTime(n.end)), soon: true };
  const day = n.inDays === 0 ? t.doctors.today : n.inDays === 1 ? t.doctors.tomorrow : t.weekday[n.weekday]!;
  return { text: t.doctors.nextAt(day, time), soon: n.inDays === 0 };
}

/** Sel "Jadwal terdekat": hari di baris pertama, jam di baris kedua. */
export function NextSessionFact({ slots, fallback }: { slots: readonly Slot[]; fallback: string }) {
  const clock = useJakartaClock();
  const n = clock ? nextSession(slots, clock) : null;
  if (!clock && slots.length > 0) return <span className="block h-10" aria-hidden="true" />;
  if (!n) return <span className="block text-base font-semibold text-muted">{fallback}</span>;
  const day = n.ongoing ? t.doctors.now : n.inDays === 0 ? t.doctors.today : n.inDays === 1 ? t.doctors.tomorrow : t.weekday[n.weekday]!;
  const time = n.ongoing ? t.doctors.until(formatTime(n.end)) : `${formatTime(n.start)}–${formatTime(n.end)}`;
  return (
    <>
      <span className={cn('block text-base font-semibold', n.inDays === 0 ? 'text-primary-700' : 'text-ink')}>{day}</span>
      <span className="block text-xs text-muted tabular-nums">{time}</span>
    </>
  );
}

/** Strip pekan S S R K J S M: hari praktik terisi, hari ini bercincin. */
export function WeekStrip({ slots, className }: { slots: readonly Slot[]; className?: string }) {
  const clock = useJakartaClock();
  const active = activeWeekdays(slots);
  const label = t.doctors.weekLabel([...active].sort().map((d) => t.weekday[d]).join(', '));
  return (
    <span className={cn('flex gap-1', className)} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <span
          key={d}
          className={cn(
            'grid size-6 place-items-center rounded-full text-[11px] font-semibold',
            active.has(d) ? 'bg-primary-600 text-white' : 'bg-surface text-muted',
            clock?.weekday === d && 'ring-2 ring-primary-300 ring-offset-1',
          )}
          aria-hidden="true"
        >
          {t.weekdayLetter[d]}
        </span>
      ))}
    </span>
  );
}

/** Satu baris "jadwal terdekat"; kosong sebelum jam peramban diketahui. */
export function NextSession({ slots, fallback, className }: { slots: readonly Slot[]; fallback?: string; className?: string }) {
  const clock = useJakartaClock();
  const next = nextSessionText(slots, clock);
  if (!next) return fallback ? <span className={cn('text-muted', className)}>{fallback}</span> : <span className={className}>&nbsp;</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5', next.soon ? 'font-semibold text-primary-700' : 'text-ink-soft', className)}>
      {next.soon && <span className="size-1.5 rounded-full bg-primary-500" aria-hidden="true" />}
      {next.text}
    </span>
  );
}

/** Tabel jadwal per hari; baris hari ini disorot. */
export function ScheduleRows({ slots }: { slots: readonly Slot[] }) {
  const clock = useJakartaClock();
  return (
    <>
      {groupByWeekday(slots).map((d) => {
        const today = clock?.weekday === d.weekday;
        return (
          <li key={d.weekday} className={cn('flex items-baseline gap-3 px-4 py-2.5 text-sm', today && 'bg-primary-50')}>
            <span className={cn('w-16 shrink-0', today ? 'font-semibold text-primary-800' : 'text-muted')}>{t.weekday[d.weekday]}</span>
            <span className="min-w-0 flex-1 tabular-nums">{d.times.join(', ')}</span>
            {today && <span className="shrink-0 text-xs font-semibold text-primary-700">{t.doctors.today}</span>}
          </li>
        );
      })}
    </>
  );
}
