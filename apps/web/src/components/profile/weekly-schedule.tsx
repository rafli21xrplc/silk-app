import Link from 'next/link';
import { formatTimeRange, groupByWeekday, tzShort, weekdayName, type ScheduleLike } from '@/lib/profile';
import { t } from '@/messages/id';

export type ScheduleItem = ScheduleLike & {
  note: string | null;
  practitioner?: { slug: string; name: string } | null;
};

/** Jadwal per hari Senin–Minggu dalam jam lokal + zona waktu (K7); hari tanpa jadwal ditulis "Tutup". */
export function WeeklySchedule({ items, withPractitioner, onlyOpenDays }: { items: ScheduleItem[]; withPractitioner?: boolean; onlyOpenDays?: boolean }) {
  const days = groupByWeekday(items);
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {days
        .filter((d) => !(withPractitioner || onlyOpenDays) || d.items.length > 0)
        .map((d) => (
          <div key={d.weekday} className="contents">
            <dt className="text-ink-soft">{weekdayName(d.weekday)}</dt>
            <dd className="m-0">
              {d.items.length === 0 ? (
                <span className="text-muted">{t.facility.closed}</span>
              ) : (
                <span className="grid gap-0.5">
                  {d.items.map((s, i) => (
                    <span key={i}>
                      <span className="tabular-nums">{formatTimeRange(s.start, s.end)}</span> {tzShort(s.timezone)}
                      {withPractitioner && s.practitioner && (
                        <>
                          {' · '}
                          <Link href={`/dokter/${s.practitioner.slug}`}>{s.practitioner.name}</Link>
                        </>
                      )}
                      {s.note && <span className="text-muted"> · {s.note}</span>}
                    </span>
                  ))}
                </span>
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
