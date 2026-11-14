'use client';

import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { todaySessions, type ScheduleSlot } from '@/lib/schedule-today';
import { t } from '@/messages/id';

/**
 * "Hari ini 09.00–13.00" / "Tidak praktik hari ini" di kartu dokter. Dihitung di peramban setelah dimuat agar
 * halaman yang di-cache (ISR) tidak menampilkan hari yang salah; sebelum itu tampil "Jadwal tersedia".
 */
export function TodaySchedule({ slots }: { slots: readonly ScheduleSlot[] }) {
  const [today, setToday] = useState<string[] | null | undefined>(undefined);
  useEffect(() => setToday(todaySessions(slots, new Date())), [slots]);
  if (slots.length === 0) return null;
  const off = today !== undefined && today !== null && today.length === 0;
  const text = today === undefined || today === null ? t.doctors.hasSchedule : off ? t.doctors.notToday : t.doctors.today(today.join(', '));
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${off ? 'bg-surface text-muted' : 'bg-mint text-mint-ink'}`}
      data-today-schedule
    >
      <CalendarDays className="size-3" aria-hidden="true" />
      {text}
    </span>
  );
}
