'use client';

// Panel daftar pilihan (Radix + cmdk). Dimuat lewat dynamic import saat Select pertama kali dibuka.
import { Command } from 'cmdk';
import { Check, Search } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { Overlay } from './overlay';
import type { SelectOption } from './select';

/** Nilai kosong ("semua") tidak boleh menjadi value cmdk; dipetakan ke penanda ini. */
const EMPTY = '__kosong__';

export type SelectPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  label: string;
  align?: 'start' | 'center' | 'end';
  options: SelectOption[];
  current: string;
  withSearch: boolean;
  onChoose: (value: string) => void;
};

export default function SelectPanel({ open, onOpenChange, sheet, triggerRef, label, align, options, current, withSearch, onChoose }: SelectPanelProps) {
  const listRoot = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  return (
    <Overlay
      open={open}
      onOpenChange={onOpenChange}
      sheet={sheet}
      triggerRef={triggerRef}
      title={label}
      align={align}
      initialFocus={() => (withSearch ? search.current : listRoot.current)}
    >
      <Command ref={listRoot} tabIndex={-1} loop defaultValue={current || EMPTY} label={label} className="outline-none">
        {withSearch && (
          <div className="relative mb-1.5 border-b border-line px-1 pb-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-[60%] text-muted" aria-hidden="true" />
            <Command.Input
              ref={search}
              placeholder={t.ui.search}
              className="min-h-11 rounded-xl border-transparent bg-surface pl-10 text-[0.95rem] focus-visible:border-primary-600"
            />
          </div>
        )}
        <Command.List className="max-h-[min(320px,55dvh)] overflow-y-auto overscroll-contain p-0.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">{t.ui.empty}</Command.Empty>
          {options.map((o) => {
            const isOn = o.value === current;
            return (
              <Command.Item
                key={o.value || EMPTY}
                value={o.value || EMPTY}
                keywords={[o.label, o.hint ?? '']}
                onSelect={() => onChoose(o.value)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-[0.95rem] text-ink-soft select-none',
                  'data-[selected=true]:bg-primary-50 data-[selected=true]:text-ink',
                  isOn && 'font-semibold text-primary-800',
                )}
              >
                <span className="min-w-0">
                  <span className="block">{o.label}</span>
                  {o.hint && <span className="block text-[0.8rem] font-normal text-muted">{o.hint}</span>}
                </span>
                {isOn && (
                  <>
                    <Check className="size-4 shrink-0 text-primary-700" strokeWidth={2.5} aria-hidden="true" />
                    <span className="sr-only">({t.ui.chosen})</span>
                  </>
                )}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </Overlay>
  );
}
