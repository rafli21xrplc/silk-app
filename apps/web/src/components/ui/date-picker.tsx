'use client';

import { format, isValid, parse } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarDays, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { isSheetViewport } from './sheet-viewport';

const loadPanel = () => import('./date-picker-panel');
const DatePickerPanel = dynamic(loadPanel, { ssr: false });

const toDate = (v: string) => {
  const d = parse(v, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
};

type DatePickerProps = {
  /** Nama field; nilai dikirim sebagai yyyy-mm-dd (sama dengan input tanggal bawaan). */
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  /** Label untuk pembaca layar dan judul bottom sheet. */
  label: string;
  className?: string;
};

/** Pemilih tanggal berbasis popover (desktop) / bottom sheet (ponsel), berbahasa Indonesia. */
export function DatePicker({ name, defaultValue = '', required, disabled, label, className }: DatePickerProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = toDate(value);
  const text = selected ? format(selected, 'd MMMM yyyy', { locale: idLocale }) : t.ui.pickDate;

  return (
    <span className="relative block w-full">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${text}`}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        onClick={() => {
          if (!open) setSheet(isSheetViewport());
          setUsed(true);
          setOpen((o) => !o);
        }}
        className={cn(
          'group/date inline-flex min-h-[46px] w-full items-center gap-2.5 rounded-field border border-field bg-white px-3.5 text-left text-ink transition-[border-color,box-shadow] duration-200 ease-soft outline-none hover:border-ink-soft focus-visible:border-primary-600 focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-55 aria-expanded:border-primary-600 aria-expanded:shadow-[var(--shadow-focus)]',
          className,
        )}
      >
        <CalendarDays className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted')}>{text}</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-aria-expanded/date:rotate-180" aria-hidden="true" />
      </button>
      {used && (
        <DatePickerPanel
          open={open}
          onOpenChange={setOpen}
          sheet={sheet}
          triggerRef={trigger}
          label={label}
          selected={selected}
          required={required}
          hasValue={value !== ''}
          onPick={(v) => {
            setValue(v);
            setOpen(false);
          }}
        />
      )}
      <input type="hidden" name={name} value={value} />
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          onFocus={() => trigger.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px min-h-0 w-px border-0 p-0 opacity-0"
        />
      )}
    </span>
  );
}
