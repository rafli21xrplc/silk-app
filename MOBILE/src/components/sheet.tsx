'use client';

import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { t } from '@/messages/id';

/** Lembar bawah (bottom sheet) yang bisa digeser turun untuk menutup; selebar kolom ponsel. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[440px] flex-col rounded-t-[1.75rem] bg-white shadow-lift outline-none"
        >
          <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
            <Drawer.Title className="m-0 text-lg font-bold">{title}</Drawer.Title>
            <button type="button" onClick={() => onOpenChange(false)} aria-label={t.common.close} className="tap grid size-10 place-items-center rounded-full bg-surface">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="pb-safe border-t border-line/70 px-5 pt-3">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
