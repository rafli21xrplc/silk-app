'use client';

// Isi popover penjelasan (Radix). Dimuat lewat dynamic import saat InfoPopover pertama kali dibuka.
import * as Popover from '@radix-ui/react-popover';

export default function InfoPanel({
  open,
  onOpenChange,
  triggerRef,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  content: React.ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor virtualRef={triggerRef} />
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (triggerRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="pop z-50 max-w-[min(300px,calc(100vw-24px))] rounded-2xl border border-line bg-white px-4 py-3 text-[0.875rem] leading-relaxed text-ink-soft shadow-lift outline-none"
        >
          {content}
          <Popover.Arrow className="fill-white drop-shadow-[0_1px_0_var(--color-line)]" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
