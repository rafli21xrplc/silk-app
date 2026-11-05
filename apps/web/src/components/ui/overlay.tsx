'use client';

// Bagian berat (Radix). Dimuat lewat dynamic import oleh panel saat pertama kali dibuka.
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** true = bottom sheet. Ditentukan saat panel dibuka (lihat isSheetViewport). */
  sheet: boolean;
  /** Tombol pemicu (dirender terpisah oleh komponen pemanggil) sebagai jangkar posisi popover. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Judul panel (wajib untuk pembaca layar; tampil di bottom sheet). */
  title: string;
  /** Elemen yang difokus saat panel terbuka. */
  initialFocus?: () => HTMLElement | null | undefined;
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: React.ReactNode;
};

export function Overlay({ open, onOpenChange, sheet, triggerRef, title, initialFocus, align = 'start', className, children }: OverlayProps) {
  const focusInitial = (e: Event) => {
    const el = initialFocus?.();
    if (el) {
      e.preventDefault();
      el.focus();
    }
  };
  // Fokus selalu kembali ke tombol pemicu saat panel ditutup.
  const returnFocus = (e: Event) => {
    e.preventDefault();
    triggerRef.current?.focus();
  };
  return (
    <>
      <Popover.Root open={open && !sheet} onOpenChange={onOpenChange}>
        <Popover.Anchor virtualRef={triggerRef} />
        <Popover.Portal>
          <Popover.Content
            align={align}
            sideOffset={8}
            collisionPadding={12}
            aria-label={title}
            onOpenAutoFocus={focusInitial}
            onCloseAutoFocus={returnFocus}
            // Klik pada tombol pemicu ditangani tombol itu sendiri (toggle), bukan sebagai "klik di luar".
            onPointerDownOutside={(e) => {
              if (triggerRef.current?.contains(e.target as Node)) e.preventDefault();
            }}
            className={cn(
              'pop z-50 min-w-[max(var(--radix-popper-anchor-width),220px)] max-w-[min(420px,calc(100vw-24px))] rounded-2xl border border-line bg-white p-1.5 text-ink shadow-lift outline-none',
              className,
            )}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Dialog.Root open={open && sheet} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px]" />
          <Dialog.Content
            onOpenAutoFocus={focusInitial}
            onCloseAutoFocus={returnFocus}
            aria-describedby={undefined}
            className="sheet fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-hidden rounded-t-[1.75rem] bg-white pb-[max(12px,env(safe-area-inset-bottom))] text-ink shadow-lift outline-none"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
              <Dialog.Title className="m-0 text-base font-bold">{title}</Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">{t.ui.close}</span>
              </Dialog.Close>
            </div>
            <div className={cn('px-3', className)}>{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
