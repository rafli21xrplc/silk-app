'use client';

// Panel kalender (Radix + react-day-picker). Dimuat lewat dynamic import saat DatePicker pertama kali dibuka.
import 'react-day-picker/style.css';
import { format } from 'date-fns';
import { useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import { id as dayPickerId } from 'react-day-picker/locale';
import { t } from '@/messages/id';
import { Overlay } from './overlay';

const ISO = 'yyyy-MM-dd';
/** Hari ini menurut zona waktu Indonesia bagian barat (sama dengan default formulir tarif). */
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

export type DatePickerPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  label: string;
  selected: Date | undefined;
  required?: boolean;
  hasValue: boolean;
  onPick: (iso: string) => void;
};

export default function DatePickerPanel({ open, onOpenChange, sheet, triggerRef, label, selected, required, hasValue, onPick }: DatePickerPanelProps) {
  const calendar = useRef<HTMLDivElement>(null);
  return (
    <Overlay
      open={open}
      onOpenChange={onOpenChange}
      sheet={sheet}
      triggerRef={triggerRef}
      title={label}
      // Fokus ke tanggal terpilih (atau hari ini) agar navigasi panah langsung jalan.
      initialFocus={() =>
        calendar.current?.querySelector<HTMLElement>('.rdp-selected button, .rdp-today button, .rdp-day:not(.rdp-disabled) button') ?? null
      }
      className="p-3"
    >
      <div ref={calendar} className="silk-calendar">
        <DayPicker
          mode="single"
          locale={dayPickerId}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => d && onPick(format(d, ISO))}
          showOutsideDays
          weekStartsOn={1}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-3">
        <button type="button" className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-50" onClick={() => onPick(todayIso())}>
          {t.ui.today}
        </button>
        {!required && hasValue && (
          <button type="button" className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink" onClick={() => onPick('')}>
            {t.ui.clear}
          </button>
        )}
      </div>
    </Overlay>
  );
}
