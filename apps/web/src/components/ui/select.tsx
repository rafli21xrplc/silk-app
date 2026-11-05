'use client';

import { ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { isSheetViewport } from './sheet-viewport';

export type SelectOption = { value: string; label: string; hint?: string };

/** Panel (Radix + cmdk) baru diunduh saat dibutuhkan, supaya tidak menambah JS awal halaman. */
const loadPanel = () => import('./select-panel');
const SelectPanel = dynamic(loadPanel, { ssr: false });

type SelectProps = {
  options: SelectOption[];
  /** Nama field formulir; nilai dikirim lewat input tersembunyi (FormData / GET). */
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Tampilkan kolom cari di dalam panel (untuk daftar panjang). Otomatis aktif di atas 8 pilihan. */
  searchable?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Label untuk pembaca layar dan judul bottom sheet. */
  label: string;
  /** Kirim formulir induk segera setelah memilih (filter). */
  autoSubmit?: boolean;
  icon?: React.ReactNode;
  variant?: 'field' | 'chip';
  className?: string;
  align?: 'start' | 'center' | 'end';
};

/**
 * Dropdown berbasis popover (desktop) / bottom sheet (ponsel). Navigasi keyboard: panah, Enter, Esc.
 * Nilai awal ikut terkirim tanpa JavaScript lewat input tersembunyi.
 */
export function Select({
  options,
  name,
  value,
  defaultValue = '',
  onValueChange,
  placeholder = t.ui.choose,
  searchable,
  required,
  disabled,
  label,
  autoSubmit,
  icon,
  variant = 'field',
  className,
  align,
}: SelectProps) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === current);
  const active = variant === 'chip' && current !== '';

  function choose(v: string) {
    flushSync(() => {
      if (value === undefined) setInner(v);
      setOpen(false);
    });
    onValueChange?.(v);
    if (autoSubmit) hidden.current?.form?.requestSubmit();
  }

  function toggle() {
    if (disabled) return;
    if (!open) setSheet(isSheetViewport());
    setUsed(true);
    setOpen((o) => !o);
  }

  return (
    <span className={cn('relative', variant === 'field' ? 'block w-full' : 'inline-block')}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          'group/select inline-flex items-center gap-2 text-left transition-[border-color,background-color,box-shadow] duration-200 ease-soft outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-55',
          variant === 'field' &&
            'min-h-[46px] w-full justify-between rounded-field border border-field bg-white px-3.5 text-ink hover:border-ink-soft focus-visible:border-primary-600 aria-expanded:border-primary-600 aria-expanded:shadow-[var(--shadow-focus)]',
          variant === 'chip' &&
            'min-h-10 rounded-full border border-line bg-white px-4 text-[0.925rem] font-medium text-ink-soft shadow-soft hover:border-primary-200 hover:bg-primary-50',
          active && 'border-primary-200 bg-primary-50 text-primary-800',
          className,
        )}
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        <span className={cn('min-w-0 flex-1 truncate', !selected && variant === 'field' && 'text-muted')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 ease-soft group-aria-expanded/select:rotate-180" aria-hidden="true" />
      </button>
      {used && (
        <SelectPanel
          open={open}
          onOpenChange={setOpen}
          sheet={sheet}
          triggerRef={trigger}
          label={label}
          align={align}
          options={options}
          current={current}
          withSearch={searchable ?? options.length > 8}
          onChoose={choose}
        />
      )}
      {name && <input ref={hidden} type="hidden" name={name} value={current} />}
      {/* Validasi bawaan browser untuk field wajib (input tersembunyi tidak divalidasi). */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={current}
          onChange={() => undefined}
          onFocus={() => trigger.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-4 h-px min-h-0 w-px border-0 p-0 opacity-0"
        />
      )}
    </span>
  );
}
